import { NextResponse } from "next/server";

/** The error responses shared by every route under /api/notification. */

export const forbidden = () =>
    NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "Forbidden" } },
        { status: 403 }
    );

export const validationError = (message: string) =>
    NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message } },
        { status: 400 }
    );

export const serverError = (error: unknown) => {
    console.error(error);
    return NextResponse.json(
        { success: false, error: { code: "SERVER_ERROR", message: "Error in server" } },
        { status: 500 }
    );
};
