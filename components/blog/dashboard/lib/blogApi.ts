import axios from "axios";
import {
    BLOG_API_URL,
    MEDIA_RULES,
    blogItemApiUrl,
    blogMediaApiUrl,
    type BlogMediaKind,
} from "@/components/blog/lib/constants";
import type { UpdateBlogInput } from "@/components/blog/lib/schemas";
import type { BlogAdminList, BlogAdminQuery, BlogRecord, BlogUploadedMedia } from "@/components/blog/lib/types";

/**
 * The Dashboard's only door to the Blog API. Components never call axios directly, so the URLs,
 * error handling and response shapes live in one place. (`import type` from schemas: Zod itself
 * never reaches the browser, only the inferred types.)
 */

export interface ApiFailure {
    message: string;
    code?: string;
    /** Per-field messages from the server, e.g. `{ slug: ["Another post already uses that address."] }`. */
    fieldErrors: Record<string, string[]>;
}

export function toApiFailure(error: unknown): ApiFailure {
    if (axios.isAxiosError(error)) {
        const body = error.response?.data?.error;
        if (typeof body?.message === "string" && body.message) {
            const details = body.details && typeof body.details === "object" ? (body.details as Record<string, unknown>) : {};
            const fieldErrors: Record<string, string[]> = {};
            for (const [key, value] of Object.entries(details)) {
                if (Array.isArray(value) && value.every((item) => typeof item === "string")) fieldErrors[key] = value as string[];
            }
            return { message: body.message, code: typeof body.code === "string" ? body.code : undefined, fieldErrors };
        }
        if (!error.response) {
            return { message: "Network error. Please check your connection and try again.", fieldErrors: {} };
        }
    }
    return { message: "Something went wrong. Please try again.", fieldErrors: {} };
}

export const isAborted = (error: unknown) => axios.isCancel(error);

export async function fetchBlogList(query: BlogAdminQuery, signal?: AbortSignal): Promise<BlogAdminList> {
    const { data } = await axios.get(BLOG_API_URL, {
        params: {
            page: query.page,
            pageSize: query.pageSize,
            search: query.search || undefined,
            status: query.status === "all" ? undefined : query.status,
            category: query.category || undefined,
        },
        signal,
    });
    const body = data as BlogAdminList;
    return {
        data: body.data,
        pagination: body.pagination,
        counts: body.counts,
        categories: body.categories,
        tags: body.tags,
        truncated: body.truncated,
    };
}

export async function fetchBlog(blogId: string, signal?: AbortSignal): Promise<BlogRecord> {
    const { data } = await axios.get<{ blog: BlogRecord }>(blogItemApiUrl(blogId), { signal });
    return data.blog;
}

export async function createBlogDraft(title: string): Promise<BlogRecord> {
    const { data } = await axios.post<{ blog: BlogRecord }>(BLOG_API_URL, { title });
    return data.blog;
}

export async function saveBlog(blogId: string, input: UpdateBlogInput): Promise<BlogRecord> {
    const { data } = await axios.patch<{ blog: BlogRecord }>(blogItemApiUrl(blogId), input);
    return data.blog;
}

export async function removeBlog(blogId: string): Promise<void> {
    await axios.delete(blogItemApiUrl(blogId));
}

/** Instant feedback before a large upload starts. The server checks again; this is only for speed. */
export function checkMediaFile(file: File, kind: BlogMediaKind): string | null {
    const rules = MEDIA_RULES[kind];
    if (!(rules.mimeTypes as readonly string[]).includes(file.type)) {
        return kind === "image" ? "Images must be JPG, PNG, WebP, GIF or AVIF." : "Videos must be MP4, WebM or MOV.";
    }
    if (file.size > rules.maxBytes) {
        return `That file is larger than the ${Math.round(rules.maxBytes / (1024 * 1024))} MB limit for ${kind}s.`;
    }
    return null;
}

export async function uploadBlogMedia(
    blogId: string,
    file: File,
    kind: BlogMediaKind,
    onProgress?: (percent: number) => void
): Promise<BlogUploadedMedia> {
    const form = new FormData();
    form.append("file", file);
    form.append("kind", kind);

    const { data } = await axios.post<{ media: BlogUploadedMedia }>(blogMediaApiUrl(blogId), form, {
        onUploadProgress: (event) => {
            if (event.total) onProgress?.(Math.round((event.loaded / event.total) * 100));
        },
    });
    return data.media;
}
