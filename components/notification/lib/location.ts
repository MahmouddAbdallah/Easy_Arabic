/**
 * Comparing "where" — shared by the server (does a live tab show the notification's link?) and the
 * browser (is the user already on it?). No server or browser imports.
 */

/**
 * Two links are the same place when they have the same path and the same query parameters:
 * "/chat/?b=2&a=1#top" and "/chat?a=1&b=2" match, "/chat?receiverId=1" and "/chat?receiverId=2"
 * (or plain "/chat") do not.
 */
export function canonicalLocation(location: string): string {
    const url = new URL(location, 'http://localhost'); // the base only lets relative paths parse
    url.searchParams.sort();
    const path = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, '') : url.pathname;
    return `${path}${url.search}`;
}
