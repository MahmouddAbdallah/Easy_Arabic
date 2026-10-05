/**
 * The rules of a call, as pure functions: no Firestore, no clock, no network. The server
 * (./callOperations.server.ts) loads a record, asks `applyCallEvent` what the record becomes, and
 * stores the answer, so every rule below can be tested without any infrastructure.
 *
 *   calling ──▶ ringing ──▶ connecting ──▶ active ──▶ ended
 *      │           │            │                        ▲
 *      ├───────────┴──▶ declined / cancelled / missed    └─ also from connecting (media never came up)
 *      └──▶ busy (the callee was in another call; never rings)
 *
 * Time is an input (`now`, epoch ms) so the same code settles an expired ring whenever somebody next
 * looks at the call, even if both browsers are long gone.
 */
import {
    CALL_CONNECT_TIMEOUT_MS,
    CALL_RING_TIMEOUT_MS,
    CALL_STALE_AFTER_MS,
    CALL_USER_AWAY_MS,
    MAX_CALL_SIGNALS,
    isLiveStatus,
    isRingingStatus,
    isTerminalStatus,
    type CallDoorbell,
    type CallEndReason,
    type CallLogData,
    type CallMode,
    type CallOutcome,
    type CallRole,
    type CallSignal,
    type CallStatus,
    type CallView,
    type ClientEndReason,
} from "./call";

/** What is stored at calls/{callId}. Times are epoch milliseconds from the server's clock. */
export interface CallRecord {
    id: string;
    chatId: string;
    callerId: string;
    calleeId: string;
    callerName: string;
    calleeName: string;
    mode: CallMode;
    status: CallStatus;
    createdAt: number;
    ringExpiresAt: number;
    answeredAt: number | null;
    connectedAt: number | null;
    endedAt: number | null;
    /** User id of whoever ended it; null when the system did (timeouts, vanished browsers). */
    endedBy: string | null;
    endReason: CallEndReason | null;
    /** Last time each participant's browser reported in. The callee's is null until it has. */
    callerSeenAt: number;
    calleeSeenAt: number | null;
    /** Highest signal number handed out so far. */
    signalSeq: number;
    /** Doorbell counters: `revs[userId]` moves whenever there is news for that user. */
    revs: Record<string, number>;
}

export interface NewCallInput {
    id: string;
    chatId: string;
    callerId: string;
    calleeId: string;
    callerName: string;
    calleeName: string;
    mode: CallMode;
}

/** Extra time the server waits, over the browsers' own timeout, before it gives up on a connecting call. */
const CONNECT_GRACE_MS = 10_000;

/* -------------------------------------------------------------------------------------------------
 * Small helpers
 * ---------------------------------------------------------------------------------------------- */

export function roleOf(call: Pick<CallRecord, "callerId" | "calleeId">, userId: string): CallRole | null {
    if (call.callerId === userId) return "caller";
    if (call.calleeId === userId) return "callee";
    return null;
}

export function peerIdOf(call: Pick<CallRecord, "callerId" | "calleeId">, userId: string): string {
    return call.callerId === userId ? call.calleeId : call.callerId;
}

/** "There is news for `userIds`": their doorbell counters move. */
export function notifyUsers(call: CallRecord, ...userIds: string[]): CallRecord {
    const revs = { ...call.revs };
    for (const userId of userIds) revs[userId] = (revs[userId] ?? 0) + 1;
    return { ...call, revs };
}

const notifyBoth = (call: CallRecord) => notifyUsers(call, call.callerId, call.calleeId);

function finish(
    call: CallRecord,
    status: Exclude<CallStatus, "calling" | "ringing" | "connecting" | "active">,
    reason: CallEndReason,
    endedBy: string | null,
    endedAt: number
): CallRecord {
    return notifyBoth({
        ...call,
        status,
        endReason: reason,
        endedBy,
        endedAt: Math.max(endedAt, call.createdAt),
    });
}

/* -------------------------------------------------------------------------------------------------
 * Creating a call
 * ---------------------------------------------------------------------------------------------- */

export function createCall(input: NewCallInput, now: number): CallRecord {
    return {
        ...input,
        status: "calling",
        createdAt: now,
        ringExpiresAt: now + CALL_RING_TIMEOUT_MS,
        answeredAt: null,
        connectedAt: null,
        endedAt: null,
        endedBy: null,
        endReason: null,
        callerSeenAt: now,
        calleeSeenAt: null,
        signalSeq: 0,
        revs: { [input.callerId]: 0, [input.calleeId]: 0 },
    };
}

/** A call to someone who is already in another call: it never rings, it is finished the moment it exists. */
export function createBusyCall(input: NewCallInput, now: number): CallRecord {
    return {
        ...createCall(input, now),
        status: "busy",
        ringExpiresAt: now,
        endedAt: now,
        endReason: "busy",
    };
}

