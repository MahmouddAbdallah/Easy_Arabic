import axios from "axios";
import {
    CALLS_API_URL,
    CALL_ICE_API_URL,
    type CallIceResponse,
    type CallIceServer,
    type CallMode,
    type CallAnswer,
    type CallOffer,
    type CallResponse,
    type CallSignalInput,
    type ClientEndReason,
} from "./call";
import type { CallRequestInput } from "./callSchemas";

/** The browser's side of /api/chat/calls: one function per action, typed end to end. */

export type CallReply = Pick<CallResponse, "call" | "serverNow">;

const TIMEOUT_MS = 15_000;
const RETRY_DELAYS_MS = [400, 1200];

/** Used when /api/chat/calls/ice can't be reached: public STUN still connects most people. */
const FALLBACK_ICE_SERVERS: CallIceServer[] = [
    { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
];

/** No response at all: offline, timeout, dropped connection. */
const isNetworkError = (error: unknown) => axios.isAxiosError(error) && !error.response;

/**
 * Hang-ups, answers and acknowledgements are safe to repeat (the server treats a repeat as a no-op),
 * so a dropped connection gets a couple of quick retries instead of a stuck call.
 */
async function withRetry<T>(run: () => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
        try {
            return await run();
        } catch (error) {
            if (!isNetworkError(error) || attempt >= RETRY_DELAYS_MS.length) throw error;
            await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
        }
    }
}

async function post(body: CallRequestInput): Promise<CallReply> {
    const { data } = await axios.post<CallResponse>(CALLS_API_URL, body, { timeout: TIMEOUT_MS });
    return { call: data.call, serverNow: data.serverNow };
}

async function read(params: { callId?: string; after?: number }): Promise<CallReply> {
    const { data } = await axios.get<CallResponse>(CALLS_API_URL, { params, timeout: TIMEOUT_MS });
    return { call: data.call, serverNow: data.serverNow };
}

export const callApi = {
    /** Not retried: a repeat would be refused as "already in a call". */
    start: (receiverId: string, mode: CallMode, offer: CallOffer) =>
        post({ action: "start", receiverId, mode, offer }),

    ringing: (callId: string, after: number) => withRetry(() => post({ action: "ringing", callId, after })),

    accept: (callId: string, answer: CallAnswer, after: number) =>
        withRetry(() => post({ action: "accept", callId, answer, after })),

    decline: (callId: string) => withRetry(() => post({ action: "decline", callId })),

    end: (callId: string, reason: ClientEndReason = "hangup") => withRetry(() => post({ action: "end", callId, reason })),

    connected: (callId: string, after: number) => withRetry(() => post({ action: "connected", callId, after })),

    /** Not retried: the next beat is the retry. */
    heartbeat: (callId: string, after: number) => post({ action: "heartbeat", callId, after }),

    signal: (callId: string, signals: CallSignalInput[], after: number) =>
        withRetry(() => post({ action: "signal", callId, signals, after })),

    get: (callId: string, after: number) => read({ callId, after }),

    /** The call this user is in right now, if any. */
    current: () => read({}),

    /**
     * Fresh servers for a call that has been running a long time (TURN passwords expire). Quick, and null when
     * they can't be had, so the servers a call already has are never swapped for the public fallback.
     */
    async refreshIceServers(timeoutMs = 3_000): Promise<CallIceServer[] | null> {
        try {
            const { data } = await axios.get<CallIceResponse>(CALL_ICE_API_URL, { timeout: timeoutMs });
            return data.iceServers.length > 0 ? data.iceServers : null;
        } catch {
            return null;
        }
    },

    /** Never fails: without the server's answer the public STUN servers are used. */
    async iceServers(): Promise<CallIceServer[]> {
        try {
            const { data } = await axios.get<CallIceResponse>(CALL_ICE_API_URL, { timeout: 8_000 });
            return data.iceServers.length > 0 ? data.iceServers : FALLBACK_ICE_SERVERS;
        } catch {
            return FALLBACK_ICE_SERVERS;
        }
    },
};

/**
 * Hang up while the page is going away (tab closed, navigated, reloaded). A normal request would be
 * cancelled with the page; a beacon (or a keepalive fetch) is still delivered.
 */
export function endCallOnExit(callId: string, reason: ClientEndReason = "page_closed"): void {
    const payload = JSON.stringify({ action: "end", callId, reason } satisfies CallRequestInput);
    try {
        if (navigator.sendBeacon?.(CALLS_API_URL, new Blob([payload], { type: "application/json" }))) return;
    } catch {
        /* fall through to fetch */
    }
    void fetch(CALLS_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
        credentials: "same-origin",
    }).catch(() => undefined);
}
