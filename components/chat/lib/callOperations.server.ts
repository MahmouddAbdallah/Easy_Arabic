/**
 * SERVER ONLY — uses firebase-admin and the database. Never import this from a client component.
 *
 * Everything that changes a call goes through here, as ONE Firestore transaction around the pure rules
 * in ./callMachine.ts: load the record, ask the machine what it becomes, store the answer. Browsers
 * never write to Firestore, so no browser can push a call into a state the machine doesn't allow.
 *
 *   calls/{callId}                       the record (CallRecord). Server-only.
 *   calls/{callId}/signals/{to}_{seq}    one signaling message addressed to `to` (SDP / ICE candidate)
 *   callPresence/{userId}                { callId }: the call a user is in, which is how "busy" is known
 *   chats/{chatId}.call                  the doorbell: public-safe summary that wakes the browsers
 *   chats/{chatId}/messages/{callId}     the conversation entry, written once when the call finishes
 *
 * The signal id starts with the recipient and ends with a zero-padded sequence number, so "what's new
 * for me since #12" is a plain document-id range read: no composite index, and only new documents are read.
 */
import {
    FieldPath,
    FieldValue,
    type DocumentReference,
    type DocumentSnapshot,
    type Transaction,
} from "firebase-admin/firestore";
import { firebaseAdminDB } from "@/lib/config/firebase-admin";
import { db } from "@/prisma/db";
import type { userType } from "@/types/userTypes";
import {
    CALLS_COLLECTION,
    CALL_PRESENCE_COLLECTION,
    MAX_CALL_SIGNALS,
    getCallPreview,
    isLiveStatus,
    isTerminalStatus,
    type CallAnswer,
    type CallMode,
    type CallOffer,
    type CallSignal,
    type CallSignalInput,
    type CallView,
    type ClientEndReason,
} from "./call";
import {
    applyCallEvent,
    createBusyCall,
    createCall,
    isMissedForCallee,
    peerIdOf,
    reserveSignals,
    roleOf,
    settleByTime,
    toCallDoorbell,
    toCallLog,
    toCallView,
    type CallEvent,
    type CallRecord,
    type NewCallInput,
} from "./callMachine";
import { getChatId } from "./chatId";
import { isPlaceholderChat } from "./chatState";
import { ChatApiError, assertNotBlocked } from "./messageOperations.server";
import { newUnreadCounts, unreadIncrementUpdates, updateChat, type ChatUpdate } from "./unread.server";
import { readUnreadTotal, writeUnreadTotal, type UnreadTotal } from "./unreadTotal.server";

/* -------------------------------------------------------------------------------------------------
 * Where things live
 * ---------------------------------------------------------------------------------------------- */

const callRef = (callId: string) => firebaseAdminDB.collection(CALLS_COLLECTION).doc(callId);
const signalsOf = (callId: string) => callRef(callId).collection("signals");
const presenceRef = (userId: string) => firebaseAdminDB.collection(CALL_PRESENCE_COLLECTION).doc(userId);
const chatRefOf = (chatId: string) => firebaseAdminDB.collection("chats").doc(chatId);

const SEQ_DIGITS = 6;
const MAX_SEQ = 10 ** SEQ_DIGITS - 1;
const signalId = (to: string, seq: number) => `${to}_${String(seq).padStart(SEQ_DIGITS, "0")}`;

type StoredCall = CallRecord & { participants: string[] };

function recordOf(snap: DocumentSnapshot): CallRecord | null {
    return snap.exists ? (snap.data() as StoredCall) : null;
}

const toStored = (call: CallRecord): StoredCall => ({ ...call, participants: [call.callerId, call.calleeId] });

const notFound = () => new ChatApiError("CALL_NOT_FOUND", "This call doesn't exist.", 404);

/* -------------------------------------------------------------------------------------------------
 * Writing
 * ---------------------------------------------------------------------------------------------- */

interface PendingSignal {
    to: string;
    from: string;
    seq: number;
    input: CallSignalInput;
}

