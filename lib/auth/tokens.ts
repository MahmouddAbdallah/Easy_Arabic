import { createHash, randomBytes } from 'node:crypto';
import { db } from '@/prisma/db';

export type AuthTokenType = 'password_reset' | 'email_verification';

// SHA-256 (not bcrypt) is right here: the input is 256 bits of CSPRNG output,
// so there is nothing to brute-force, and lookups need to be by hash.
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

/**
 * Creates a token for the user and returns the RAW value (emailed to them; it
 * is never stored). Any earlier token of the same type is revoked, so only the
 * most recent link works.
 */
export async function issueToken(userId: string, type: AuthTokenType, ttlSeconds: number): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

    await db.transaction(async (tx) => {
        await tx.orm.public.AuthToken.where({ userId, type }).delete();
        await tx.orm.public.AuthToken.create({ userId, type, tokenHash: sha256(token), expiresAt });
    });

    // Opportunistic cleanup of expired rows (~5% of issues); never blocks the caller.
    if (Math.random() < 0.05) {
        const plan = db.raw.sql`DELETE FROM "authToken" WHERE "expiresAt" < now()`.affectedCount().build();
        db.runtime().execute(plan).catch(() => undefined);
    }
    return token;
}

/**
 * Atomically consumes a token: one DELETE .. RETURNING. Two concurrent
 * requests with the same link cannot both succeed, and an expired token
 * matches nothing. Returns the owning userId, or null if invalid/expired/used.
 * Pass a transaction's `tx` to make consumption commit or roll back together
 * with whatever the token authorizes (e.g. the password update).
 */
export async function consumeToken(
    token: string,
    type: AuthTokenType,
    runner: { query: (plan: any) => PromiseLike<any> } = { query: (plan) => db.runtime().query(plan) }
): Promise<string | null> {
    const plan = db.raw.sql`
        DELETE FROM "authToken"
        WHERE "tokenHash" = ${sha256(token)} AND "type" = ${type} AND "expiresAt" > now()
        RETURNING "userId"
    `.returnsRow({ userId: 'pg/text@1' }).build();
    const rows = (await runner.query(plan)) as Array<{ userId: string }>;
    return rows[0]?.userId ?? null;
}

/** Revoke every outstanding token of a type for a user (e.g. after a password change). */
export async function revokeTokens(userId: string, type: AuthTokenType, runner: typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0] = db) {
    await runner.orm.public.AuthToken.where({ userId, type }).delete();
}
