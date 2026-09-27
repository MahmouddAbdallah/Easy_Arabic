import { prismaArgs } from "@/lib/prismaArgs";
import { authorization } from "../verifyAuth";
import { db } from "@/prisma/db";

export const getTeacherFamilies = prismaArgs<'TeacherFamily'>('TeacherFamily');

export const getMoney = async (teacherId: string) => {
    try {
        const { error } = await authorization(["admin", 'teacher']);
        if (error) {
            return { success: false, error: { code: "FORBIDDEN", message: "Forbidden" } }
        }

        const money = await db.orm.public.MoneyPerLesson.where({
            teacherId
        })
            .select('id', 'money')
            .first();
        return { money: money ?? { id: null, money: 0 } }
    } catch (error) {
        console.error("[getMoney] query failed:", error);
        return {
            success: false,
            error: { code: "SERVER_ERROR", message: "Error in server" },
        };
    }
}
