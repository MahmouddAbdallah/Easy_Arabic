import { db } from '@/prisma/db';
import { authConfig } from '@/lib/auth/config';
import { hashIdentifier } from '@/lib/auth/request';

/**
 * Low-level counters stored in `authRateLimit`. Every mutation is ONE atomic
 * INSERT .. ON CONFLICT DO UPDATE .. RETURNING statement, so two concurrent
 * requests can never both read "4 failures" and both write "5" (lost update),
 * and no request can slip between "check" and "increment".
 */

const INT = 'pg/int4@1';

type FailurePolicy = { maxAttempts: number; blockSeconds: number; windowSeconds: number };

export type AttemptResult = {
    /** The attempt's ordinal in the current run (1-based), assigned atomically. */
    count: number;
    /** Seconds the key is blocked for AFTER this attempt (0 = not blocked). */
    retryAfterSeconds: number;
};

/**
 * Atomically reserves one attempt slot for `key` BEFORE the guarded operation
 * runs, and returns the attempt's ordinal. The caller may proceed only if
 * `count <= maxAttempts`; the attempt that reaches `maxAttempts` is still
 * allowed to run but arms a block of `blockSeconds` for everything after it.
 *
 * Counting up front (rather than "check, verify, then record the failure")
 * is what makes this race-free: a burst of N parallel requests receives N
 * distinct ordinals, so at most `maxAttempts` of them ever run, no matter how
 * they interleave. A block that has expired, or a run older than
 * `windowSeconds`, starts a fresh count.
 */
export async function registerAttempt(key: string, policy: FailurePolicy): Promise<AttemptResult> {
    const { maxAttempts, blockSeconds, windowSeconds } = policy;
    // "expired" = the previous block ended, or the run of failures is stale.
    // (Postgres evaluates every SET expression against the OLD row, so the
    // condition is spelled out for each column.)
    const plan = db.raw.sql`
        INSERT INTO "authRateLimit" AS r ("key", "count", "windowStart", "blockedUntil", "updatedAt")
        VALUES (${key}, 1, now(), NULL, now())
        ON CONFLICT ("key") DO UPDATE SET
            "count" = CASE
                WHEN (r."blockedUntil" IS NOT NULL AND r."blockedUntil" <= now())
                     OR r."windowStart" <= now() - make_interval(secs => ${windowSeconds}) THEN 1
                ELSE r."count" + 1 END,
            "windowStart" = CASE
                WHEN (r."blockedUntil" IS NOT NULL AND r."blockedUntil" <= now())
                     OR r."windowStart" <= now() - make_interval(secs => ${windowSeconds}) THEN now()
                ELSE r."windowStart" END,
            "blockedUntil" = CASE
                WHEN (r."blockedUntil" IS NOT NULL AND r."blockedUntil" <= now())
                     OR r."windowStart" <= now() - make_interval(secs => ${windowSeconds}) THEN NULL
                WHEN r."blockedUntil" IS NOT NULL THEN r."blockedUntil"
                WHEN r."count" + 1 >= ${maxAttempts} THEN now() + make_interval(secs => ${blockSeconds})
                ELSE NULL END,
            "updatedAt" = now()
        RETURNING "count",
            COALESCE(CEIL(EXTRACT(EPOCH FROM ("blockedUntil" - now()))), 0)::int AS "retryAfter"
    `.returnsRow({ count: INT, retryAfter: INT }).build();
    const rows = await db.runtime().query(plan);
    const row = rows[0] as { count: number; retryAfter: number };
    return { count: Number(row.count), retryAfterSeconds: Number(row.retryAfter) };
}

/** Gives one reserved attempt back (used so successful logins don't count against the IP-wide limit). */
export async function refundAttempt(key: string): Promise<void> {
    const plan = db.raw.sql`UPDATE "authRateLimit" SET "count" = GREATEST("count" - 1, 0) WHERE "key" = ${key}`.affectedCount().build();
    await db.runtime().execute(plan);
}

export async function resetKey(key: string): Promise<void> {
    const plan = db.raw.sql`DELETE FROM "authRateLimit" WHERE "key" = ${key}`.affectedCount().build();
    await db.runtime().execute(plan);
}

/**
 * Fixed-window rate limit: at most `limit` calls per `windowSeconds`.
 * Every call (allowed or not) is counted; the window does not slide.
 */
