import { Fragment, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { extractHeadings, nodeText } from "../lib/content";
import { textDirection } from "../lib/direction";
import { CALLOUT_VARIANTS, type BlogDoc, type BlogMark, type BlogNode, type CalloutVariant, type EmbedProvider } from "../lib/types";
import {
    cloudinaryImageVariant,
    cloudinarySrcSet,
    embedLabel,
    embedUrl,
    isExternalHref,
    isHttpsUrl,
    isValidVideoId,
    safeHref,
} from "../lib/url";
import { CodeBlock } from "./CodeBlock";
import "./blog-prose.css";

/**
 * Turns a structured post body into React elements.
 *
 * - Has no browser or server-only imports, so it renders on the server for visitors and in the
 *   browser for the dashboard's live preview: the preview is the real thing, not an approximation.
 * - Is a whitelist: every node type and mark is handled explicitly, anything unknown renders nothing.
 * - Never uses `dangerouslySetInnerHTML`, and re-checks every URL it puts in the page, so stored
 *   content is not trusted even though it was sanitized when it was saved.
 */

type HeadingIds = ReadonlyMap<BlogNode, string>;

const CALLOUT_LABELS: Record<CalloutVariant, string> = {
    info: "Note",
    tip: "Tip",
    warning: "Warning",
    recommended: "Recommended",
};

/** Marks are wrapped inside-out in this order, so a link always sits outside bold/italic. */
const MARK_ORDER: BlogMark["type"][] = ["code", "bold", "italic", "strike", "underline", "highlight", "link"];

function wrapMark(mark: BlogMark, children: ReactNode): ReactNode {
    switch (mark.type) {
        case "code":
            return <code>{children}</code>;
        case "bold":
            return <strong>{children}</strong>;
        case "italic":
            return <em>{children}</em>;
        case "strike":
            return <s>{children}</s>;
        case "underline":
            return <u>{children}</u>;
        case "highlight":
            return <mark>{children}</mark>;
        case "link": {
            const href = safeHref(mark.attrs?.href);
            if (!href) return children;
            return isExternalHref(href) ? (
                <a href={href} target="_blank" rel="noopener noreferrer">
                    {children}
                </a>
            ) : (
                <a href={href}>{children}</a>
            );
        }
        default:
            return children;
    }
}

function renderText(node: BlogNode, key: number): ReactNode {
    let output: ReactNode = node.text ?? "";
    const marks = [...(node.marks ?? [])].sort((a, b) => MARK_ORDER.indexOf(a.type) - MARK_ORDER.indexOf(b.type));
    for (const mark of marks) output = wrapMark(mark, output);
    return <Fragment key={key}>{output}</Fragment>;
}

function renderInline(nodes: BlogNode[] | undefined): ReactNode[] {
    return (nodes ?? []).map((node, index) => {
        if (node.type === "text") return renderText(node, index);
        if (node.type === "hardBreak") return <br key={index} />;
        return null;
    });
}

/** Direction of a block, from its own text. `undefined` (no attribute) lets neutral content inherit. */
const dirOf = (node: BlogNode) => textDirection(nodeText(node)) ?? undefined;
/** A list reads in the direction of its first item, so its bullets/numbers sit on the matching side. */
const listDirOf = (node: BlogNode) => (node.content?.[0] ? dirOf(node.content[0]) : undefined);

const asString = (value: unknown): string | undefined => (typeof value === "string" && value ? value : undefined);
const asDimension = (value: unknown): number | undefined => (typeof value === "number" && value > 0 ? value : undefined);

function Caption({ text }: { text: string | undefined }) {
    return text ? <figcaption dir="auto">{text}</figcaption> : null;
}

function ImageBlock({ node }: { node: BlogNode }) {
    const src = asString(node.attrs?.src);
    if (!src || !isHttpsUrl(src)) return null;
    const srcSet = cloudinarySrcSet(src);
    const width = asDimension(node.attrs?.width);

    return (
        <figure className="blog-figure">
            {/* A plain <img>: post images come from Cloudinary with its own resizing, and next/image would need every host allow-listed. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src={cloudinaryImageVariant(src, 1200)}
                srcSet={srcSet}
                // The article column is 632px wide: no point asking for more than that.
                sizes={srcSet ? "(min-width: 672px) 632px, 100vw" : undefined}
                alt={asString(node.attrs?.alt) ?? ""}
                width={width}
                height={asDimension(node.attrs?.height)}
                // A small picture stays small instead of being stretched to the column.
                style={width ? { maxWidth: `min(100%, ${width}px)` } : undefined}
                loading="lazy"
                decoding="async"
            />
            <Caption text={asString(node.attrs?.caption)} />
        </figure>
    );
}

function VideoBlock({ node }: { node: BlogNode }) {
    const src = asString(node.attrs?.src);
    if (!src || !isHttpsUrl(src)) return null;
    const poster = asString(node.attrs?.poster);
    const width = asDimension(node.attrs?.width);
    const height = asDimension(node.attrs?.height);

    return (
        <figure className="blog-figure">
            <video
                controls
                playsInline
                preload="metadata"
                poster={poster && isHttpsUrl(poster) ? poster : undefined}
                width={width}
                height={height}
                // Holds the video's real shape while it loads, so the page doesn't jump when it appears.
                style={width && height ? { aspectRatio: `${width} / ${height}` } : undefined}
            >
                <source src={src} />
                <a href={src}>Download the video</a>
            </video>
            <Caption text={asString(node.attrs?.caption)} />
        </figure>
    );
}

function EmbedBlock({ node }: { node: BlogNode }) {
    const provider = node.attrs?.provider as EmbedProvider | undefined;
    const videoId = asString(node.attrs?.videoId);
    if (!provider || !videoId || !isValidVideoId(provider, videoId)) return null;

    return (
        <figure className="blog-figure">
            <div className="blog-embed-frame">
                {/* The address is rebuilt from the provider and id; it is never taken from stored text. */}
                <iframe
                    src={embedUrl(provider, videoId)}
                    title={asString(node.attrs?.caption) ?? embedLabel(provider)}
                    loading="lazy"
                    allow="encrypted-media; fullscreen; picture-in-picture"
                    allowFullScreen
                    referrerPolicy="strict-origin-when-cross-origin"
                />
            </div>
            <Caption text={asString(node.attrs?.caption)} />
        </figure>
    );
}

function renderBlock(node: BlogNode, key: number, headingIds: HeadingIds): ReactNode {
    switch (node.type) {
        case "paragraph":
            // Editors keep empty paragraphs around as cursor targets; readers shouldn't see the gaps.
            return node.content?.length ? (
                <p key={key} dir={dirOf(node)}>
                    {renderInline(node.content)}
                </p>
            ) : null;

        case "heading": {
            const level = Math.min(4, Math.max(2, Number(node.attrs?.level) || 2));
            const Tag = `h${level}` as "h2" | "h3" | "h4";
            return (
                <Tag key={key} id={headingIds.get(node)} dir={dirOf(node)}>
                    {renderInline(node.content)}
                </Tag>
            );
        }

        case "blockquote":
            return (
                <blockquote key={key} dir={dirOf(node)}>
                    {renderBlocks(node.content, headingIds)}
                </blockquote>
            );

        case "bulletList":
            return (
                <ul key={key} dir={listDirOf(node)}>
                    {renderBlocks(node.content, headingIds)}
                </ul>
            );

        case "orderedList": {
            const start = asDimension(node.attrs?.start);
            return (
                <ol key={key} dir={listDirOf(node)} start={start && start !== 1 ? start : undefined}>
                    {renderBlocks(node.content, headingIds)}
                </ol>
            );
        }

        case "listItem":
            return (
                <li key={key} dir={dirOf(node)}>
                    {renderBlocks(node.content, headingIds)}
                </li>
            );

        case "codeBlock":
            return <CodeBlock key={key} code={nodeText(node)} language={asString(node.attrs?.language)} />;

        case "horizontalRule":
            return <hr key={key} />;

        case "image":
            return <ImageBlock key={key} node={node} />;

        case "video":
            return <VideoBlock key={key} node={node} />;

        case "embed":
            return <EmbedBlock key={key} node={node} />;

        case "callout": {
            const raw = node.attrs?.variant;
            // Checked against the list, not with `in`: "constructor" and friends are "in" every object.
            const variant: CalloutVariant = (CALLOUT_VARIANTS as readonly unknown[]).includes(raw) ? (raw as CalloutVariant) : "info";
            return (
                <aside key={key} className="blog-callout" data-variant={variant} role="note" aria-label={CALLOUT_LABELS[variant]} dir={dirOf(node)}>
                    {renderBlocks(node.content, headingIds)}
                </aside>
            );
        }

        default:
            // Unknown or misplaced node: render nothing rather than guess.
            return null;
    }
}

function renderBlocks(nodes: BlogNode[] | undefined, headingIds: HeadingIds): ReactNode[] {
    return (nodes ?? []).map((node, index) => renderBlock(node, index, headingIds));
}

export interface BlogContentProps {
    doc: BlogDoc;
    className?: string;
}

export function BlogContent({ doc, className }: BlogContentProps) {
    const headingIds: HeadingIds = new Map(extractHeadings(doc).map((heading) => [heading.node, heading.id]));
    return <div className={cn("blog-prose", className)}>{renderBlocks(doc.content, headingIds)}</div>;
}
