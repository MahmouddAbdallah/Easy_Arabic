import { absoluteUrl, canonicalUrlOf } from "./lib/metadata";
import { blogPostPath } from "./lib/constants";
import { getExcerpt, type BlogRecord } from "./lib/types";

/** schema.org `BlogPosting` data, so search engines understand the post. */
export function BlogJsonLd({ blog }: { blog: BlogRecord }) {
    const url = canonicalUrlOf(blog) ?? absoluteUrl(blogPostPath(blog.slug)) ?? undefined;
    const data = {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        headline: blog.seo.title || blog.title,
        description: blog.seo.description || getExcerpt(blog) || undefined,
        image: blog.coverImage?.url,
        datePublished: blog.publishedAt ?? undefined,
        dateModified: blog.updatedAt,
        author: { "@type": "Person", name: blog.author.name },
        mainEntityOfPage: url,
        keywords: blog.tags.length ? blog.tags.join(", ") : undefined,
    };

    // The one place a string is injected as markup. `<` is escaped, so no value can close the <script>.
    return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}
