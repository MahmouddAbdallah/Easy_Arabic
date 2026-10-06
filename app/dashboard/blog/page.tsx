import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { BlogManager } from "@/components/blog/dashboard/BlogManager";
import { authorization } from "@/lib/verifyAuth";

export const metadata: Metadata = { title: "Blog" };

// Depends on the signed-in user, so it is never prerendered.
export const dynamic = "force-dynamic";

const NOT_SIGNED_IN = ["NO_TOKEN", "TOKEN_EXPIRED", "INVALID_TOKEN", "USER_NOT_FOUND"];

/**
 * The Blog admin is one reusable component (<BlogManager />); this page only places it on /dashboard/blog
 * and keeps people who can't use it out. The API enforces the same rule on every request.
 */
export default async function DashboardBlogPage() {
    const { error } = await authorization(["admin"]);
    if (error) {
        if (NOT_SIGNED_IN.includes(error.code)) redirect("/sign-in");
        notFound();
    }

    return <BlogManager />;
}
