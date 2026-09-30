/**
 * Central place for every tunable in the auth system. Everything has a safe
 * default; the environment can override the values that make sense to tune
 * per deployment. See docs/AUTH.md for the full list.
 */

function intFromEnv(name: string, fallback: number, min: number, max: number): number {
    const raw = process.env[name];
    if (raw === undefined || raw.trim() === '') return fallback;
    const value = Number(raw);
    if (!Number.isInteger(value) || value < min || value > max) {
        console.warn(`[auth] ${name} must be an integer between ${min} and ${max}; using ${fallback}.`);
        return fallback;
    }
    return value;
}

export const authConfig = {
    session: {
        /** How long a session (cookie + JWT) lives. Default 7 days. */
        maxAgeSeconds: intFromEnv('SESSION_MAX_AGE_SECONDS', 60 * 60 * 24 * 7, 300, 60 * 60 * 24 * 90),
        cookieName: 'token',
    },

    /**
     * bcrypt cost. Deliberately equal to the cost of every hash already in the
     * database (10): the "unknown email" sign-in path compares against a dummy
     * hash of the same cost, so both paths take the same time.
     */
    bcryptRounds: 10,

    login: {
        /** Consecutive failures for one (email, IP) pair before it is blocked. */
        maxAttempts: intFromEnv('LOGIN_MAX_ATTEMPTS', 5, 2, 50),
        lockoutSeconds: intFromEnv('LOGIN_LOCKOUT_SECONDS', 5 * 60, 30, 24 * 60 * 60),
        /** Failures are forgotten after this long without hitting the limit. */
        windowSeconds: 15 * 60,
        /**
         * Backstops. The per-pair limit above is what a normal user hits. These
         * catch distributed attacks: many IPs against one account, or one IP
         * spraying many accounts. They are intentionally much higher so a
         * stranger cannot cheaply lock a victim out of their own account.
         */
        accountMaxAttempts: intFromEnv('LOGIN_ACCOUNT_MAX_ATTEMPTS', 15, 3, 500),
        ipMaxAttempts: intFromEnv('LOGIN_IP_MAX_ATTEMPTS', 30, 3, 1000),
    },

    tokens: {
        passwordResetTtlSeconds: intFromEnv('RESET_TOKEN_TTL_MINUTES', 30, 5, 24 * 60) * 60,
        emailVerificationTtlSeconds: intFromEnv('VERIFY_TOKEN_TTL_HOURS', 24, 1, 24 * 14) * 60 * 60,
    },

    /**
     * When true, sign-in refuses (after a correct password) until the email
     * address is verified. Off by default so enabling the feature never locks
     * out existing users; turn on once an email provider is configured.
     */
    requireEmailVerification: process.env.REQUIRE_EMAIL_VERIFICATION === 'true',
} as const;

export const isProduction = process.env.NODE_ENV === 'production';