/** Everything a transaction must read BEFORE it writes a finished call. */
interface FinishReads {
    chat: DocumentSnapshot;
    /** The presence documents of caller and callee (empty when none were ever written). */
    pointers: Array<{ userId: string; snap: DocumentSnapshot }>;
    /** Only read when the callee has to be told about a call they missed. */
    calleeTotal: UnreadTotal | null;
}

async function readForFinish(tx: Transaction, call: CallRecord, withPointers: boolean): Promise<FinishReads> {
    const refs: DocumentReference[] = [chatRefOf(call.chatId)];
    if (withPointers) refs.push(presenceRef(call.callerId), presenceRef(call.calleeId));

    const [chat, ...pointers] = await tx.getAll(...refs);
    const calleeTotal = isMissedForCallee(toCallLog(call).outcome) ? await readUnreadTotal(tx, call.calleeId) : null;

    return {
        chat,
        pointers: pointers.map((snap, index) => ({ userId: index === 0 ? call.callerId : call.calleeId, snap })),
        calleeTotal,
    };
}

/** The call is over: log it in the conversation, update the chat, free both people. */
function writeFinished(tx: Transaction, call: CallRecord, reads: FinishReads) {
    const log = toCallLog(call);
    const time = new Date(call.endedAt ?? Date.now()).toISOString();
    const chatRef = chatRefOf(call.chatId);
    const participants = [call.callerId, call.calleeId];
    const missed = isMissedForCallee(log.outcome);

    // The message id is the call's id: finishing the same call twice can never log it twice.
    tx.set(chatRef.collection("messages").doc(call.id), {
        id: call.id,
        senderId: call.callerId,
        receiverId: call.calleeId,
        text: "",
        time,
        status: "sent",
        type: "call",
        call: log,
        createdAt: FieldValue.serverTimestamp(),
    });

    // A call that finished late (both browsers vanished) must not overwrite a newer last message.
    const lastTime: unknown = reads.chat.get("time");
    const isNewest = typeof lastTime !== "string" || lastTime <= time;
    const preview = getCallPreview(log);

    if (reads.chat.exists) {
        const updates: ChatUpdate[] = [
            ["id", call.chatId],
            ["participants", participants],
            ["call", toCallDoorbell(call)],
        ];
        if (isNewest) {
            updates.push(
                ["lastMessage", preview],
                ["lastSenderId", call.callerId],
                ["time", time],
                ["updatedAt", FieldValue.serverTimestamp()]
            );
        }
        if (missed) updates.push(...unreadIncrementUpdates(reads.chat.get("unreadCount"), participants, call.calleeId));
        updateChat(tx, chatRef, updates);
    } else {
        tx.set(chatRef, {
            id: call.chatId,
            participants,
            lastMessage: preview,
            lastSenderId: call.callerId,
            time,
            isRead: !missed,
            unreadCount: missed
                ? newUnreadCounts(participants, call.calleeId)
                : Object.fromEntries(participants.map((id) => [id, 0])),
            updatedAt: FieldValue.serverTimestamp(),
            call: toCallDoorbell(call),
        });
    }

    if (missed && reads.calleeTotal) writeUnreadTotal(tx, reads.calleeTotal, 1);

    for (const { userId, snap } of reads.pointers) {
        if (snap.exists && snap.get("callId") === call.id) tx.delete(presenceRef(userId));
    }
}

const sameRevs = (a: Record<string, number>, b: Record<string, number>) =>
    Object.keys({ ...a, ...b }).every((userId) => (a[userId] ?? 0) === (b[userId] ?? 0));

/* -------------------------------------------------------------------------------------------------
 * The one way an existing call changes
 * ---------------------------------------------------------------------------------------------- */

interface Mutation {
    record: CallRecord;
    /** The event itself took effect (not a repeat, not too late). */
    applied: boolean;
    /** This very transaction finished the call. */
    finished: boolean;
}

