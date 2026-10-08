import type { Metadata } from "next";
import { CommentsManager } from "@/components/blog/dashboard/comments/CommentsManager";

export const metadata: Metadata = { title: "Blog comments" };
export const dynamic = "force-dynamic";
export default async function DashboardBlogCommentsPage() {

    return <CommentsManager />;
}
