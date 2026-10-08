import type { Metadata } from "next";
import { BlogManager } from "@/components/blog/dashboard/BlogManager";

export const metadata: Metadata = { title: "Blog" };

export const dynamic = "force-dynamic";

export default async function DashboardBlogPage() {
    return <BlogManager />;
}