async function mutateCall(callId: string, event: CallEvent, signals: CallSignalInput[] = []): Promise<Mutation> {
    return firebaseAdminDB.runTransaction(async (tx): Promise<Mutation> => {
        const before = recordOf(await tx.get(callRef(callId)));
        if (!before) throw notFound();

        const transition = applyCallEvent(before, event, Date.now());
        if (!transition.ok) {
            const { code, message, status } = transition.error;
            // A stranger must not learn that somebody else's call exists.
            throw code === "NOT_A_PARTICIPANT" ? notFound() : new ChatApiError(code, message, status);
        }

        let after = transition.call;
        const pending: PendingSignal[] = [];
        if (transition.applied && signals.length > 0 && "actorId" in event) {
            const to = peerIdOf(after, event.actorId);
            const reserved = reserveSignals(after, to, signals.length);
            after = reserved.call;
            signals.forEach((input, index) => pending.push({ to, from: event.actorId, seq: reserved.firstSeq + index, input }));
        }

        if (after === before) return { record: before, applied: transition.applied, finished: false };

        const finished = isTerminalStatus(after.status) && !isTerminalStatus(before.status);
        // Reads must happen before writes inside a transaction.
        const reads = finished ? await readForFinish(tx, after, true) : null;

        tx.set(callRef(callId), toStored(after));
        for (const { to, from, seq, input } of pending) {
            tx.set(signalsOf(callId).doc(signalId(to, seq)), { seq, to, from, type: input.type, data: input.data });
        }

        if (reads) writeFinished(tx, after, reads);
        else if (!sameRevs(before.revs, after.revs)) {
            tx.set(chatRefOf(after.chatId), { call: toCallDoorbell(after) }, { merge: true });
        }

        return { record: after, applied: transition.applied, finished };
    });
}

/* -------------------------------------------------------------------------------------------------
 * Reading
 * ---------------------------------------------------------------------------------------------- */

/** What is new for `viewerId`, oldest first: a document-id range read over their own signals. */
async function readSignals(callId: string, viewerId: string, after: number): Promise<CallSignal[]> {
    if (after >= MAX_SEQ) return [];

    const snapshot = await signalsOf(callId)
        .where(FieldPath.documentId(), ">", signalId(viewerId, after))
        .where(FieldPath.documentId(), "<=", signalId(viewerId, MAX_SEQ))
        .orderBy(FieldPath.documentId())
        .limit(MAX_CALL_SIGNALS)
        .get();

    return snapshot.docs.map(
        (doc) => ({ seq: doc.get("seq"), type: doc.get("type"), data: doc.get("data") }) as CallSignal
    );
}

export interface CallResult {
    view: CallView;
    record: CallRecord;
    /** This request finished the call (e.g. an expired ring was settled), so someone may need to hear of it. */
    finished: boolean;
}

async function toResult(mutation: Pick<Mutation, "record" | "finished">, viewerId: string, after: number): Promise<CallResult> {
    const { record, finished } = mutation;
    const signals = isLiveStatus(record.status) ? await readSignals(record.id, viewerId, after) : [];
    return { view: toCallView(record, viewerId, signals), record, finished };
}

/** The call as `viewerId` sees it. An expired ring is settled on the way, whoever asks first. */
export async function getCall({ callId, viewerId, after = 0 }: { callId: string; viewerId: string; after?: number }): Promise<CallResult> {
    const record = recordOf(await callRef(callId).get());
    if (!record || !roleOf(record, viewerId)) throw notFound();

    if (settleByTime(record, Date.now()) !== record) {
        return toResult(await mutateCall(callId, { type: "tick" }), viewerId, after);
    }
    return toResult({ record, finished: false }, viewerId, after);
}

/** The call `userId` is in right now, if any. */
export async function getCurrentCall(userId: string, after = 0): Promise<CallResult | null> {
    const callId: unknown = (await presenceRef(userId).get()).get("callId");
    if (typeof callId !== "string") return null;

    try {
        const result = await getCall({ callId, viewerId: userId, after });
        return isLiveStatus(result.record.status) ? result : null;
    } catch (error) {
        if (error instanceof ChatApiError && error.code === "CALL_NOT_FOUND") return null;
        throw error;
    }
}