/* -------------------------------------------------------------------------------------------------
 * Time rules
 * ---------------------------------------------------------------------------------------------- */

/** The record as it is at `now`: an expired ring is missed, a call nobody reports on any more has ended. */
export function settleByTime(call: CallRecord, now: number): CallRecord {
    switch (call.status) {
        case "calling":
        case "ringing":
            return now >= call.ringExpiresAt ? finish(call, "missed", "no_answer", null, call.ringExpiresAt) : call;
        case "connecting": {
            const deadline = (call.answeredAt ?? call.createdAt) + CALL_CONNECT_TIMEOUT_MS + CONNECT_GRACE_MS;
            if (now >= deadline) return finish(call, "ended", "connection_failed", null, deadline);
            return settleStale(call, now);
        }
        case "active":
            return settleStale(call, now);
        default:
            return call;
    }
}

function settleStale(call: CallRecord, now: number): CallRecord {
    const lastSeen = Math.min(call.callerSeenAt, call.calleeSeenAt ?? call.answeredAt ?? call.createdAt);
    return now - lastSeen >= CALL_STALE_AFTER_MS
        ? finish(call, "ended", "stale", null, lastSeen + CALL_STALE_AFTER_MS)
        : call;
}

/**
 * Has this person's browser stopped reporting, i.e. is their page gone? A ringing callee reports
 * nothing until they answer (the ring timeout covers them), so they are never "away" while it rings.
 */
export function isUserAway(call: CallRecord, userId: string, now: number): boolean {
    if (!isLiveStatus(call.status)) return false;

    switch (roleOf(call, userId)) {
        case "caller":
            return now - call.callerSeenAt >= CALL_USER_AWAY_MS;
        case "callee":
            if (isRingingStatus(call.status)) return false;
            return now - (call.calleeSeenAt ?? call.answeredAt ?? call.createdAt) >= CALL_USER_AWAY_MS;
        default:
            return false;
    }
}

/* -------------------------------------------------------------------------------------------------
 * Events
 * ---------------------------------------------------------------------------------------------- */

export type CallEvent =
    /** Nothing happened; apply the time rules only. */
    | { type: "tick" }
    /** The system found `userId`'s browser gone: whatever call it was in is over. */
    | { type: "release"; userId: string }
    /** The callee's browser is showing the call (ringing). */
    | { type: "ringing"; actorId: string }
    | { type: "accept"; actorId: string }
    | { type: "decline"; actorId: string }
    /** Hang up: cancels a call that is ringing, ends one that was answered. */
    | { type: "end"; actorId: string; reason: ClientEndReason }
    /** Media is flowing. */
    | { type: "connected"; actorId: string }
    | { type: "heartbeat"; actorId: string }
    /** The actor wants to send `count` signaling messages to the other side. */
    | { type: "signal"; actorId: string; count: number };

export interface Violation {
    code: string;
    message: string;
    status: number;
}

export type Transition =
    /**
     * `call` is the record to store. `applied` says whether the event itself took effect: a repeat
     * (double click, retried request) or an event that arrived too late is still `ok`, just not applied.
     */
    | { ok: true; call: CallRecord; applied: boolean }
    | { ok: false; error: Violation };

const ok = (call: CallRecord, applied: boolean): Transition => ({ ok: true, call, applied });
const fail = (code: string, message: string, status: number): Transition => ({
    ok: false,
    error: { code, message, status },
});

const ONLY_CALLEE = fail("NOT_THE_CALLEE", "Only the person being called can do that.", 403);

/** A request from a participant proves their browser is alive (only while the call is live). */
function markSeen(call: CallRecord, role: CallRole, now: number): CallRecord {
    if (!isLiveStatus(call.status)) return call;
    return role === "caller" ? { ...call, callerSeenAt: now } : { ...call, calleeSeenAt: now };
}

