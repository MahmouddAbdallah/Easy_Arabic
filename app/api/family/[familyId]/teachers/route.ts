import { getTeachersOfFamily } from "@/lib/data/users";
import { authorization } from "@/lib/verifyAuth";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest, { params }: { params: Promise<{ familyId: string }> }) {
    try {
        const { error } = await authorization(["admin", 'family']);
        if (error) {
            return NextResponse.json(
                { success: false, error: { code: "FORBIDDEN", message: "Forbidden" } },
                { status: 403 }
            );
        }
        const { familyId } = await params;
        const { data } = await getTeachersOfFamily({
            filter: {
                where: [
                    {
                        key: "familyId",
                        value: familyId
                    }
                ],
                select: ['id'],
                include: {
                    value: 'teacher',
                    select: ['id', 'name', 'email', 'phone', 'status']
                }
            }
        })


        const teachers = data.map((ele: any) => {
            return (
                ele.teacher
            )
        })

        return NextResponse.json({ data: teachers }, { status: 200 });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR', message: 'Error in server' } }, { status: 500 });
    }
}
