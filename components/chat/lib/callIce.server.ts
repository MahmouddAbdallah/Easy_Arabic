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
 *   WEBRTC_TURN_TTL_SECONDS  lifetime of the short-lived credentials: 4 hours by default, between 1 hour and 24.
 *                            A relayed call that outlives its credentials is cut when the relay next asks for
 *                            them (about every 10 minutes), so this should comfortably exceed the longest call.
 *
 * Whatever the source, the list is checked (see ./callIce.ts) before it goes out: one malformed url, or a TURN url
 * without credentials, would make the browser refuse to start any call at all. What is left out is logged once.
 */
import { createHmac } from "node:crypto";
import { z } from "zod";
import type { CallIceServer } from "./call";
import { isTurnUrl, sanitizeIceServers } from "./callIce";

const DEFAULT_STUN_URLS = [
    "stun:stun.l.google.com:19302",
    "stun:stun1.l.google.com:19302",
    "stun:stun.cloudflare.com:3478",
];
const DEFAULT_TURN_TTL_SECONDS = 4 * 60 * 60;
/** The browser refreshes the servers of a call after 30 minutes (see ICE_SERVERS_MAX_AGE_MS): shorter lives would expire first. */
const MIN_TURN_TTL_SECONDS = 60 * 60;
const MAX_TURN_TTL_SECONDS = 24 * 60 * 60;
/** Browsers warn at five or more urls: every one is another round of probing before the first relay candidate. */
const MANY_URLS = 5;
const WEAK_SECRET_LENGTH = 16;

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

/** Each distinct message is logged once per process, not on every request. */
const reported = new Set<string>();
const report = (level: "warn" | "error", message: string) => {
    if (reported.has(message)) return;
    reported.add(message);
    console[level](`[chat/calls] ${message}`);
};

/** Why the setup may not reach everyone, in words an operator can act on. */
function reviewSetup(servers: CallIceServer[]): void {
    const urls = servers.flatMap(({ urls }) => (Array.isArray(urls) ? urls : [urls]));
    const turn = urls.filter(isTurnUrl);

    if (turn.length === 0) {
        report(
            "warn",
            "No TURN server configured (WEBRTC_TURN_URLS): calls between people behind strict firewalls or " +
                "symmetric NATs will not connect. See components/chat/lib/callIce.server.ts."
        );
    } else if (!turn.some((url) => /^turns:/i.test(url) || /transport=tcp/i.test(url))) {
        report("warn", "The TURN server is reachable over UDP only: networks that block UDP can't use the relay. Add a turns: url on port 443.");
    } else if (!turn.some((url) => /^turns:/i.test(url))) {
        report("warn", "The TURN server has no turns: (TLS) url: networks that only allow HTTPS (port 443) can't use the relay.");
    }

    if (urls.length >= MANY_URLS) {
        report("warn", `${urls.length} STUN/TURN urls are configured: browsers warn from ${MANY_URLS}, and gathering gets slower with each one.`);
    }
}

/** The finished list: checked, reviewed, and never empty. */
function finish(servers: CallIceServer[]): CallIceServer[] {
    const { servers: usable, problems } = sanitizeIceServers(servers);
    problems.forEach((problem) => report("error", `${problem}; it is not used.`));
    const result = usable.length > 0 ? usable : [{ urls: DEFAULT_STUN_URLS }];
    reviewSetup(result);
    return result;
}

/** The ICE servers for `userId`, built from the environment. Never throws. */
export function getIceServers(userId: string, now: number = Date.now()): CallIceServer[] {
    const env = process.env;

    if (env.WEBRTC_ICE_SERVERS) {
        try {
            const parsed = iceServersSchema.safeParse(JSON.parse(env.WEBRTC_ICE_SERVERS));
            if (parsed.success && parsed.data.length > 0) return finish(parsed.data);
            report("error", "WEBRTC_ICE_SERVERS is not a valid list of ICE servers; ignoring it.");
        } catch {
            report("error", "WEBRTC_ICE_SERVERS is not valid JSON; ignoring it.");
        }
    }

    const stun = urlList(env.WEBRTC_STUN_URLS);
    const servers: CallIceServer[] = [{ urls: stun.length > 0 ? stun : DEFAULT_STUN_URLS }];

    const turnUrls = urlList(env.WEBRTC_TURN_URLS);
    if (turnUrls.length > 0) {
        if (env.WEBRTC_TURN_SECRET) {
            if (env.WEBRTC_TURN_SECRET.length < WEAK_SECRET_LENGTH) {
                report("warn", `WEBRTC_TURN_SECRET is shorter than ${WEAK_SECRET_LENGTH} characters: anyone who guesses it can use your relay.`);
            }
            const requested = Number(env.WEBRTC_TURN_TTL_SECONDS);
            const ttl = Math.min(MAX_TURN_TTL_SECONDS, Math.max(MIN_TURN_TTL_SECONDS, requested > 0 ? requested : DEFAULT_TURN_TTL_SECONDS));
            // coturn: username = "<expiry unix time>:<anything>", credential = base64(HMAC-SHA1(secret, username))
            const username = `${Math.floor(now / 1000) + ttl}:${userId}`;
            const credential = createHmac("sha1", env.WEBRTC_TURN_SECRET).update(username).digest("base64");
            servers.push({ urls: turnUrls, username, credential });
        } else if (env.WEBRTC_TURN_USERNAME && env.WEBRTC_TURN_CREDENTIAL) {
            report("warn", "The TURN server uses one static account that every user shares. Prefer WEBRTC_TURN_SECRET: its credentials expire.");
            servers.push({ urls: turnUrls, username: env.WEBRTC_TURN_USERNAME, credential: env.WEBRTC_TURN_CREDENTIAL });
        } else {
            report("error", "WEBRTC_TURN_URLS is set without credentials; the TURN server is not used.");
        }
    }

    return finish(servers);
}
