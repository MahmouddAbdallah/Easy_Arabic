import { verifyAuth } from "@/lib/verifyAuth";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest,) {
    try {
        const user = await verifyAuth();
        if (user) {
            if (user.role == 'admin') {
                const families = await prisma?.family.findMany()
                return NextResponse.json({ message: 'Get suessfully', families }, { status: 200 })
            } else {
                return NextResponse.json({ message: 'Not Allow' }, { status: 400 })
            }
        }
        else {
            return NextResponse.json({ message: 'Not Allow' }, { status: 400 })
        }
    } catch (error: any) {
        return NextResponse.json({ error: error.message, message: 'Error in server' }, { status: 400 })
    }
}