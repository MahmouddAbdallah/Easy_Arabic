import { activeContextSchema } from "@/components/notification/lib/schema";
import { setActiveContext } from "@/components/notification/lib/server/presence";
import { NextResponse } from "next/server";
import { authedJsonRoute } from "../_lib/route";

export const POST = authedJsonRoute(activeContextSchema, async (user, { sessionId, link }) => {
    await setActiveContext(user.id, sessionId, link);
    return NextResponse.json({ success: true }, { status: 200 });
});
