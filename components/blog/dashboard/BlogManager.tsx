"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowLeft, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BlogRecord } from "@/components/blog/lib/types";
import { NewBlogDialog } from "./dialogs/NewBlogDialog";
import { BlogEditor } from "./editor/BlogEditor";
import { useBlogList } from "./hooks/useBlogList";
import { fetchBlog, isAborted, toApiFailure } from "./lib/blogApi";
import { BlogListView } from "./list/BlogListView";

export interface BlogManagerProps {
    /**
     * Name of the URL query parameter that holds the open post's id (`?blog=<id>`). Opening a post
     * adds it, closing removes it, so a post has a shareable address and Back/refresh work, on
     * whichever page this component is rendered. Change it only if `blog` clashes with another param.
     */
    paramName?: string;
}

/* ------------------------------------------------------------ Loading one */

function EditorLoader({ blogId, suggestions, onClose }: { blogId: string; suggestions: { categories: string[]; tags: string[] }; onClose: () => void }) {
    const [reloadToken, setReloadToken] = useState(0);
    const [state, setState] = useState<{ key: string; blog: BlogRecord | null; error: string | null } | null>(null);
    const key = `${blogId}:${reloadToken}`;

    useEffect(() => {
        const controller = new AbortController();
        fetchBlog(blogId, controller.signal)
            .then((blog) => setState({ key, blog, error: null }))
            .catch((error) => {
                if (isAborted(error)) return;
                setState({ key, blog: null, error: toApiFailure(error).message });
            });
        return () => controller.abort();
    }, [blogId, key]);

    // A result for a previous post (or a previous retry) is not an answer to this request.
    const current = state?.key === key ? state : null;

    if (!current) {
        return (
            <div aria-busy className="mx-auto w-full max-w-[88rem] space-y-4 p-4 sm:p-6 lg:p-8">
                <div className="h-9 w-2/3 animate-pulse rounded-lg bg-muted" />
                <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
                    <div className="h-[34rem] animate-pulse rounded-xl border border-border bg-muted/40" />
                    <div className="hidden h-[34rem] animate-pulse rounded-xl border border-border bg-muted/40 xl:block" />
                </div>
            </div>
        );
    }

    if (current.error || !current.blog) {
        return (
            <div role="alert" className="mx-auto flex max-w-md flex-col items-center gap-3 px-6 py-24 text-center">
                <AlertTriangle className="size-8 text-destructive" aria-hidden />
                <p className="font-medium text-foreground">This post couldn’t be opened</p>
                <p className="text-sm text-muted-foreground">{current.error}</p>
                <div className="mt-2 flex gap-2">
                    <Button variant="outline" onClick={onClose}>
                        <ArrowLeft aria-hidden />
                        All posts
                    </Button>
                    <Button onClick={() => setReloadToken((token) => token + 1)}>
                        <RotateCw aria-hidden />
                        Try again
                    </Button>
                </div>
            </div>
        );
    }

    return <BlogEditor key={current.blog.id} blog={current.blog} suggestions={suggestions} onClose={onClose} />;
}

/* ---------------------------------------------------------------- Manager */

function BlogManagerInner({ paramName = "blog" }: BlogManagerProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const openId = searchParams.get(paramName);

    const list = useBlogList();
    const { reload } = list;
    const [isCreating, setIsCreating] = useState(false);

    const open = useCallback(
        (blogId: string | null) => {
            const next = new URLSearchParams(searchParams.toString());
            if (blogId) next.set(paramName, blogId);
            else next.delete(paramName);
            const query = next.toString();
            router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
        },
        [router, pathname, searchParams, paramName]
    );

    const closeEditor = useCallback(() => {
        // The post may have been saved, published or deleted while it was open.
        reload();
        open(null);
    }, [reload, open]);

    // The editor offers what the list already knows about, so categories and tags stay consistent.
    const categories = list.list?.categories;
    const tags = list.list?.tags;
    const suggestions = useMemo(() => ({ categories: categories ?? [], tags: tags ?? [] }), [categories, tags]);

    return (
        <>
            {openId ? <EditorLoader blogId={openId} suggestions={suggestions} onClose={closeEditor} /> : <BlogListView list={list} onOpen={open} onNew={() => setIsCreating(true)} />}

            <NewBlogDialog
                open={isCreating}
                onOpenChange={setIsCreating}
                onCreated={(blog) => {
                    reload();
                    open(blog.id);
                }}
            />
        </>
    );
}

/**
 * The whole Blog admin: list, create, edit, publish, delete, in one component. It talks only to
 * /api/blog and keeps its own state, so it can be rendered from any Dashboard route:
 *
 *     <BlogManager />
 *
 * Access is enforced by the API (admins only). A host page should also check the session, as
 * app/dashboard/blog/page.tsx does, to redirect people who can't use it instead of showing errors.
 */
export function BlogManager(props: BlogManagerProps) {
    return (
        // useSearchParams needs a Suspense boundary above it.
        <Suspense fallback={<div aria-busy className="mx-auto h-96 w-full max-w-6xl animate-pulse rounded-xl bg-muted/40 m-6" />}>
            <BlogManagerInner {...props} />
        </Suspense>
    );
}
