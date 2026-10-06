import { BlogIndex } from "@/components/blog/BlogIndex";
import { taxonomyKey } from "@/components/blog/lib/slug";

// Rendered per request, like the other content pages: posts are edited from the dashboard and must
// never be baked in at build time (the build also doesn't need a database this way).
export const dynamic = "force-dynamic";

interface BlogPageProps {
    searchParams: Promise<{ page?: string | string[]; category?: string | string[]; tag?: string | string[] }>;
}

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function BlogPage({ searchParams }: BlogPageProps) {
    const params = await searchParams;
    const page = Number.parseInt(first(params.page) ?? "", 10);
    // Filters are compared by slug, so "?category=Grammar" and "?category=grammar" are the same filter.
    const category = taxonomyKey(first(params.category) ?? "");
    const tag = taxonomyKey(first(params.tag) ?? "");

    return <BlogIndex page={Number.isFinite(page) && page > 0 ? page : 1} category={category || undefined} tag={tag || undefined} />;
}
