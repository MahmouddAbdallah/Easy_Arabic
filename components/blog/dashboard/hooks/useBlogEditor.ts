"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import type { Editor, JSONContent } from "@tiptap/react";
import { slugify } from "@/components/blog/lib/slug";
import type { BlogImage, BlogRecord, BlogSeo } from "@/components/blog/lib/types";
import { saveBlog, toApiFailure } from "../lib/blogApi";

/** The editable fields next to the body. (The body itself lives inside the Tiptap editor.) */
export interface EditorFields {
    title: string;
    slug: string;
    excerpt: string;
    /** Empty string = no category. */
    category: string;
    tags: string[];
    coverImage: BlogImage | null;
    seo: BlogSeo;
}

export const fieldsOf = (blog: BlogRecord): EditorFields => ({
    title: blog.title,
    slug: blog.slug,
    excerpt: blog.excerpt,
    category: blog.category ?? "",
    tags: blog.tags,
    coverImage: blog.coverImage,
    seo: blog.seo,
});

export type EditorAction = "save" | "publish" | "unpublish";

/* ------------------------------------------------------------ Local backup */

/**
 * While there are unsaved changes, a copy is kept in the browser every few seconds. If the tab
 * crashes, is refreshed, or the person navigates away by accident, the editor offers to restore it.
 * It is only offered when the post hasn't changed on the server since the backup was taken.
 */
interface Backup {
    baseUpdatedAt: string;
    savedAt: number;
    fields: EditorFields;
    content: JSONContent;
}

const BACKUP_INTERVAL_MS = 4000;
const BACKUP_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const backupKey = (blogId: string) => `blog-editor-backup:${blogId}`;

function readBackup(blog: BlogRecord): Backup | null {
    try {
        const raw = window.localStorage.getItem(backupKey(blog.id));
        if (!raw) return null;
        const backup = JSON.parse(raw) as Backup;
        const fresh = Date.now() - backup.savedAt < BACKUP_MAX_AGE_MS;
        if (!fresh || backup.baseUpdatedAt !== blog.updatedAt) {
            window.localStorage.removeItem(backupKey(blog.id));
            return null;
        }
        return backup;
    } catch {
        return null;
    }
}

function writeBackup(blogId: string, backup: Backup) {
    try {
        window.localStorage.setItem(backupKey(blogId), JSON.stringify(backup));
    } catch {
        // Storage full or unavailable (private mode): the backup is a convenience, never a requirement.
    }
}

function clearBackup(blogId: string) {
    try {
        window.localStorage.removeItem(backupKey(blogId));
    } catch {
        /* see above */
    }
}

/* -------------------------------------------------------------------- Hook */

