import { verifyAuth } from "@/lib/verifyAuth";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest,) {
    try {
        const user = await verifyAuth();
        if (user) {
            if (user.role == 'admin') {
                const families = await prisma?.family.findMany()
                return NextResponse.json({ message: 'Get suessfully', families })
            } else {
                return NextResponse.json({ message: 'Not Allow' })
            }
        }
        else {
            return NextResponse.json({ message: 'Not Allow' })
        }
    } catch (error: any) {
        return NextResponse.json({ error: error.message, message: 'Error in server' })
    }
}