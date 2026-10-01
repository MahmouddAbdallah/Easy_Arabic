import { firstValidationMessage, fcmTokenSchema } from "@/lib/validation";
import { authorization } from "@/lib/verifyAuth";
import { db } from "@/prisma/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    try {
        const { error, user } = await authorization();
        if (error && !user) {
            return NextResponse.json(
                { success: false, error: { code: "FORBIDDEN", message: "Forbidden" } },
                { status: 403 }
            );
        }
        const body = await req.json();
        const validation = fcmTokenSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json({
                success: false, error: {
                    code: 'VALIDATION_ERROR',
                    message: firstValidationMessage(validation.error)
                }
            }, { status: 400 });
        }
        const data = validation.data;
        const existingToken = await db.orm.public.UserFCMToken.where({
            userId: user?.id as any,
            fcmToken: data.fcmToken
        }).first();

        if (existingToken) {
            return NextResponse.json({ message: "Token already exists" }, { status: 200 });
        }
        await db.orm.public.UserFCMToken.create({
            userId: user?.id as any,
            fcmToken: data.fcmToken,
            deviceType: data.deviceType
        })
        return NextResponse.json({ message: "Token created successfully" }, { status: 200 });

    } catch (error) {
        console.error(error);
        return NextResponse.json({
            success: false, error: {
                code: 'SERVER_ERROR',
                message: 'Error in server'
            }
        }, { status: 500 });
    }
}