export function useBlogEditor(initial: BlogRecord) {
    // The last version the server confirmed. Everything unsaved is the difference from this.
    const [blog, setBlog] = useState(initial);
    const [fields, setFields] = useState<EditorFields>(() => fieldsOf(initial));
    // The address follows the title until someone edits it by hand, or the post is published (then it's frozen).
    const [slugTouched, setSlugTouched] = useState(() => initial.status === "published" || initial.slug !== slugify(initial.title));
    const [contentDirty, setContentDirty] = useState(false);
    const [busy, setBusy] = useState<EditorAction | null>(null);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
    const [backup, setBackup] = useState<Backup | null>(() => (typeof window === "undefined" ? null : readBackup(initial)));

    const editorRef = useRef<Editor | null>(null);
    const setEditor = useCallback((editor: Editor | null) => {
        editorRef.current = editor;
    }, []);
    const markContentDirty = useCallback(() => setContentDirty(true), []);

    const fieldsDirty = JSON.stringify(fields) !== JSON.stringify(fieldsOf(blog));
    const isDirty = contentDirty || fieldsDirty;

    /* --- field editing */

    const setField = useCallback(
        <K extends keyof EditorFields>(key: K, value: EditorFields[K]) => {
            setFields((previous) => {
                const next = { ...previous, [key]: value };
                if (key === "title" && !slugTouched && blog.status === "draft") next.slug = slugify(String(value));
                return next;
            });
            if (key === "slug") setSlugTouched(true);
            setFieldErrors((previous) => (previous[key] ? { ...previous, [key]: [] } : previous));
        },
        [slugTouched, blog.status]
    );

    const regenerateSlug = useCallback(() => {
        setFields((previous) => ({ ...previous, slug: slugify(previous.title) }));
        setSlugTouched(false);
    }, []);

    /* --- saving */

    const persist = useCallback(
        async (action: EditorAction): Promise<boolean> => {
            if (busy) return false;
            setBusy(action);
            setFieldErrors({});

            try {
                // The body is read from the editor only now, so typing never has to serialise the document.
                const content = editorRef.current ? editorRef.current.getJSON() : blog.content;
                const updated = await saveBlog(blog.id, {
                    title: fields.title,
                    slug: fields.slug,
                    excerpt: fields.excerpt,
                    category: fields.category || null,
                    tags: fields.tags,
                    coverImage: fields.coverImage,
                    seo: fields.seo,
                    content,
                    // Lets the server refuse the save if someone else changed the post meanwhile.
                    baseUpdatedAt: blog.updatedAt,
                    ...(action === "publish" ? { status: "published" as const } : action === "unpublish" ? { status: "draft" as const } : {}),
                });

                setBlog(updated);
                // The server normalises category, tags and slug; show what was actually stored.
                setFields(fieldsOf(updated));
                setContentDirty(false);
                clearBackup(updated.id);
                toast.success(action === "publish" ? "Post published" : action === "unpublish" ? "Moved back to drafts" : "Saved");
                return true;
            } catch (error) {
                const failure = toApiFailure(error);
                setFieldErrors(failure.fieldErrors);
                toast.error(failure.message);
                return false;
            } finally {
                setBusy(null);
            }
        },
        [busy, blog, fields]
    );

    /* --- safety nets */

    // Browser-level warning when closing or refreshing the tab with unsaved work.
    useEffect(() => {
        if (!isDirty) return;
        const warn = (event: BeforeUnloadEvent) => {
            event.preventDefault();
            event.returnValue = "";
        };
        window.addEventListener("beforeunload", warn);
        return () => window.removeEventListener("beforeunload", warn);
    }, [isDirty]);

    // Periodic local backup while dirty. The interval reads the latest values through a ref, so it isn't recreated on every keystroke.
    const latest = useRef({ isDirty, fields, blog });
    useEffect(() => {
        latest.current = { isDirty, fields, blog };
    }, [isDirty, fields, blog]);

    useEffect(() => {
        const timer = window.setInterval(() => {
            const { isDirty: dirty, fields: currentFields, blog: currentBlog } = latest.current;
            if (!dirty) return;
            writeBackup(currentBlog.id, {
                baseUpdatedAt: currentBlog.updatedAt,
                savedAt: Date.now(),
                fields: currentFields,
                content: editorRef.current ? editorRef.current.getJSON() : (currentBlog.content as JSONContent),
            });
        }, BACKUP_INTERVAL_MS);
        return () => window.clearInterval(timer);
    }, []);

    const restoreBackup = useCallback(() => {
        if (!backup) return;
        setFields(backup.fields);
        setSlugTouched(true);
        editorRef.current?.commands.setContent(backup.content);
        setContentDirty(true);
        setBackup(null);
    }, [backup]);

    const discardBackup = useCallback(() => {
        clearBackup(blog.id);
        setBackup(null);
    }, [blog.id]);

    /** Throws away the local backup too (used when the person chooses to discard their edits). */
    const abandon = useCallback(() => clearBackup(blog.id), [blog.id]);

    return {
        blog,
        fields,
        setField,
        regenerateSlug,
        fieldErrors,
        isDirty,
        busy,
        save: () => persist("save"),
        publish: () => persist("publish"),
        unpublish: () => persist("unpublish"),
        setEditor,
        editorRef,
        markContentDirty,
        backup,
        restoreBackup,
        discardBackup,
        abandon,
    };
}