/* -------------------------------------------------------------------------------------------------
 * Placing a call
 * ---------------------------------------------------------------------------------------------- */

async function loadCallee(userId: string) {
    return db.orm.public.User.where({ id: userId }).select("id", "name", "status", "role").first();
}

/**
 * A call rings someone's device, so it is held to a stricter rule than a message: an admin may call
 * anyone; everybody else needs an existing conversation with the person, or (for a teacher) to be
 * linked to them as teacher and family.
 */
async function assertMayCall(caller: userType, callee: { id: string; role: string }, chatId: string) {
    if (caller.role === "admin") return;
    // "They have talked before". A document that only holds a block is not a conversation.
    const chat = await chatRefOf(chatId).get();
    if (chat.exists && !isPlaceholderChat(chat.data())) return;

    const link =
        caller.role === "teacher"
            ? { teacherId: caller.id, familyId: callee.id }
            : callee.role === "teacher"
              ? { teacherId: callee.id, familyId: caller.id }
              : null;
    if (link && (await db.orm.public.TeacherFamily.where(link).first())) return;

    throw new ChatApiError("CALL_NOT_ALLOWED", "You can't call this person.", 403);
}

/**
 * A browser that vanished mid-call (crash, dead battery) must not keep its owner "in a call" for ever:
 * if `userId`'s page stopped reporting, that call is ended now. Settles an expired ring too.
 */
async function releaseGoneCall(userId: string): Promise<void> {
    const callId: unknown = (await presenceRef(userId).get()).get("callId");
    if (typeof callId !== "string") return;

    try {
        await mutateCall(callId, { type: "release", userId });
    } catch (error) {
        if (!(error instanceof ChatApiError) || error.code !== "CALL_NOT_FOUND") throw error;
        await presenceRef(userId).delete(); // the pointer outlived its call
    }
}

/** The live call a presence document points at, if it still is live. */
async function liveCallOf(tx: Transaction, pointer: DocumentSnapshot): Promise<CallRecord | null> {
    const callId: unknown = pointer.get("callId");
    if (typeof callId !== "string") return null;

    const record = recordOf(await tx.get(callRef(callId)));
    return record && isLiveStatus(record.status) ? record : null;
}

export interface StartedCall extends CallResult {
    /** false when the callee was busy: the call never rang. */
    ringing: boolean;
}

