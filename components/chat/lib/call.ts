/**
 * Voice / video calls: the types, limits and pure helpers shared by the browser (call controller + UI)
 * and the server (app/api/chat/calls). Nothing in here touches the DOM or firebase-admin.
 *
 * How a call works (server: ./callOperations.server.ts, rules: ./callMachine.ts, browser: ./callController.ts):
 *   - Media is peer to peer (WebRTC). The server relays the signaling (SDP + ICE candidates) and owns the
 *     call's state machine, so a browser can never push a call into a state it isn't allowed to.
 *   - Signaling travels over the authenticated API, like every other chat mutation. Firestore only carries
 *     a tiny "doorbell" (`chats/{chatId}.call`) that says "something changed for you, ask the API", so no
 *     SDP and no IP address ever sits in a client-readable document.
 *   - Every finished call leaves one entry in the conversation (a message with `type: "call"`).
 */
import { formatDuration } from "./attachments";

export const CALLS_API_URL = "/api/chat/calls";
export const CALL_ICE_API_URL = "/api/chat/calls/ice";

/** Firestore collections. Both are written by the server only; browsers never read them. */
export const CALLS_COLLECTION = "calls";
export const CALL_PRESENCE_COLLECTION = "callPresence";

/** How long an unanswered call rings before it becomes a missed call. */
export const CALL_RING_TIMEOUT_MS = 45_000;
/** A browser that is in a call reports in this often. */
export const CALL_HEARTBEAT_MS = 15_000;
/** A call whose participant hasn't reported for this long is closed by the server. */
export const CALL_STALE_AFTER_MS = 60_000;
/** Someone who hasn't reported for this long is no longer "in" their call (their page is gone). */
export const CALL_USER_AWAY_MS = 30_000;
/** After answering, the media must be flowing within this time or the call is given up. */
export const CALL_CONNECT_TIMEOUT_MS = 30_000;
/** A dropped connection gets this long to recover before the call ends. */
export const CALL_RECONNECT_TIMEOUT_MS = 20_000;

/** Upper bounds that keep one call (and one request) small. */
export const MAX_CALL_SIGNALS = 300;
export const MAX_SDP_LENGTH = 64_000;
export const MAX_SIGNALS_PER_REQUEST = 40;

export type CallMode = "audio" | "video";
export type CallRole = "caller" | "callee";

/**
 * calling     placed; the callee's browser hasn't confirmed it is showing the call yet
 * ringing     the callee's browser is ringing
 * connecting  answered; media is being set up
 * active      media is flowing
 * everything else is final: ended (hung up after answering), declined, missed (nobody answered),
 * cancelled (the caller gave up while it rang), busy (the callee was in another call)
 */
export type CallStatus =
    | "calling"
    | "ringing"
    | "connecting"
    | "active"
    | "ended"
    | "declined"
    | "missed"
    | "cancelled"
    | "busy";

export const CALL_END_REASONS = [
    "hangup",
    "declined",
    "no_answer",
    "cancelled",
    "busy",
    "connection_lost",
    "connection_failed",
    "media_error",
    "page_closed",
    "stale",
] as const;
export type CallEndReason = (typeof CALL_END_REASONS)[number];

/** The reasons a browser may report for ending a call; the rest are decided by the server. */
export const CLIENT_END_REASONS = [
    "hangup",
    "connection_lost",
    "connection_failed",
    "media_error",
    "page_closed",
] as const;
export type ClientEndReason = (typeof CLIENT_END_REASONS)[number];

/** How a finished call is shown in the conversation. */
export type CallOutcome = "completed" | "missed" | "cancelled" | "declined" | "busy" | "failed";

const LIVE_STATUSES: ReadonlySet<CallStatus> = new Set(["calling", "ringing", "connecting", "active"]);

