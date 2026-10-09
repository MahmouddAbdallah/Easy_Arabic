import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import type { Account, User } from "next-auth";
import bcrypt from "bcrypt";
import { randomBytes } from "node:crypto";
import { findUserByEmail } from "@/lib/auth/users";
import { db } from "@/prisma/db";
import { setSessionCookie } from "@/lib/auth/session";
import { firstValidationMessage, signUpSchema } from "@/lib/validation";

export const authOptions = {
    pages: {
        signIn: "/sign-in",
    },

    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        }),
    ],

    callbacks: {
        async signIn({ user }: { user: User; account: Account | null; }) {
            try {
                if (!user.email) {
                    return false;
                }
                let client = await findUserByEmail(user.email);
                if (client) {
                    const d = await db.orm.public.User.where({
                        email: client.email
                    }).update({
                        imageUrl: user?.image as string || '',
                    })
                    console.log(d, user.image);

                }
                if (!client) {
                    const validation = signUpSchema.safeParse({
                        ...user,
                        password: randomBytes(32).toString("hex"),
                        imageUrl: user.image
                    });
                    if (!validation.success) {
                        console.error(
                            "Google sign-in validation failed:",
                            firstValidationMessage(validation.error)
                        );

                        return false;
                    }
                    const data = validation.data;
                    client = await db.orm.public.User.create({
                        name: data.name,
                        email: data.email,
                        imageUrl: data.imageUrl,
                        password: await bcrypt.hash(
                            data.password,
                            10
                        ),
                    });
                }
                await setSessionCookie(client);
                return true;
            } catch (error) {
                console.error("Google sign-in error:", error);
                return false;
            }
        },
    },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };