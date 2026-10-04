import { NextResponse, NextRequest } from "next/server";


export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        return NextResponse.json({ message: 'successfully', body }, { status: 201 });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR', message: 'Error in server' } }, { status: 500 });
    }
}