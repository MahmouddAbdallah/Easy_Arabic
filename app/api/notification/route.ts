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
                        id: true,
                        user: {
                            select: {
                                name: true,
                                email: true,
                            }
                        },
                        lesson: {
                            select: {
                                family: {
                                    select: {
                                        name: true,
                                        email: true,
                                    }
                                }
                            }
                        },
                        type: true,
                        isRead: true,
                        createdAt: true,
                    }
                });
                const isRead = await prisma.notification.findMany({ where: { isRead: false } })
                return NextResponse.json({ message: 'Successfully fetch notification !!', data: notification, isRead: isRead.length }, { status: 200 });

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
export async function PUT(req: NextRequest) {
    try {
        const verify = await verifyAuth();
        if (verify) {
            if (verify.role == 'admin') {
                await prisma.notification.updateMany({
                    data: {
                        isRead: true,
                    }
                })
                return NextResponse.json({ message: 'Readed' }, { status: 200 });
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
