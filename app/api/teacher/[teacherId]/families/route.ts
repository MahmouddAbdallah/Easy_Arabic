import { getFamiliesOfTeacher } from "@/lib/data/users";
import { authorization } from "@/lib/verifyAuth";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest, { params }: { params: Promise<{ teacherId: string }> }) {
    try {
        const { error } = await authorization(["admin", 'teacher']);
        if (error) {
            return NextResponse.json(
                { success: false, error: { code: "FORBIDDEN", message: "Forbidden" } },
                { status: 403 }
            );
        }
        const { teacherId } = await params;
        const { data } = await getFamiliesOfTeacher({
            filter: {
                where: [
                    {
                        key: "teacherId",
                        value: teacherId
                    }
                ],
                select: ['id'],
                include: {
                    value: 'family',
                    select: ['id', 'name', 'email', 'phone', 'status']
                }
            }
        })
        const families = data.map((ele: any) => {
            return (
                ele.family
            )
        })

        return NextResponse.json({ families }, { status: 200 });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR', message: 'Error in server' } }, { status: 500 });
    }
}
