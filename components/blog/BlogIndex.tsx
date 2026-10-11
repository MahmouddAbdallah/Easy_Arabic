import { BlogIndexView, type BlogIndexViewProps } from "./index/BlogIndexView";
import { listPublishedBlogs } from "./lib/blogs.server";
import { BLOG_BASE_PATH, PUBLIC_PAGE_SIZE } from "./lib/constants";

export interface BlogIndexProps extends Omit<BlogIndexViewProps, "list"> {
    page?: number;
}

/**
 * The public list of posts (`/blog`): reads one page of published posts from Firestore on the server and
 * hands it to `BlogIndexView`, which draws it. Plain HTML out; the only client script is the small effect
 * that scrolls the selected category into view on a phone.
 *
 * `category` and `tag` are slugs (as in the URL), not display names. `eyebrow`, `title` and `description`
 * are the front page's wording; leave them out for the defaults.
 */
export async function BlogIndex({ page = 1, category, tag, basePath = BLOG_BASE_PATH, ...copy }: BlogIndexProps) {
    const list = await listPublishedBlogs({ page, pageSize: PUBLIC_PAGE_SIZE, category, tag });
    return <BlogIndexView list={list} category={category} tag={tag} basePath={basePath} {...copy} />;
}
