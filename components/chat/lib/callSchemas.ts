import { z } from "zod";
import { CLIENT_END_REASONS, MAX_SDP_LENGTH, MAX_SIGNALS_PER_REQUEST } from "./call";
import { firestoreId } from "./schemas";

/**
 * Request schemas for /api/chat/calls. The browser only needs the inferred types (`import type`),
 * so zod never reaches the client bundle. Unknown keys are rejected, so a typo fails loudly.
 */

// A real SDP always starts with its version line; anything else is junk we refuse to store.
const sdp = z
    .string()
    .min(20)
    .max(MAX_SDP_LENGTH)
    .refine((value) => value.startsWith("v=0"), "Invalid session description");

const offer = z.strictObject({ type: z.literal("offer"), sdp });
const answer = z.strictObject({ type: z.literal("answer"), sdp });

const iceCandidate = z.strictObject({
    candidate: z.string().min(1).max(2048),
    sdpMid: z.string().max(128).nullable().optional(),
    sdpMLineIndex: z.number().int().min(0).max(255).nullable().optional(),
    usernameFragment: z.string().max(128).nullable().optional(),
});

const signal = z.discriminatedUnion("type", [
    z.strictObject({ type: z.literal("candidate"), data: iceCandidate }),
    z.strictObject({ type: z.literal("offer"), data: offer }),
    z.strictObject({ type: z.literal("answer"), data: answer }),
]);

/** The caller's cursor: the highest signal number it has already processed. */
const after = z.number().int().min(0).max(1_000_000).optional();
const callId = firestoreId;

/**
 * Body of POST /api/chat/calls: a discriminated union on `action`. The acting user always comes from
 * the session, never from the body.
 *
 *   start      place a call, with the caller's first offer
 *   ringing    the callee's browser is showing the call
 *   accept     answer it, with the callee's answer
 *   decline    the callee says no
 *   end        hang up (cancels a ringing call)
 *   connected  media is flowing
 *   heartbeat  "I'm still here"; also returns anything new
 *   signal     ICE candidates (and renegotiation offers/answers) for the other side
 */
export const CallRequestSchema = z.discriminatedUnion("action", [
    z.strictObject({ action: z.literal("start"), receiverId: firestoreId, mode: z.enum(["audio", "video"]), offer }),
    z.strictObject({ action: z.literal("ringing"), callId, after }),
    z.strictObject({ action: z.literal("accept"), callId, answer, after }),
    z.strictObject({ action: z.literal("decline"), callId }),
    z.strictObject({
        action: z.literal("end"),
        callId,
        reason: z.enum(CLIENT_END_REASONS).default("hangup"),
    }),
    z.strictObject({ action: z.literal("connected"), callId, after }),
    z.strictObject({ action: z.literal("heartbeat"), callId, after }),
    z.strictObject({
        action: z.literal("signal"),
        callId,
        signals: z.array(signal).min(1).max(MAX_SIGNALS_PER_REQUEST),
        after,
    }),
]);

export type CallRequest = z.output<typeof CallRequestSchema>;
export type CallRequestInput = z.input<typeof CallRequestSchema>;

/** Query string of GET /api/chat/calls: one call by id, or (no id) the call the user is in right now. */
export const CallQuerySchema = z.object({
    callId: firestoreId.optional(),
    after: z.coerce.number().int().min(0).max(1_000_000).optional(),
});
