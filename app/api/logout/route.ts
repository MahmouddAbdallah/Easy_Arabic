import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
    try {
        const cookieStore = await cookies();
        cookieStore.delete("token");
        return NextResponse.json({ message: 'Log out successfully!!' }, { status: 200 })
    } catch (error) {
        console.error(error);
        return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR', message: 'Error in server' } }, { status: 500 })
    }
}
