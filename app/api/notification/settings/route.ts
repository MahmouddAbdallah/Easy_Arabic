import { settingsPatchSchema } from "@/components/notification/lib/schema";
import { saveSettings } from "@/components/notification/lib/server/settings";
import { NextResponse } from "next/server";
import { authedJsonRoute } from "../_lib/route";

/**
 * Changes the signed-in user's notification settings: any non-empty subset of them (see
 * components/notification/lib/settings.ts), e.g. `{ "sound": false }` or
 * `{ "quietHours": { "enabled": true, "start": "22:00", "end": "07:00", "timeZone": "Africa/Cairo" } }`.
 * The settings belong to the session's user — there is no way to name another. The browser reads the settings
 * document live from Firestore and never writes it; this is the only way they change.
 */
export const PATCH = authedJsonRoute(settingsPatchSchema, async (user, patch) => {
    await saveSettings(user.id, patch);

    return NextResponse.json({ success: true }, { status: 200 });
});
