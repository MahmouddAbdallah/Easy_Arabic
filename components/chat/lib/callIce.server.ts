/**
 * SERVER ONLY. Which STUN/TURN servers the browsers use to reach each other (GET /api/chat/calls/ice).
 *
 * Out of the box calls use public STUN servers, which connect most people. Anyone behind a strict
 * firewall or a symmetric NAT (many offices, some mobile carriers) can only be reached through a TURN
 * relay, so a production deployment should configure one. Environment variables, first match wins:
 *
 *   WEBRTC_ICE_SERVERS       a JSON array of ICE servers, used as is:
 *                            [{"urls":"stun:..."},{"urls":["turn:..."],"username":"..","credential":".."}]
 *   WEBRTC_STUN_URLS         comma separated STUN urls (replaces the public defaults)
 *   WEBRTC_TURN_URLS         comma separated turn:/turns: urls, with either
 *     WEBRTC_TURN_SECRET       the shared secret of a coturn `use-auth-secret` server: every user gets
 *                              short-lived credentials (the standard "TURN REST API" scheme), or
 *     WEBRTC_TURN_USERNAME / WEBRTC_TURN_CREDENTIAL   one static account
 *   WEBRTC_TURN_TTL_SECONDS  lifetime of the short-lived credentials (default 1 hour)
 */
import { createHmac } from "node:crypto";
import { z } from "zod";
import type { CallIceServer } from "./call";

const DEFAULT_STUN_URLS = [
    "stun:stun.l.google.com:19302",
    "stun:stun1.l.google.com:19302",
    "stun:stun.cloudflare.com:3478",
];
const DEFAULT_TURN_TTL_SECONDS = 60 * 60;

const iceServersSchema = z.array(
    z.object({
        urls: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]),
        username: z.string().optional(),
        credential: z.string().optional(),
    })
);

const urlList = (value: string | undefined): string[] =>
    (value ?? "")
        .split(/[\s,]+/)
        .map((url) => url.trim())
        .filter(Boolean);

let warnedAboutRelay = false;
const warnOnce = (message: string) => {
    if (warnedAboutRelay) return;
    warnedAboutRelay = true;
    console.warn(`[chat/calls] ${message}`);
};

/** The ICE servers for `userId`, built from the environment. Never throws. */
export function getIceServers(userId: string, now: number = Date.now()): CallIceServer[] {
    const env = process.env;

    if (env.WEBRTC_ICE_SERVERS) {
        try {
            const parsed = iceServersSchema.safeParse(JSON.parse(env.WEBRTC_ICE_SERVERS));
            if (parsed.success && parsed.data.length > 0) return parsed.data;
            console.error("[chat/calls] WEBRTC_ICE_SERVERS is not a valid list of ICE servers; ignoring it.");
        } catch {
            console.error("[chat/calls] WEBRTC_ICE_SERVERS is not valid JSON; ignoring it.");
        }
    }

    const stun = urlList(env.WEBRTC_STUN_URLS);
    const servers: CallIceServer[] = [{ urls: stun.length > 0 ? stun : DEFAULT_STUN_URLS }];

    const turnUrls = urlList(env.WEBRTC_TURN_URLS);
    if (turnUrls.length > 0) {
        if (env.WEBRTC_TURN_SECRET) {
            const ttl = Number(env.WEBRTC_TURN_TTL_SECONDS) > 0 ? Number(env.WEBRTC_TURN_TTL_SECONDS) : DEFAULT_TURN_TTL_SECONDS;
            // coturn: username = "<expiry unix time>:<anything>", credential = base64(HMAC-SHA1(secret, username))
            const username = `${Math.floor(now / 1000) + ttl}:${userId}`;
            const credential = createHmac("sha1", env.WEBRTC_TURN_SECRET).update(username).digest("base64");
            servers.push({ urls: turnUrls, username, credential });
        } else if (env.WEBRTC_TURN_USERNAME && env.WEBRTC_TURN_CREDENTIAL) {
            servers.push({ urls: turnUrls, username: env.WEBRTC_TURN_USERNAME, credential: env.WEBRTC_TURN_CREDENTIAL });
        } else {
            console.error("[chat/calls] WEBRTC_TURN_URLS is set without credentials; the TURN server is not used.");
        }
    } else {
        warnOnce(
            "No TURN server configured (WEBRTC_TURN_URLS): calls between people behind strict firewalls or " +
                "symmetric NATs will not connect. See components/chat/lib/callIce.server.ts."
        );
    }

    return servers;
}
