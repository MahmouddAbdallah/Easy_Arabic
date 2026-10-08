/**
 * SERVER ONLY — compatibility entry point, kept so code outside this folder (the chat's call notifications)
 * keeps working with the import path it already uses. The implementation lives in ./server/presence.ts, the
 * same module sendNotification() uses, so there is exactly one reader and one writer of the presence documents.
 */
export { setActiveContext, usersViewing } from './server/presence';
