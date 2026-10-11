import type { CallIceServer } from "./call";

/**
 * What a browser will accept as an ICE server, checked before it is handed to `new RTCPeerConnection`. Shared by the
 * server (which logs what it had to leave out) and the browser (which doesn't trust what the network brings).
 *
 * It matters because a single bad entry doesn't just lose that server: the browser refuses to build the whole
 * connection, and no call can start. Two typos are enough: a malformed url, or a `turn:` url without credentials.
 */

const HOST = String.raw`(?:\[[0-9a-f:.]+\]|[^\s/?:[\]]+)`;
const STUN_URL = new RegExp(`^stuns?:${HOST}(?::\\d{1,5})?$`, "i");
const TURN_URL = new RegExp(`^turns?:${HOST}(?::\\d{1,5})?(?:\\?transport=(?:udp|tcp))?$`, "i");

export const isTurnUrl = (url: string): boolean => /^turns?:/i.test(url);
export const isValidIceUrl = (url: string): boolean => (isTurnUrl(url) ? TURN_URL : STUN_URL).test(url);

const urlsOf = ({ urls }: CallIceServer): string[] =>
    [...new Set((Array.isArray(urls) ? urls : [urls]).map((url) => url.trim()).filter(Boolean))];

/** Is there a TURN server among `servers`? Without one, people behind strict firewalls can't be reached. */
export const hasRelayServer = (servers: readonly CallIceServer[]): boolean => servers.some((server) => urlsOf(server).some(isTurnUrl));

export interface SanitizedIceServers {
    servers: CallIceServer[];
    /** What was left out and why. Never includes a credential. */
    problems: string[];
}

/** Keeps the urls a browser accepts, and TURN urls only where there are credentials to go with them. */
export function sanitizeIceServers(servers: readonly CallIceServer[]): SanitizedIceServers {
    const kept: CallIceServer[] = [];
    const problems: string[] = [];

    for (const server of servers) {
        const valid: string[] = [];
        for (const url of urlsOf(server)) {
            if (isValidIceUrl(url)) valid.push(url);
            else problems.push(`"${url}" is not a valid STUN/TURN url`);
        }

        const hasCredentials = Boolean(server.username && server.credential);
        const usable = hasCredentials ? valid : valid.filter((url) => !isTurnUrl(url));
        for (const url of valid) {
            if (!usable.includes(url)) problems.push(`"${url}" has no username and credential`);
        }

        if (usable.length > 0) kept.push(hasCredentials ? { urls: usable, username: server.username, credential: server.credential } : { urls: usable });
    }

    return { servers: kept, problems };
}
