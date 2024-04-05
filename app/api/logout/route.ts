import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
    try {
        cookies().delete("token")
        return NextResponse.json({ message: 'Log out successfully!!' })
    } catch (error: any) {
        return NextResponse.json({ error: error.message, message: 'Error in server' })
    }
}