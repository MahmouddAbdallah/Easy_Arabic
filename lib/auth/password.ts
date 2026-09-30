import bcrypt from 'bcrypt';
import { authConfig } from '@/lib/auth/config';

// Compared against when the email is unknown so that "no such user" and
// "wrong password" cost the same amount of CPU time (no timing oracle).
let dummyHash: string | undefined;
const getDummyHash = () => (dummyHash ??= bcrypt.hashSync('not-a-real-password', authConfig.bcryptRounds));

export const hashPassword = (password: string) => bcrypt.hash(password, authConfig.bcryptRounds);

/** Pass `null` when there is no user; the comparison still runs, and fails. */
export async function verifyPassword(password: string, hash: string | null | undefined): Promise<boolean> {
    const matches = await bcrypt.compare(password, hash ?? getDummyHash());
    return Boolean(hash) && matches;
}