export async function startCall({
    caller,
    receiverId,
    mode,
    offer,
}: {
    caller: userType;
    receiverId: string;
    mode: CallMode;
    offer: CallOffer;
}): Promise<StartedCall> {
    if (receiverId === caller.id) throw new ChatApiError("INVALID_RECEIVER", "You can't call yourself.", 400);

    const callee = await loadCallee(receiverId);
    if (!callee) throw new ChatApiError("USER_NOT_FOUND", "This person doesn't exist.", 404);
    if (callee.status !== "active") {
        throw new ChatApiError("USER_UNAVAILABLE", "This person can't receive calls right now.", 403);
    }

    const chatId = getChatId(caller.id, callee.id);
    await assertMayCall(caller, callee, chatId);
    await Promise.all([releaseGoneCall(caller.id), releaseGoneCall(callee.id)]);

    const now = Date.now();
    const input: NewCallInput = {
        id: firebaseAdminDB.collection(CALLS_COLLECTION).doc().id,
        chatId,
        callerId: caller.id,
        calleeId: callee.id,
        callerName: caller.name,
        calleeName: callee.name,
        mode,
    };

    const { record, ringing } = await firebaseAdminDB.runTransaction(async (tx) => {
        // Reads must happen before writes inside a transaction.
        const chat = await tx.get(chatRefOf(chatId));
        const [callerPointer, calleePointer] = await tx.getAll(presenceRef(caller.id), presenceRef(callee.id));

        // A block made a moment ago is seen here, in the same transaction that would ring the phone.
        assertNotBlocked(chat, caller.id, callee.id);

        if (await liveCallOf(tx, callerPointer)) {
            throw new ChatApiError("ALREADY_IN_CALL", "You're already in a call.", 409);
        }
        const busy = (await liveCallOf(tx, calleePointer)) !== null;

        if (busy) {
            // Never rings: finished the moment it exists, and the callee finds a missed call in the chat.
            const busyCall = createBusyCall(input, now);
            const calleeTotal = await readUnreadTotal(tx, callee.id);
            tx.set(callRef(input.id), toStored(busyCall));
            writeFinished(tx, busyCall, { chat, pointers: [], calleeTotal });
            return { record: busyCall, ringing: false };
        }

        const reserved = reserveSignals(createCall(input, now), callee.id, 1);
        const call = reserved.call;

        tx.set(callRef(call.id), toStored(call));
        tx.set(signalsOf(call.id).doc(signalId(callee.id, reserved.firstSeq)), {
            seq: reserved.firstSeq,
            to: callee.id,
            from: caller.id,
            type: "offer",
            data: offer,
        });
        tx.set(presenceRef(caller.id), { callId: call.id, updatedAt: now });
        tx.set(presenceRef(callee.id), { callId: call.id, updatedAt: now });

        if (chat.exists) {
            tx.set(chatRefOf(chatId), { call: toCallDoorbell(call) }, { merge: true });
        } else {
            const participants = [caller.id, callee.id];
            tx.set(chatRefOf(chatId), {
                id: chatId,
                participants,
                lastMessage: "",
                lastSenderId: caller.id,
                time: new Date(now).toISOString(),
                isRead: true,
                unreadCount: Object.fromEntries(participants.map((id) => [id, 0])),
                updatedAt: FieldValue.serverTimestamp(),
                call: toCallDoorbell(call),
            });
        }
        return { record: call, ringing: true };
    });

    return { view: toCallView(record, caller.id, []), record, finished: !ringing, ringing };
}

/* -------------------------------------------------------------------------------------------------
 * Everything that happens to a call once it exists
 * ---------------------------------------------------------------------------------------------- */

interface Actor {
    callId: string;
    actorId: string;
    /** The highest signal the actor already processed; the response carries what is newer. */
    after?: number;
}

async function perform(
    { callId, actorId, after = 0 }: Actor,
    event: CallEvent,
    signals: CallSignalInput[] = []
): Promise<CallResult> {
    return toResult(await mutateCall(callId, event, signals), actorId, after);
}

/** The callee's browser is showing the call: the caller's "Calling…" becomes "Ringing…". */
export const markRinging = (actor: Actor) => perform(actor, { type: "ringing", actorId: actor.actorId });

/** The callee answers. The answer is only stored if the answer itself took effect. */
export const acceptCall = (actor: Actor & { answer: CallAnswer }) =>
    perform(actor, { type: "accept", actorId: actor.actorId }, [{ type: "answer", data: actor.answer }]);

export const declineCall = (actor: Actor) => perform(actor, { type: "decline", actorId: actor.actorId });

/** Hang up. Cancels a ringing call (caller) or declines it (callee); ends one that was answered. */
export const endCall = (actor: Actor & { reason: ClientEndReason }) =>
    perform(actor, { type: "end", actorId: actor.actorId, reason: actor.reason });

/** Media is flowing. */
export const reportConnected = (actor: Actor) => perform(actor, { type: "connected", actorId: actor.actorId });

/** "I'm still here." The response doubles as a sync: it carries anything the doorbell missed. */
export const heartbeat = (actor: Actor) => perform(actor, { type: "heartbeat", actorId: actor.actorId });

/** ICE candidates (and renegotiation offers/answers) for the other side. */
export const sendSignals = (actor: Actor & { signals: CallSignalInput[] }) =>
    perform(actor, { type: "signal", actorId: actor.actorId, count: actor.signals.length }, actor.signals);

/** A finished call that the callee never picked up: worth a "Missed call" notification. */
export const isMissedCall = (record: CallRecord): boolean =>
    isTerminalStatus(record.status) && isMissedForCallee(toCallLog(record).outcome);