/** Not finished yet. */
export const isLiveStatus = (status: CallStatus): boolean => LIVE_STATUSES.has(status);
/** Finished. */
export const isTerminalStatus = (status: CallStatus): boolean => !LIVE_STATUSES.has(status);
/** Placed but not answered yet. */
export const isRingingStatus = (status: CallStatus): boolean => status === "calling" || status === "ringing";

const STATUSES: ReadonlySet<string> = new Set<CallStatus>([
    "calling",
    "ringing",
    "connecting",
    "active",
    "ended",
    "declined",
    "missed",
    "cancelled",
    "busy",
]);
export const isCallStatus = (value: unknown): value is CallStatus => typeof value === "string" && STATUSES.has(value);

/* -------------------------------------------------------------------------------------------------
 * Signaling
 * ---------------------------------------------------------------------------------------------- */

export interface CallOffer {
    type: "offer";
    sdp: string;
}

export interface CallAnswer {
    type: "answer";
    sdp: string;
}

export type CallSessionDescription = CallOffer | CallAnswer;

export interface CallIceCandidate {
    candidate: string;
    sdpMid?: string | null;
    sdpMLineIndex?: number | null;
    usernameFragment?: string | null;
}

/** One signaling message addressed to the viewer. `seq` only ever grows within a call. */
export type CallSignal =
    | { seq: number; type: "offer"; data: CallOffer }
    | { seq: number; type: "answer"; data: CallAnswer }
    | { seq: number; type: "candidate"; data: CallIceCandidate };

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
/** A signal before the server numbered it. */
export type CallSignalInput = DistributiveOmit<CallSignal, "seq">;

/** What the browser needs to build its RTCPeerConnection (GET /api/chat/calls/ice). */
export interface CallIceServer {
    urls: string | string[];
    username?: string;
    credential?: string;
}

/* -------------------------------------------------------------------------------------------------
 * What the API returns
 * ---------------------------------------------------------------------------------------------- */

export interface CallPeer {
    id: string;
    name: string;
}

/** A call as one of its two participants sees it. All times are epoch milliseconds (server clock). */
export interface CallView {
    id: string;
    chatId: string;
    role: CallRole;
    mode: CallMode;
    status: CallStatus;
    peer: CallPeer;
    createdAt: number;
    ringExpiresAt: number;
    answeredAt: number | null;
    connectedAt: number | null;
    endedAt: number | null;
    endedBy: "me" | "peer" | "system" | null;
    endReason: CallEndReason | null;
    /** The viewer's doorbell counter as of this view: a doorbell with a higher number means news. */
    rev: number;
    /** Signals addressed to the viewer that are newer than the `after` cursor, oldest first. */
    signals: CallSignal[];
}

export interface CallResponse {
    success: true;
    call: CallView | null;
    /** The server's clock when it answered; browsers use it to correct for a wrong local clock. */
    serverNow: number;
}

export interface CallIceResponse {
    success: true;
    iceServers: CallIceServer[];
}

/* -------------------------------------------------------------------------------------------------
 * The doorbell: chats/{chatId}.call
 * ---------------------------------------------------------------------------------------------- */

/**
 * Written by the server next to every change of a call. It is public-safe (no SDP, no addresses) and
 * only says that something happened: each user has their own counter in `revs`, which moves when there
 * is news for THAT user, so nobody is woken up by their own signals.
 */
export interface CallDoorbell {
    id: string;
    mode: CallMode;
    status: CallStatus;
    callerId: string;
    calleeId: string;
    revs: Record<string, number>;
}

/** Is `value` the `call` field of a chat document? Tolerant on purpose: it comes from Firestore. */
export function parseCallDoorbell(value: unknown): CallDoorbell | null {
    if (!value || typeof value !== "object") return null;
    const { id, mode, status, callerId, calleeId, revs } = value as Record<string, unknown>;
    if (typeof id !== "string" || typeof callerId !== "string" || typeof calleeId !== "string") return null;
    if (mode !== "audio" && mode !== "video") return null;
    if (!isCallStatus(status)) return null;
    if (!revs || typeof revs !== "object") return null;

    const counters: Record<string, number> = {};
    for (const [userId, rev] of Object.entries(revs as Record<string, unknown>)) {
        if (typeof rev === "number" && Number.isFinite(rev)) counters[userId] = rev;
    }
    return { id, mode, status, callerId, calleeId, revs: counters };
}

