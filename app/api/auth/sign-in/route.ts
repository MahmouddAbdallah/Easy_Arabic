import { NextResponse, NextRequest } from "next/server";
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { signInSchema, firstValidationMessage } from "@/lib/validation";
import { cookies } from 'next/headers'
import { db } from "@/prisma/db";

const MAX_AGE = 60 * 60 * 24 * 365; // 365 days in seconds

export async function POST(req: NextRequest,) {
    try {

        const body = await req.json();
        const validation = signInSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: firstValidationMessage(validation.error) } }, { status: 400 });
        }

        const user = await db.orm.public.User.first({ email: validation.data.email });

        if (!user) {
            return NextResponse.json({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid user, please sign up' } }, { status: 401 });
        }

        const isMatch = await bcrypt.compare(validation.data.password, user.password);
        if (!isMatch) {
            return NextResponse.json({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Incorrect password' } }, { status: 401 });
        }

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


        return NextResponse.json({ message: 'Sign in successfully' }, { status: 200 });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR', message: 'Error in server' } }, { status: 500 });
    }
}
