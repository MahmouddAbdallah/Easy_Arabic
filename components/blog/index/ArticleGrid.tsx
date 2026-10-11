import type { BlogSummary } from "../lib/types";
import { ArticleCard } from "./ArticleCard";

interface ArticleGridProps {
    posts: readonly BlogSummary[];
    /** The first two get the larger preview. Only when there are enough posts to make a row of them. */
    withLead?: boolean;
    /** How many previews, from the top, are likely on screen at first (their pictures are fetched at once). */
    eagerCount?: number;
    basePath?: string;
}

/** Posts before this many are not worth a "lead" row: one large preview alone looks lost. */
const LEAD_COUNT = 2;

/**
 * The articles. Two larger previews first (on the front page), then the rest in three columns, so the
 * list has a rhythm instead of being one uniform grid. Fewer posts fall back gracefully: with fewer than
 * two to lead with, everything is a standard preview.
 */
export function ArticleGrid({ posts, withLead = false, eagerCount = 0, basePath }: ArticleGridProps) {
    const lead = withLead && posts.length >= LEAD_COUNT ? posts.slice(0, LEAD_COUNT) : [];
    const rest = posts.slice(lead.length);
    const layout = "grid gap-x-8 gap-y-14";

    return (
        <div className="space-y-14 md:space-y-16">
            {lead.length > 0 && (
                <ul role="list" className={`${layout} md:grid-cols-2`}>
                    {lead.map((blog, index) => (
                        <li key={blog.id}>
                            <ArticleCard blog={blog} size="lead" eager={index < eagerCount} basePath={basePath} />
                        </li>
                    ))}
                </ul>
            )}

            {rest.length > 0 && (
                <ul role="list" className={`${layout} sm:grid-cols-2 lg:grid-cols-3`}>
                    {rest.map((blog, index) => (
                        <li key={blog.id}>
                            <ArticleCard blog={blog} eager={lead.length + index < eagerCount} basePath={basePath} />
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
