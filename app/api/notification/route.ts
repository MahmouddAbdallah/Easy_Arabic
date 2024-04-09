import { verifyAuth } from "@/lib/verifyAuth";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/prisma/client";

export async function GET(req: NextRequest) {
    try {
        const verify = await verifyAuth();
        if (verify) {
            if (verify.role == 'admin') {
                const notification = await prisma.notification.findMany({
                    select: {
                        user: {
                            select: {
                                name: true,
                                email: true,
                            }
                        }
                    }
                });
                return NextResponse.json({ message: 'Successfully fetch notification !!', notification }, { status: 200 });

            } else {
                return NextResponse.json({ message: 'Not allow' }, { status: 400 });
            }
        } else {
            return NextResponse.json({ message: 'fail' }, { status: 400 });
        }
    } catch (error: any) {
        return NextResponse.json({ error: error.message, message: 'Error in server' }, { status: 400 })
    }
}