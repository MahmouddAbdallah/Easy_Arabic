import { BLOG_LIMITS, READING_WORDS_PER_MINUTE } from "./constants";
import { slugify } from "./slug";
import { isHttpsUrl, isValidVideoId, safeHref } from "./url";
import {
    BLOG_MARK_TYPES,
    BLOG_NODE_TYPES,
    CALLOUT_VARIANTS,
    EMBED_PROVIDERS,
    type BlogDoc,
    type BlogMark,
    type BlogMarkType,
    type BlogNode,
    type BlogNodeAttrs,
    type BlogNodeType,
    type CalloutVariant,
    type EmbedProvider,
} from "./types";

/**
 * Pure helpers for the structured post body: create, validate/sanitize, and analyze it.
 * No framework or Firebase imports, so the same code runs in the API, the data layer and the browser.
 */

export const createEmptyDoc = (): BlogDoc => ({ type: "doc", content: [{ type: "paragraph" }] });

/* -------------------------------------------------------------- Sanitizing */

/** Thrown for content that can't be stored. `path` says where, e.g. `doc.content[3].attrs`. */
export class BlogContentError extends Error {
    readonly path: string;
    constructor(message: string, path: string) {
        super(message);
        this.name = "BlogContentError";
        this.path = path;
    }
}

type ContentRule = "block" | "inline" | "listItem" | "text" | "none";

interface NodeSpec {
    /** What this node may contain. */
    rule: ContentRule;
    attrs?: (attrs: Record<string, unknown>, path: string) => BlogNodeAttrs | undefined;
}

const BLOCK_TYPES: ReadonlySet<BlogNodeType> = new Set<BlogNodeType>([
    "paragraph",
    "heading",
    "blockquote",
    "bulletList",
    "orderedList",
    "codeBlock",
    "horizontalRule",
    "image",
    "video",
    "embed",
    "callout",
]);

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

const isNodeType = (value: string): value is BlogNodeType => (BLOG_NODE_TYPES as readonly string[]).includes(value);
const isMarkType = (value: string): value is BlogMarkType => (BLOG_MARK_TYPES as readonly string[]).includes(value);

function cleanString(value: unknown, max: number): string | undefined {
    if (typeof value !== "string") return undefined;
    const trimmed = value.replace(/\u0000/g, "").trim();
    return trimmed ? trimmed.slice(0, max) : undefined;
}

function positiveInt(value: unknown, max: number): number | undefined {
    const n = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : NaN;
    return Number.isInteger(n) && n > 0 && n <= max ? n : undefined;
}

/** Drops the keys whose value is `undefined`, so attrs stay minimal and Firestore-safe. */
function compact(attrs: BlogNodeAttrs): BlogNodeAttrs | undefined {
    const entries = Object.entries(attrs).filter(([, value]) => value !== undefined && value !== null);
    return entries.length ? Object.fromEntries(entries) : undefined;
}

