/**
 * SERVER ONLY. Refreshes the cached public pages after a post changes, so visitors never keep seeing
 * an old version. Failure to revalidate must never fail the save itself.
 */
import { revalidatePath } from "next/cache";
import { BLOG_BASE_PATH, blogPostPath } from "./constants";

export function revalidateBlogPaths(...slugs: Array<string | null | undefined>): void {
    try {
        revalidatePath(BLOG_BASE_PATH);
        for (const slug of new Set(slugs)) {
            if (slug) revalidatePath(blogPostPath(slug));
        }
    } catch (error) {
        console.error("Blog: could not revalidate public pages:", error);
    }
}