/* -------------------------------------------------------------------------------------------------
 * The call entry in the conversation
 * ---------------------------------------------------------------------------------------------- */

/** Stored on the message (`call`) and rendered by the UI. */
export interface CallLogData {
    callId: string;
    mode: CallMode;
    outcome: CallOutcome;
    /** Talk time in seconds. 0 unless the call was completed. */
    duration: number;
}

const OUTCOMES: ReadonlySet<string> = new Set<CallOutcome>(["completed", "missed", "cancelled", "declined", "busy", "failed"]);

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const kindOf = (mode: CallMode) => (mode === "video" ? "video" : "voice");

/**
 * Text for the chat's `lastMessage` (sidebar). One string serves both people, so it is worded
 * neutrally: "Missed voice call", "Video call (2:31)"...
 */
export function getCallPreview({ mode, outcome, duration }: Pick<CallLogData, "mode" | "outcome" | "duration">): string {
    const icon = mode === "video" ? "📹" : "📞";
    const noun = `${kindOf(mode)} call`;

    switch (outcome) {
        case "completed": {
            const length = formatDuration(duration);
            return length ? `${icon} ${capitalize(noun)} (${length})` : `${icon} ${capitalize(noun)}`;
        }
        case "missed":
        case "cancelled":
        case "busy":
            return `${icon} Missed ${noun}`;
        case "declined":
            return `${icon} Declined ${noun}`;
        default:
            return `${icon} ${capitalize(noun)} failed`;
    }
}

export interface CallLogDescription {
    title: string;
    detail: string;
    /** ok: it happened; missed: the viewer missed it; neutral: nothing needs the viewer's attention. */
    tone: "ok" | "missed" | "neutral";
    canCallBack: boolean;
}

/** How a call entry reads for the person looking at it. `outgoing` = they placed the call. */
export function describeCallLog(call: CallLogData, outgoing: boolean): CallLogDescription {
    const kind = kindOf(call.mode);
    const base = `${outgoing ? "Outgoing" : "Incoming"} ${kind} call`;
    const missed = (detail: string): CallLogDescription => ({ title: `Missed ${kind} call`, detail, tone: "missed", canCallBack: true });

    switch (call.outcome) {
        case "completed":
            return { title: base, detail: formatDuration(call.duration) || "Ended", tone: "ok", canCallBack: false };
        case "missed":
            return outgoing ? { title: base, detail: "No answer", tone: "neutral", canCallBack: true } : missed("");
        case "cancelled":
            return outgoing ? { title: base, detail: "Cancelled", tone: "neutral", canCallBack: true } : missed("");
        case "busy":
            return outgoing
                ? { title: base, detail: "Busy", tone: "neutral", canCallBack: true }
                : missed("You were on another call");
        case "declined":
            return { title: base, detail: "Declined", tone: "neutral", canCallBack: true };
        default:
            return { title: base, detail: "Couldn't connect", tone: "neutral", canCallBack: true };
    }
}

/** Is `value` the stored `call` field of a call message? Tolerant on purpose: it comes from Firestore. */
export function parseCallLog(value: unknown): CallLogData | null {
    if (!value || typeof value !== "object") return null;
    const { callId, mode, outcome, duration } = value as Record<string, unknown>;
    if (typeof callId !== "string") return null;
    if (mode !== "audio" && mode !== "video") return null;
    if (typeof outcome !== "string" || !OUTCOMES.has(outcome)) return null;
    return {
        callId,
        mode,
        outcome: outcome as CallOutcome,
        duration: typeof duration === "number" && duration > 0 ? Math.round(duration) : 0,
    };
}
