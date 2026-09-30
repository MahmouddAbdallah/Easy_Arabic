import { db } from "@/prisma/db";

export type RecentLessonRow = {
    id: string;
    student: string | null;
    status: string;
    TeacherReward: string;
    duration: number;
    classDate: string | Date;
    teacher?: { id: string; name: string } | null;
    family?: { id: string; name: string } | null;
};

export type UpcomingLessonRow = {
    id: string;
    student: string | null;
    duration: number;
    classDate: string | Date;
    teacher?: { id: string; name: string } | null;
};

const monthStart = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();

/**
 * Platform-wide snapshot for the admin's authenticated home view.
 * Every number here is a live aggregate against the real tables —
 * nothing is hardcoded or sampled.
 */
export const getAdminOverview = async () => {
    try {
        const from = monthStart(new Date());
        const L = db.orm.public.Lesson;

        const [{ count: teacherCount }, { count: familyCount }, monthAgg, statusGroups, recent] = await Promise.all([
            db.orm.public.User.where({ role: "teacher" }).aggregate((a) => ({ count: a.count() })),
            db.orm.public.User.where({ role: "family" }).aggregate((a) => ({ count: a.count() })),
            L.where((l) => l.classDate.gte(from)).aggregate((a) => ({ count: a.count(), money: a.sum("money") })),
            L.where((l) => l.classDate.gte(from)).groupBy("status").aggregate((a) => ({ count: a.count() })),
            L.select("id", "student", "status", "TeacherReward", "duration", "classDate")
                .orderBy((l) => l.classDate.desc())
                .limit(6)
                .include("teacher", (t) => t.select("id", "name"))
                .include("family", (f) => f.select("id", "name"))
                .all(),
        ]);

        const attended = statusGroups.find((g) => g.status === "ATTENDED")?.count ?? 0;
        const totalStatused = statusGroups.reduce((sum, g) => sum + g.count, 0);
        const attendanceRate = totalStatused > 0 ? Math.round((attended / totalStatused) * 100) : null;

        return {
            success: true as const,
            data: {
                teacherCount,
                familyCount,
                lessonsThisMonth: monthAgg.count,
                moneyThisMonth: monthAgg.money ?? 0,
                attendanceRate,
                recent: recent as RecentLessonRow[],
            },
        };
    } catch (error) {
        console.error("[getAdminOverview] query failed:", error);
        return { success: false as const, error: { code: "SERVER_ERROR", message: "Error in server" } };
    }
};

/** A teacher's own snapshot for their authenticated home view. */
export const getTeacherOverview = async (teacherId: string) => {
    try {
        const from = monthStart(new Date());
        const L = db.orm.public.Lesson;

        const [monthAgg, { count: familyCount }, recent] = await Promise.all([
            L.where((l) => l.teacherId.eq(teacherId)).where((l) => l.classDate.gte(from))
                .aggregate((a) => ({ count: a.count(), minutes: a.sum("duration"), money: a.sum("money") })),
            db.orm.public.TeacherFamily.where({ teacherId }).aggregate((a) => ({ count: a.count() })),
            L.where((l) => l.teacherId.eq(teacherId))
                .select("id", "student", "status", "TeacherReward", "duration", "classDate")
                .orderBy((l) => l.classDate.desc())
                .limit(6)
                .include("family", (f) => f.select("id", "name"))
                .all(),
        ]);

        return {
            success: true as const,
            data: {
                lessonsThisMonth: monthAgg.count,
                minutesThisMonth: monthAgg.minutes ?? 0,
                moneyThisMonth: monthAgg.money ?? 0,
                familyCount,
                recent: recent as RecentLessonRow[],
            },
        };
    } catch (error) {
        console.error("[getTeacherOverview] query failed:", error);
        return { success: false as const, error: { code: "SERVER_ERROR", message: "Error in server" } };
    }
};

/** A family's own snapshot for their authenticated home view. */
export const getFamilyOverview = async (familyId: string) => {
    try {
        const from = monthStart(new Date());
        const L = db.orm.public.Lesson;
        const nowIso = new Date().toISOString();

        const [monthAgg, { count: teacherCount }, recent, upcoming] = await Promise.all([
            L.where((l) => l.familyId.eq(familyId)).where((l) => l.classDate.gte(from))
                .aggregate((a) => ({ count: a.count() })),
            db.orm.public.TeacherFamily.where({ familyId }).aggregate((a) => ({ count: a.count() })),
            L.where((l) => l.familyId.eq(familyId))
                .select("id", "student", "status", "TeacherReward", "duration", "classDate")
                .orderBy((l) => l.classDate.desc())
                .limit(6)
                .include("teacher", (t) => t.select("id", "name"))
                .all(),
            L.where((l) => l.familyId.eq(familyId)).where((l) => l.classDate.gte(nowIso))
                .select("id", "student", "classDate", "duration")
                .orderBy((l) => l.classDate.asc())
                .limit(1)
                .include("teacher", (t) => t.select("id", "name"))
                .all(),
        ]);

        return {
            success: true as const,
            data: {
                lessonsThisMonth: monthAgg.count,
                teacherCount,
                recent: recent as RecentLessonRow[],
                nextLesson: (upcoming[0] as UpcomingLessonRow | undefined) ?? null,
            },
        };
    } catch (error) {
        console.error("[getFamilyOverview] query failed:", error);
        return { success: false as const, error: { code: "SERVER_ERROR", message: "Error in server" } };
    }
};
