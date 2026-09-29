import { contactSchema, firstValidationMessage } from "@/lib/validation";
import { db } from "@/prisma/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        const validation = contactSchema.safeParse({ ...body });
        if (!validation.success) {
            return NextResponse.json({
                success: false, error: {
                    code: 'VALIDATION_ERROR',
                    message: firstValidationMessage(validation.error)
                }
            }, { status: 400 });
        }
        const data = validation.data;
        await db.orm.public.Contact.create({
            ...data
        })
        return NextResponse.json({ message: 'Message Received' }, { status: 200 });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR', message: 'Error in server' } }, { status: 500 });
    }
}