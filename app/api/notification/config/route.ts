import { formatConfigIssues, parseConfig } from "@/components/notification/lib/configParse";
import { saveConfigSchema } from "@/components/notification/lib/schema";
import {
    ConfigConflictError,
    loadNotificationConfig,
    readNotificationConfig,
    saveNotificationConfig,
} from "@/components/notification/lib/server/config";
import { NextResponse } from "next/server";
import { conflict, forbidden, validationError } from "../_lib/responses";
import { authedJsonRoute, authedRoute } from "../_lib/route";

/** The configuration is read by signed-in users all the time and changes rarely: never let a proxy or the browser keep one. */
const NO_STORE = { headers: { "Cache-Control": "private, no-store" } };

/**
 * The notification configuration (components/notification/lib/config.ts): which sections exist, the sound, which
 * settings users get and their defaults. Any signed-in user may read it — the settings screen is drawn from it —
 * and it holds nothing private. A missing document answers with the built-in defaults, so a project that never
 * opens the dashboard gets exactly the behaviour it had before the configuration existed.
 *
 * `?manage=1` is the dashboard's read: admins only, never cached, and it also says whether an admin has ever saved one
 * (`exists: false` = the built-in defaults are in force).
 */
export const GET = authedRoute(async (user, req) => {
    if (req.nextUrl.searchParams.get("manage") === "1") {
        if (user.role !== "admin") return forbidden();

        const { config, exists } = await readNotificationConfig();
        return NextResponse.json({ success: true, config, exists }, NO_STORE);
    }

    return NextResponse.json({ success: true, config: await loadNotificationConfig() }, NO_STORE);
});

/**
 * Saves the whole configuration — admins only. The body is `{ config, expectedRevision }`: the revision is the one
 * the admin loaded, and if somebody saved in between the answer is 409 and nothing is written, so two admins
 * cannot silently overwrite each other. The configuration is validated by the same rules the dashboard shows
 * next to its fields (parseConfig); the response carries it as stored, with its new revision.
 */
export const PUT = authedJsonRoute(
    saveConfigSchema,
    async (user, { config: raw, expectedRevision }) => {
        const { config, issues } = parseConfig(raw);
        if (issues.length > 0) return validationError(formatConfigIssues(issues));

        try {
            const saved = await saveNotificationConfig(config, expectedRevision, user.id);
            return NextResponse.json({ success: true, config: saved }, NO_STORE);
        } catch (error) {
            if (error instanceof ConfigConflictError) {
                return conflict("The notification configuration was changed by someone else. Reload it to see their changes.");
            }
            throw error;
        }
    },
    { roles: ["admin"] }
);
