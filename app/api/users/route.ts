import { NextResponse, NextRequest } from "next/server";
import bcrypt from 'bcrypt'
import { userSchema, firstValidationMessage } from "@/lib/validation";
import { db } from "@/prisma/db";
import { getUsers } from "@/lib/data/users";
import { authorization } from "@/lib/verifyAuth";
import { apiError } from "@/lib/apiResponse";


export async function POST(req: NextRequest) {
    try {
        // Admin only: this accepts a `role`, so open access would let anyone create an admin.
        // (Public registration goes through /api/auth/sign-up.)
        const { error } = await authorization(["admin"]);
        if (error) return apiError(error.code === "INSUFFICIENT_PERMISSIONS" ? 403 : 401, "FORBIDDEN", "Forbidden");

        const body = await req.json();
        const validation = userSchema.safeParse(body);
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


        const safeUser: Partial<typeof user> = { ...user };
        delete safeUser.password;
        return NextResponse.json({ message: 'Create user successfully', user: safeUser }, { status: 201 });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR', message: 'Error in server' } }, { status: 500 });
    }
}
export async function GET(req: NextRequest) {
    try {
        const url = new URL(req.url);
        const query = new URLSearchParams(url.search);
        const keyword = query.get('keyword') as string;
        const role = query.get('role') as string;

        const users = await getUsers({
            filter: {
                ...(keyword && { keyword }),
                ...(keyword && { items: ['name', 'email', 'phone'] }),
                where: [{
                    key: 'role',
                    value: role
                }],
                limit: 10,
                select: ['id', 'name', 'email', 'role', 'phone']
            }
        })
        return NextResponse.json({ users }, { status: 200 });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR', message: 'Error in server' } }, { status: 500 });
    }
}
