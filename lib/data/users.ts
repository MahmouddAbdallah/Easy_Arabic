'use server';
import { prismaArgs } from "@/lib/prismaArgs";
import { authorization } from "@/lib/verifyAuth";
import { db } from "@/prisma/db";

// Everything exported from a 'use server' file is a publicly reachable
// endpoint, so each export re-checks the session itself (like getMoney does)
// instead of trusting that only guarded pages import it.
const FORBIDDEN = { success: false as const, error: { code: "FORBIDDEN", message: "Forbidden" } };

const getUsersUnguarded = prismaArgs<'User'>('User');
const getFamiliesOfTeacherUnguarded = prismaArgs<'TeacherFamily'>('TeacherFamily');
const getTeachersOfFamilyUnguarded = prismaArgs<'TeacherFamily'>('TeacherFamily');

export const getUsers: typeof getUsersUnguarded = async (args) => {
    const { error } = await authorization(["admin", "teacher"]);
    if (error) return FORBIDDEN;
    return getUsersUnguarded(args);
};

export const getFamiliesOfTeacher: typeof getFamiliesOfTeacherUnguarded = async (args) => {
    const { error } = await authorization(["admin", "teacher"]);
    if (error) return FORBIDDEN;
    return getFamiliesOfTeacherUnguarded(args);
};

// Mirror of getFamiliesOfTeacher for the family side: the same TeacherFamily rows,
// queried by `familyId` (and usually including the `teacher` relation).
export const getTeachersOfFamily: typeof getTeachersOfFamilyUnguarded = async (args) => {
    const { error } = await authorization(["admin", "teacher"]);
    if (error) return FORBIDDEN;
    return getTeachersOfFamilyUnguarded(args);
};

// Columns a caller may ask getUser for. `password` (and anything else not
// listed) can never be selected, no matter what the client sends.
const GET_USER_ALLOWED_FIELDS = new Set(['id', 'name', 'email', 'phone', 'role', 'status', 'subject']);

export const getUser = async (userId: string, select?: string[]) => {
    try {
        const { error } = await authorization();
        if (error) return FORBIDDEN;

        const requested = (select ?? []).filter((f) => GET_USER_ALLOWED_FIELDS.has(f));
        const selectedFields = requested.length > 0 ? requested : ['id', 'name'];

        const user = await db.orm.public.User.where({
            id: userId
        })
            .select(...(selectedFields as any))
            .first();
        return {
            success: true,
            data: user,
        };
    } catch (error) {
        console.error("getUser function:", error);
        return {
            success: false,
            error: { code: "SERVER_ERROR", message: "Error in server" },
        };
    }
}