export async function consume(
    key: string,
    { limit, windowSeconds }: { limit: number; windowSeconds: number }
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
    const plan = db.raw.sql`
        INSERT INTO "authRateLimit" AS r ("key", "count", "windowStart", "blockedUntil", "updatedAt")
        VALUES (${key}, 1, now(), NULL, now())
        ON CONFLICT ("key") DO UPDATE SET
            "count" = CASE WHEN r."windowStart" <= now() - make_interval(secs => ${windowSeconds})
                           THEN 1 ELSE r."count" + 1 END,
            "windowStart" = CASE WHEN r."windowStart" <= now() - make_interval(secs => ${windowSeconds})
                                 THEN now() ELSE r."windowStart" END,
            "updatedAt" = now()
        RETURNING "count",
            GREATEST(CEIL(EXTRACT(EPOCH FROM ("windowStart" + make_interval(secs => ${windowSeconds}) - now()))), 0)::int AS "retryAfter"
    `.returnsRow({ count: INT, retryAfter: INT }).build();
    const rows = await db.runtime().query(plan);
    const row = rows[0] as { count: number; retryAfter: number };
    maybePurge();
    return { allowed: Number(row.count) <= limit, retryAfterSeconds: Number(row.retryAfter) };
}

// Housekeeping: drop counters nobody has touched for two days. Cheap, runs on
// ~1% of calls, and failures are irrelevant to the request.
function maybePurge() {
    if (Math.random() > 0.01) return;
    const plan = db.raw.sql`DELETE FROM "authRateLimit" WHERE "updatedAt" < now() - interval '2 days'`.affectedCount().build();
    db.runtime().execute(plan).catch(() => undefined);
}

/* -------------------------------------------------------------------------
 * Login throttling
 *
 * Three independent counters, so a stranger can't cheaply lock someone out:
 *   pair    (email + IP)  5 consecutive failures -> 5 min block. This is what
 *                         a real user who mistypes their password hits, and it
 *                         only ever blocks the *client that is failing*.
 *   account (email)       higher threshold across ALL IPs: stops a distributed
 *                         attack on one account.
 *   ip      (IP)          higher threshold across ALL emails: stops password
 *                         spraying from one machine.
 * Keys use the *submitted* email whether or not the account exists, so
 * blocking behaves identically for real and non-existent accounts.
 *
 * Attempts are reserved up front (see registerAttempt). Only attempts that
 * pass the per-pair gate count toward the account/IP backstops, so one client
 * hammering while already blocked can't inflate a victim's account counter.
 * ---------------------------------------------------------------------- */

const { login } = authConfig;
const loginKeys = (email: string, ip: string) => ({
    pair: `login:pair:${hashIdentifier(email)}:${hashIdentifier(ip)}`,
    account: `login:acct:${hashIdentifier(email)}`,
    ip: `login:ip:${hashIdentifier(ip)}`,
});

export type LoginAttempt = {
    /** false => reject immediately (429) WITHOUT checking the password. */
    allowed: boolean;
    /** > 0 => a lockout is active after this attempt (either rejected, or this attempt armed it). */
    retryAfterSeconds: number;
};

export async function beginLoginAttempt(email: string, ip: string): Promise<LoginAttempt> {
    const k = loginKeys(email, ip);
    const base = { blockSeconds: login.lockoutSeconds, windowSeconds: login.windowSeconds };

    const pair = await registerAttempt(k.pair, { ...base, maxAttempts: login.maxAttempts });
    if (pair.count > login.maxAttempts) return { allowed: false, retryAfterSeconds: pair.retryAfterSeconds };

    const [account, byIp] = await Promise.all([
        registerAttempt(k.account, { ...base, maxAttempts: login.accountMaxAttempts }),
        registerAttempt(k.ip, { ...base, maxAttempts: login.ipMaxAttempts }),
    ]);
    const allowed = account.count <= login.accountMaxAttempts && byIp.count <= login.ipMaxAttempts;
    return {
        allowed,
        retryAfterSeconds: Math.max(pair.retryAfterSeconds, account.retryAfterSeconds, byIp.retryAfterSeconds),
    };
}

/** Successful sign-in: reset this email's counters, and hand back the IP-wide slot (it counts failures, not logins). */
export async function completeLoginSuccess(email: string, ip: string): Promise<void> {
    const k = loginKeys(email, ip);
    await Promise.all([resetKey(k.pair), resetKey(k.account), refundAttempt(k.ip)]);
}

/** Used after a password reset: the legitimate owner proved control of the email. */
export const clearAccountLoginFailures = (email: string) => resetKey(loginKeys(email, '').account);

export const rateLimitKey = (scope: string, identifier: string) => `${scope}:${hashIdentifier(identifier)}`;
