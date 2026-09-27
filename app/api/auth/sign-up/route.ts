import { NextResponse, NextRequest } from "next/server";
import bcrypt from 'bcrypt'
import { signUpSchema, firstValidationMessage } from "@/lib/validation";
import { db } from "@/prisma/db";
import jwt from 'jsonwebtoken';
import { cookies } from "next/headers";
const MAX_AGE = 60 * 60 * 24 * 365; // 365 days in seconds

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const validation = signUpSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json({
                success: false, error: {
                    code: 'VALIDATION_ERROR',
                    message: firstValidationMessage(validation.error)
                }
            }, { status: 400 });
        }

        const data = validation.data;

        const isUser = await db.orm.public.User
            .where({ email: data.email })
            .first();

        if (isUser) {
            return NextResponse.json(
                { success: false, error: { code: 'CONFLICT', message: 'This user already exists, please sign in' } },
                { status: 409 }
            );
        }
        const isPhone = await db.orm.public.User
            .where({ phone: data.phone })
            .first();

        if (isPhone) {
            return NextResponse.json(
                { success: false, error: { code: 'CONFLICT', message: 'This phone number already exists, please sign in' } },
                { status: 409 }
            );
        }


        const user = await db.orm.public.User.create({
            ...data,
            password: await bcrypt.hash(data.password, 10)
        });

        const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET as string, { expiresIn: MAX_AGE });
        const cookieStore = await cookies();
        cookieStore.set({
            name: 'token',
            value: token,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: MAX_AGE,
        });
        return NextResponse.json({ message: 'Sign up successfully' }, { status: 201 });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR', message: 'Error in server' } }, { status: 500 });
    }
}
