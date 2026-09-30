import { db } from '@/prisma/db';

/** Trim + lowercase. Every auth entry point normalizes email through this (or the Zod schema that mirrors it). */
export const normalizeEmail = (email: string) => email.trim().toLowerCase();

// Escape LIKE wildcards so `a_b@x.com` can't match `axb@x.com`.
const escapeLike = (value: string) => value.replace(/[\\%_]/g, (c) => `\\${c}`);

/**
 * Looks a user up by email. New accounts are stored lowercased, so the exact
 * (indexed) match hits first. The case-insensitive fallback exists only for
 * accounts created before normalization was introduced, so nobody with a
 * mixed-case email in the database is locked out. Returns the FULL row
 * (including the password hash): never send it to a client.
 */
export async function findUserByEmail(email: string) {
    const normalized = normalizeEmail(email);
    const exact = await db.orm.public.User.where({ email: normalized }).first();
    if (exact) return exact;
    return db.orm.public.User.where((u) => u.email.ilike(escapeLike(normalized))).first();
}
