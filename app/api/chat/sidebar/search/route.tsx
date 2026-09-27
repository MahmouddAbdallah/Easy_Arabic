import { getFamiliesOfTeacher, getUsers } from "@/lib/data/users";
import { authorization } from "@/lib/verifyAuth";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
    try {
        const { error, user } = await authorization(["admin", 'teacher']);
        if (error) {
            return NextResponse.json(
                { success: false, error: { code: "FORBIDDEN", message: "Forbidden" } },
                { status: 403 }
            );
        }
        if (user?.role == 'admin') {
            const url = new URL(req.url);
            const query = new URLSearchParams(url.search);
            const keyword = query.get('keyword') as string;

            const { data } = await getUsers({
                filter: {
                    ...(keyword && { keyword }),
                    ...(keyword && { items: ['name', 'email', 'phone'] }),
                    select: ['id', 'name', 'email', 'role', 'phone'],
                    limit: 10
                },

            })
            return NextResponse.json({ users: data }, { status: 200 });
        }
        if (user?.role == 'teacher') {
            const { data } = await getFamiliesOfTeacher({
                filter: {
                    where: [
                        {
                            key: "teacherId",
                            value: user?.id as any
                        }
                    ],
                    select: ['id'],
                    include: {
                        value: 'family',
                        select: ['id', 'name', 'email', 'phone', 'status']
                    }
                }
            })
            const users = data.map((ele: any) => {
                return (
                    ele.family
                )
            })

            return NextResponse.json({ users }, { status: 200 });
        }
    } catch (error) {
        console.error(error);
        return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR', message: 'Error in server' } }, { status: 500 });
    }
}
