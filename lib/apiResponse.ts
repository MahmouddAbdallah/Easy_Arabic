import { NextResponse } from "next/server";

/** JSON error body in the shape every route in this app uses: `{ success: false, error: { code, message } }`. */
export function apiError(status: number, code: string, message: string) {
    return NextResponse.json(
        { success: false, error: { code, message } },
        { status }
    );
}

/** True for a Postgres unique-constraint violation (SQLSTATE 23505), whether it is wrapped in `cause` or not. */
export function isUniqueViolation(err: unknown): boolean {
    const e = err as { code?: string; cause?: { code?: string } } | null;
    return e?.code === "23505" || e?.cause?.code === "23505";
}