const NODE_SPECS: Record<Exclude<BlogNodeType, "text">, NodeSpec> = {
    paragraph: { rule: "inline" },
    heading: {
        rule: "inline",
        attrs: (attrs) => {
            const level = Number(attrs.level);
            // h1 is the post title; the body uses h2-h4.
            return { level: Number.isFinite(level) ? Math.min(4, Math.max(2, Math.round(level))) : 2 };
        },
    },
    blockquote: { rule: "block" },
    bulletList: { rule: "listItem" },
    orderedList: {
        rule: "listItem",
        attrs: (attrs) => {
            const start = positiveInt(attrs.start, 9999);
            return start && start !== 1 ? { start } : undefined;
        },
    },
    listItem: { rule: "block" },
    codeBlock: {
        rule: "text",
        attrs: (attrs) => {
            const language = typeof attrs.language === "string" ? attrs.language.toLowerCase() : "";
            return /^[a-z0-9+#._-]{1,24}$/.test(language) ? { language } : undefined;
        },
    },
    horizontalRule: { rule: "none" },
    hardBreak: { rule: "none" },
    image: {
        rule: "none",
        attrs: (attrs, path) => {
            if (!isHttpsUrl(attrs.src)) throw new BlogContentError("An image has an invalid address", path);
            return compact({
                src: attrs.src,
                alt: cleanString(attrs.alt, BLOG_LIMITS.alt),
                title: cleanString(attrs.title, BLOG_LIMITS.alt),
                caption: cleanString(attrs.caption, BLOG_LIMITS.caption),
                width: positiveInt(attrs.width, 100_000),
                height: positiveInt(attrs.height, 100_000),
            });
        },
    },
    video: {
        rule: "none",
        attrs: (attrs, path) => {
            if (!isHttpsUrl(attrs.src)) throw new BlogContentError("A video has an invalid address", path);
            return compact({
                src: attrs.src,
                poster: isHttpsUrl(attrs.poster) ? attrs.poster : undefined,
                caption: cleanString(attrs.caption, BLOG_LIMITS.caption),
                width: positiveInt(attrs.width, 100_000),
                height: positiveInt(attrs.height, 100_000),
            });
        },
    },
    embed: {
        rule: "none",
        attrs: (attrs, path) => {
            const provider = attrs.provider;
            const videoId = attrs.videoId;
            if (
                typeof provider !== "string" ||
                !(EMBED_PROVIDERS as readonly string[]).includes(provider) ||
                typeof videoId !== "string" ||
                !isValidVideoId(provider as EmbedProvider, videoId)
            ) {
                throw new BlogContentError("A video embed is not valid", path);
            }
            return compact({ provider, videoId, caption: cleanString(attrs.caption, BLOG_LIMITS.caption) });
        },
    },
    callout: {
        rule: "block",
        attrs: (attrs) => {
            const variant = (CALLOUT_VARIANTS as readonly string[]).includes(String(attrs.variant))
                ? (attrs.variant as CalloutVariant)
                : "info";
            return { variant };
        },
    },
};

function isAllowedChild(parent: ContentRule, type: BlogNodeType): boolean {
    switch (parent) {
        case "block":
            return BLOCK_TYPES.has(type);
        case "inline":
            return type === "text" || type === "hardBreak";
        case "listItem":
            return type === "listItem";
        case "text":
            return type === "text";
        case "none":
            return false;
    }
}

function sanitizeMarks(raw: unknown[], path: string): BlogMark[] | undefined {
    const seen = new Set<BlogMarkType>();
    const marks: BlogMark[] = [];

    raw.forEach((mark, index) => {
        const markPath = `${path}.marks[${index}]`;
        if (!isPlainObject(mark) || typeof mark.type !== "string" || !isMarkType(mark.type)) {
            throw new BlogContentError("Unsupported text formatting", markPath);
        }
        if (seen.has(mark.type)) return;
        seen.add(mark.type);

        if (mark.type === "link") {
            const href = safeHref(isPlainObject(mark.attrs) ? mark.attrs.href : undefined);
            // An unsafe or empty link is dropped; the text itself is kept.
            if (href) marks.push({ type: "link", attrs: { href } });
            return;
        }
        marks.push({ type: mark.type });
    });

    return marks.length ? marks : undefined;
}

interface SanitizeContext {
    nodes: number;
}

/** Returns `null` for nodes that should simply disappear (empty text). */
function sanitizeNode(
    raw: unknown,
    parent: ContentRule,
    path: string,
    depth: number,
    context: SanitizeContext
): BlogNode | null {
    if (!isPlainObject(raw)) throw new BlogContentError("Expected a content block", path);
    if (depth > BLOG_LIMITS.contentDepth) throw new BlogContentError("Content is nested too deeply", path);
    if (++context.nodes > BLOG_LIMITS.contentNodes) throw new BlogContentError("This post has too many elements", path);

    const type = raw.type;
    if (typeof type !== "string" || !isNodeType(type)) {
        throw new BlogContentError(`Unsupported content type "${String(type)}"`, path);
    }
    if (!isAllowedChild(parent, type)) throw new BlogContentError(`"${type}" is not allowed here`, path);

    if (type === "text") {
        const text = typeof raw.text === "string" ? raw.text.replace(/\u0000/g, "") : "";
        if (!text) return null;
        if (text.length > BLOG_LIMITS.textNode) throw new BlogContentError("A paragraph is too long", path);
        const node: BlogNode = { type: "text", text };
        // Code is shown as written: formatting inside a code block is meaningless.
        const marks = parent !== "text" && Array.isArray(raw.marks) ? sanitizeMarks(raw.marks, path) : undefined;
        if (marks) node.marks = marks;
        return node;
    }

    const spec = NODE_SPECS[type];
    const node: BlogNode = { type };

    const attrs = spec.attrs?.(isPlainObject(raw.attrs) ? raw.attrs : {}, path);
    if (attrs) node.attrs = attrs;

    if (spec.rule === "none") {
        if (Array.isArray(raw.content) && raw.content.length > 0) {
            throw new BlogContentError(`"${type}" cannot contain other content`, path);
        }
        return node;
    }

    const children = Array.isArray(raw.content) ? raw.content : [];
    const content = children
        .map((child, index) => sanitizeNode(child, spec.rule, `${path}.content[${index}]`, depth + 1, context))
        .filter((child): child is BlogNode => child !== null);
    if (content.length) node.content = content;

    return node;
}

/**
 * Validates an untrusted document and returns a clean copy: only known node and mark types, only
 * known attributes with checked values, https-only media, safe link targets, bounded size and depth.
 * Throws `BlogContentError` for anything that can't be made valid. This is the one gate every write
 * passes through; the renderer is written defensively too, but never has to rely on it.
 */
export function sanitizeDocument(input: unknown): BlogDoc {
    if (!isPlainObject(input) || input.type !== "doc") {
        throw new BlogContentError("The post content must be a document", "doc");
    }

    const context: SanitizeContext = { nodes: 0 };
    const children = Array.isArray(input.content) ? input.content : [];
    const content = children
        .map((child, index) => sanitizeNode(child, "block", `doc.content[${index}]`, 1, context))
        .filter((child): child is BlogNode => child !== null);

    const doc: BlogDoc = { type: "doc", content: content.length ? content : [{ type: "paragraph" }] };

    const bytes = new TextEncoder().encode(JSON.stringify(doc)).length;
    if (bytes > BLOG_LIMITS.contentBytes) throw new BlogContentError("This post is too large to save", "doc");

    return doc;
}

/** Reads stored content. Never throws: a damaged document becomes an empty one (and is logged). */
export function parseStoredContent(stored: unknown, blogId = "?"): BlogDoc {
    try {
        const value = typeof stored === "string" ? JSON.parse(stored) : stored;
        return sanitizeDocument(value);
    } catch (error) {
        console.error(`Blog ${blogId}: stored content could not be read, showing an empty body.`, error);
        return createEmptyDoc();
    }
}

/* ---------------------------------------------------------------- Analysis */

export interface BlogMediaRef {
    url: string;
    kind: "image" | "video";
}

export interface DocAnalysis {
    /** Prose only (code blocks excluded), blocks separated by a line break. */
    text: string;
    wordCount: number;
    /** Minutes, at least 1. */
    readingTime: number;
    media: BlogMediaRef[];
    hasEmbed: boolean;
    /** Nothing a reader could see: no words, no media, no embed. */
    isEmpty: boolean;
}

const BLOCKS_THAT_END_A_LINE: ReadonlySet<BlogNodeType> = new Set<BlogNodeType>([
    "paragraph",
    "heading",
    "listItem",
    "blockquote",
    "callout",
]);

export function analyzeDocument(doc: BlogDoc): DocAnalysis {
    const parts: string[] = [];
    const media: BlogMediaRef[] = [];
    let hasEmbed = false;

    const walk = (node: BlogNode) => {
        switch (node.type) {
            case "text":
                if (node.text) parts.push(node.text);
                return;
            case "hardBreak":
                parts.push(" ");
                return;
            case "codeBlock":
                return;
            case "image":
                if (typeof node.attrs?.src === "string") media.push({ url: node.attrs.src, kind: "image" });
                return;
            case "video":
                if (typeof node.attrs?.src === "string") media.push({ url: node.attrs.src, kind: "video" });
                return;
            case "embed":
                hasEmbed = true;
                return;
        }
        node.content?.forEach(walk);
        if (BLOCKS_THAT_END_A_LINE.has(node.type)) parts.push("\n");
    };
    doc.content.forEach(walk);

    const text = parts.join("").replace(/[ \t]+\n/g, "\n").replace(/\n{2,}/g, "\n").trim();
    const wordCount = text ? text.split(/\s+/).filter(Boolean).length : 0;

    return {
        text,
        wordCount,
        readingTime: Math.max(1, Math.ceil(wordCount / READING_WORDS_PER_MINUTE)),
        media,
        hasEmbed,
        isEmpty: wordCount === 0 && media.length === 0 && !hasEmbed,
    };
}

/** A short plain-text teaser: whole words, ending with an ellipsis if it was cut. */
export function deriveExcerpt(text: string, max: number = BLOG_LIMITS.autoExcerpt): string {
    const flat = text.replace(/\s+/g, " ").trim();
    if (flat.length <= max) return flat;
    const cut = flat.slice(0, max);
    const lastSpace = cut.lastIndexOf(" ");
    return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,.;:!?،؛-]+$/, "")}…`;
}

/* ---------------------------------------------------------------- Headings */

export interface BlogHeading {
    id: string;
    text: string;
    level: number;
    node: BlogNode;
}

export function nodeText(node: BlogNode): string {
    if (node.type === "text") return node.text ?? "";
    if (node.type === "hardBreak") return " ";
    return (node.content ?? []).map(nodeText).join("");
}

/**
 * The headings of a post with unique anchor ids, in document order. The renderer and the table of
 * contents both call this, so a TOC link always points at the heading it names.
 */
export function extractHeadings(doc: BlogDoc): BlogHeading[] {
    const headings: BlogHeading[] = [];
    const used = new Map<string, number>();

    const walk = (node: BlogNode) => {
        if (node.type === "heading") {
            const text = nodeText(node).replace(/\s+/g, " ").trim();
            if (text) {
                const base = slugify(text, 60) || "section";
                const seen = used.get(base) ?? 0;
                used.set(base, seen + 1);
                headings.push({
                    id: seen === 0 ? base : `${base}-${seen + 1}`,
                    text,
                    level: Number(node.attrs?.level) || 2,
                    node,
                });
            }
            return;
        }
        node.content?.forEach(walk);
    };
    doc.content.forEach(walk);

    return headings;
}
