import { prismaArgs } from "@/lib/prismaArgs";
import { db } from "@/prisma/db";

export const getUsers = prismaArgs<'User'>('User');

export const getFamiliesOfTeacher = prismaArgs<'TeacherFamily'>('TeacherFamily')

export const getUser = async (userId: string, select?: string[]) => {
    try {
        // Fix syntax: structure selected fields or fall back to default array
        const selectedFields = select && select.length > 0 ? select : ['id', 'name'];

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