export function applyCallEvent(call: CallRecord, event: CallEvent, now: number): Transition {
    const actorId = "actorId" in event ? event.actorId : null;
    const role = actorId === null ? null : roleOf(call, actorId);
    if (actorId !== null && role === null) {
        return fail("NOT_A_PARTICIPANT", "You are not part of this call.", 403);
    }

    const seen = role ? markSeen(call, role, now) : call;
    const current = settleByTime(seen, now);
    // The time rules just ended the call: whatever the event wanted, it came too late.
    if (current !== seen) return ok(current, event.type === "tick");

    switch (event.type) {
        case "tick":
            return ok(current, false);

        case "release": {
            if (!isUserAway(current, event.userId, now)) return ok(current, false);
            return ok(
                isRingingStatus(current.status)
                    ? finish(current, "cancelled", "page_closed", null, now)
                    : finish(current, "ended", "stale", null, now),
                true
            );
        }

        case "heartbeat":
            return ok(current, true);

        case "ringing":
            if (role !== "callee") return ONLY_CALLEE;
            return current.status === "calling"
                ? ok(notifyBoth({ ...current, status: "ringing" }), true)
                : ok(current, false);

        case "accept":
            if (role !== "callee") return ONLY_CALLEE;
            return isRingingStatus(current.status)
                ? ok(notifyBoth({ ...current, status: "connecting", answeredAt: now, calleeSeenAt: now }), true)
                : ok(current, false);

        case "decline":
            if (role !== "callee") return ONLY_CALLEE;
            if (isRingingStatus(current.status)) return ok(finish(current, "declined", "declined", actorId, now), true);
            if (isLiveStatus(current.status)) {
                return fail("CALL_ALREADY_ANSWERED", "This call was already answered.", 409);
            }
            return ok(current, false);

        case "end":
            if (isRingingStatus(current.status)) {
                return ok(
                    role === "caller"
                        ? finish(current, "cancelled", "cancelled", actorId, now)
                        : finish(current, "declined", "declined", actorId, now),
                    true
                );
            }
            if (isLiveStatus(current.status)) return ok(finish(current, "ended", event.reason, actorId, now), true);
            return ok(current, false);

        case "connected":
            if (current.status === "connecting") {
                return ok(notifyBoth({ ...current, status: "active", connectedAt: now }), true);
            }
            if (isRingingStatus(current.status)) {
                return fail("CALL_NOT_ANSWERED", "This call hasn't been answered yet.", 409);
            }
            return ok(current, false);

        case "signal":
            if (isTerminalStatus(current.status)) return ok(current, false);
            // The callee has nothing to say until they answered.
            if (role === "callee" && isRingingStatus(current.status)) {
                return fail("CALL_NOT_ANSWERED", "Answer the call before sending signals.", 409);
            }
            if (current.signalSeq + event.count > MAX_CALL_SIGNALS) {
                return fail("TOO_MANY_SIGNALS", "Too many signaling messages for one call.", 429);
            }
            return ok(current, true);
    }
}

/** Reserves `count` signal numbers for `toUserId`: returns the record to store and the first number. */
export function reserveSignals(call: CallRecord, toUserId: string, count: number): { call: CallRecord; firstSeq: number } {
    return {
        call: notifyUsers({ ...call, signalSeq: call.signalSeq + count }, toUserId),
        firstSeq: call.signalSeq + 1,
    };
}

/* -------------------------------------------------------------------------------------------------
 * What leaves the server
 * ---------------------------------------------------------------------------------------------- */

export function toCallDoorbell(call: CallRecord): CallDoorbell {
    return {
        id: call.id,
        mode: call.mode,
        status: call.status,
        callerId: call.callerId,
        calleeId: call.calleeId,
        revs: call.revs,
    };
}

/** The call as `viewerId` sees it. The viewer must be one of the two participants. */
export function toCallView(call: CallRecord, viewerId: string, signals: CallSignal[]): CallView {
    const role = roleOf(call, viewerId) ?? "caller";
    const terminal = isTerminalStatus(call.status);

    return {
        id: call.id,
        chatId: call.chatId,
        role,
        mode: call.mode,
        status: call.status,
        peer:
            role === "caller"
                ? { id: call.calleeId, name: call.calleeName }
                : { id: call.callerId, name: call.callerName },
        createdAt: call.createdAt,
        ringExpiresAt: call.ringExpiresAt,
        answeredAt: call.answeredAt,
        connectedAt: call.connectedAt,
        endedAt: call.endedAt,
        endedBy: !terminal ? null : call.endedBy === null ? "system" : call.endedBy === viewerId ? "me" : "peer",
        endReason: call.endReason,
        rev: call.revs[viewerId] ?? 0,
        signals,
    };
}

/** The conversation entry for a finished call. */
export function toCallLog(call: CallRecord): CallLogData {
    let outcome: CallOutcome;
    switch (call.status) {
        case "declined":
            outcome = "declined";
            break;
        case "missed":
            outcome = "missed";
            break;
        case "cancelled":
            outcome = "cancelled";
            break;
        case "busy":
            outcome = "busy";
            break;
        case "ended":
            outcome = call.connectedAt !== null ? "completed" : "failed";
            break;
        default:
            outcome = "failed";
    }

    const duration =
        outcome === "completed" && call.connectedAt !== null && call.endedAt !== null
            ? Math.max(0, Math.round((call.endedAt - call.connectedAt) / 1000))
            : 0;

    return { callId: call.id, mode: call.mode, outcome, duration };
}

/** A call nobody picked up is news for the callee: it counts as one unread event, like a message. */
export function isMissedForCallee(outcome: CallOutcome): boolean {
    return outcome === "missed" || outcome === "cancelled" || outcome === "busy";
}
