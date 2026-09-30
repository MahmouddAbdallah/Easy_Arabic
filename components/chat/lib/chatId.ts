/**
 * Id of the chat document between two users: chats/{chatId}.
 * Order-independent, so both participants (and the server) always land on the same document.
 * Pure helper: safe to import from both client and server code.
 */
export function getChatId(userA: string, userB: string): string {
    return [userA, userB].sort().join("_");
}
