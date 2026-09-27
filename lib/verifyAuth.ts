import { db } from "@/prisma/db";
import { userType } from "@/types/userTypes";
import jwt, { JwtPayload, TokenExpiredError, JsonWebTokenError } from "jsonwebtoken";
import { cookies } from "next/headers";

type AuthErrorCode =
    | "NO_TOKEN"
    | "TOKEN_EXPIRED"
    | "INVALID_TOKEN"
    | "USER_NOT_FOUND"
    | "ACCOUNT_BANNED"
    | "ACCOUNT_SUSPENDED"
    | "INSUFFICIENT_PERMISSIONS"
    | "SERVER_ERROR";

type AuthResult = {
    error?: {
        code: AuthErrorCode;
        message: string;
    };
    user?: userType;
};

export const authorization = async (
    requiredRoles?: string[]
): Promise<AuthResult> => {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get("token")?.value;

        if (!token) {
            return { error: { code: "NO_TOKEN", message: "You're not logged in." } };
        }

        let decoded: JwtPayload;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload;
        } catch (err) {
            if (err instanceof TokenExpiredError) {
                return { error: { code: "TOKEN_EXPIRED", message: "Your session expired. Please log in again." } };
            }
            if (err instanceof JsonWebTokenError) {
                console.warn("authorization(): rejected a malformed token —", err.message);
                return { error: { code: "INVALID_TOKEN", message: "This login token isn't valid." } };
            }
            throw err;
        }

        const { id, iat } = decoded as { id: string; iat: number };

        if (!id) {
            return { error: { code: "INVALID_TOKEN", message: "Token does not contain a valid id." } };
        }

        const user = await db.orm.public.User
            .where({ id })
            .select(
                'id',
                'name',
                'email',
                'role',
                'status',
                'passwordLastChanged',
                'phone',
                'createdAt',
                'updatedAt'
            ).first();

        if (!user) {
            return { error: { code: "USER_NOT_FOUND", message: "User not found." } };
        }

        const passwordChangedAt = Math.floor(new Date(user.passwordLastChanged).getTime() / 1000);
        if (passwordChangedAt > iat) {
            return { error: { code: "INVALID_TOKEN", message: "Your password changed, so please log in again." } };
        }

        if (user.status === "banned") {
            return { error: { code: "ACCOUNT_BANNED", message: "This account has been banned." } };
        }
        if (user.status === "suspended") {
            return { error: { code: "ACCOUNT_SUSPENDED", message: "This account is temporarily suspended." } };
        }

        if (requiredRoles && requiredRoles.length > 0 && !requiredRoles.includes(user.role)) {
            console.warn(
                `authorization(): user ${user.id} (role: ${user.role}) tried to reach a route restricted to [${requiredRoles.join(", ")}]`
            );
            return { error: { code: "INSUFFICIENT_PERMISSIONS", message: "You don't have permission to do that." } };
        }

        return { user: user as any };
    } catch (err) {
        console.error("authorization(): unexpected failure —", err);
        return { error: { code: "SERVER_ERROR", message: "Something went wrong while checking your login." } };
    }
};