import { findCategory } from "@/components/notification/lib/config";
import { settingsPatchSchema } from "@/components/notification/lib/schema";
import { loadNotificationConfig } from "@/components/notification/lib/server/config";
import { saveSettings } from "@/components/notification/lib/server/settings";
import { NextResponse } from "next/server";
import { validationError } from "../_lib/responses";
import { authedJsonRoute } from "../_lib/route";

/**
 * Changes the signed-in user's notification settings: any non-empty subset of them (see
 * components/notification/lib/settings.ts), e.g. `{ "sound": false }` or
 * `{ "quietHours": { "enabled": true, "start": "22:00", "end": "07:00", "timeZone": "Africa/Cairo" } }`.
 * The settings belong to the session's user — there is no way to name another. The browser reads the settings
 * document live from Firestore and never writes it; this is the only way they change.
 *
 * The sections a person can switch (`categories`) are defined by the admin's notification configuration, so
 * their ids are checked against it here: an id that does not exist (a typo, or a section an admin removed
 * while this page was open) is refused instead of being stored under a name nothing will ever read.
 * Choices about a section that exists but is switched off, or about a control the admin locked, are accepted
 * and simply have no effect while that is so — they apply again if the admin changes their mind.
 */
export const PATCH = authedJsonRoute(settingsPatchSchema, async (user, patch) => {
    if (patch.categories) {
        const config = await loadNotificationConfig();
        const unknown = Object.keys(patch.categories).filter((id) => !findCategory(config, id));
        if (unknown.length > 0) {
            return validationError(`Unknown notification section: ${unknown.join(", ")}`);
        }
    }

    await saveSettings(user.id, patch);

    return NextResponse.json({ success: true }, { status: 200 });
});
