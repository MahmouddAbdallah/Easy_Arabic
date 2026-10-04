import { db } from "@/prisma/db";
import { getAdminOverview } from "@/lib/data/home-data";

export type InboxMessage = {
    id: string;
    name: string;
    email: string;
    subject: string | null;
    message: string;
    isRead: boolean;
    createdAt: string | Date;
};

// Same month boundary getAdminOverview uses, so "this month" means the same thing on every tile.
const monthStart = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();

/** Contact-form inbox: totals plus the latest few messages. */
const getInboxSnapshot = async () => {
    try {
        const C = db.orm.public.Contact;
        const [{ count: total }, { count: unread }, recent] = await Promise.all([
            C.aggregate((a) => ({ count: a.count() })),
            C.where({ isRead: false }).aggregate((a) => ({ count: a.count() })),
            C.select("id", "name", "email", "subject", "message", "isRead", "createdAt")
                .orderBy((c) => c.createdAt.desc())
                .limit(5)
                .all(),
        ]);

        return { success: true as const, data: { total, unread, recent: recent as InboxMessage[] } };
    } catch (error) {
        console.error("[getInboxSnapshot] query failed:", error);
        return { success: false as const, error: { code: "SERVER_ERROR", message: "Error in server" } };
    }
};

/** Accounts created since the start of the month, per role. */
const getNewAccountsThisMonth = async () => {
    try {
        const groups = await db.orm.public.User
            .where((u) => u.createdAt.gte(monthStart(new Date())))
            .groupBy("role")
            .aggregate((a) => ({ count: a.count() }));

        const countFor = (role: string) => groups.find((g) => g.role === role)?.count ?? 0;
        return { success: true as const, data: { families: countFor("family"), teachers: countFor("teacher") } };
    } catch (error) {
        console.error("[getNewAccountsThisMonth] query failed:", error);
        return { success: false as const, error: { code: "SERVER_ERROR", message: "Error in server" } };
    }
};

/**
 * Everything the admin's /dashboard overview shows. The three sources fail
 * independently, so one broken query dims its own tiles instead of the page.
 */
export const getDashboardOverview = async () => {
    const [overview, inbox, newAccounts] = await Promise.all([
        getAdminOverview(),
        getInboxSnapshot(),
        getNewAccountsThisMonth(),
    ]);

    return {
        overview: overview.success ? overview.data : null,
        inbox: inbox.success ? inbox.data : null,
        newAccounts: newAccounts.success ? newAccounts.data : null,
    };
};
