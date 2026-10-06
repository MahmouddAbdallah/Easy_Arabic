"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { ExternalLink, ImageIcon, MoreHorizontal, Pencil, Send, Trash2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { blogPostPath } from "@/components/blog/lib/constants";
import { getExcerpt, type BlogSummary } from "@/components/blog/lib/types";
import { cloudinaryImageVariant } from "@/components/blog/lib/url";
import { BlogStatusBadge } from "../BlogStatusBadge";
import { saveBlog, toApiFailure } from "../lib/blogApi";

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });
const dateTimeFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

interface BlogRowProps {
    blog: BlogSummary;
    onOpen: (blogId: string) => void;
    onDelete: (blog: BlogSummary) => void;
    /** The post changed on the server (published/unpublished); the list should refresh. */
    onChanged: () => void;
}

export function BlogRow({ blog, onOpen, onDelete, onChanged }: BlogRowProps) {
    const [isChangingStatus, setIsChangingStatus] = useState(false);
    const published = blog.status === "published";
    const excerpt = getExcerpt(blog);

    const toggleStatus = async () => {
        setIsChangingStatus(true);
        try {
            await saveBlog(blog.id, { status: published ? "draft" : "published", baseUpdatedAt: blog.updatedAt });
            toast.success(published ? "Moved back to drafts" : "Post published");
            onChanged();
        } catch (error) {
            toast.error(toApiFailure(error).message);
        } finally {
            setIsChangingStatus(false);
        }
    };

    return (
        <li className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40 sm:gap-4">
            <button
                type="button"
                onClick={() => onOpen(blog.id)}
                className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-start focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:outline-none sm:gap-4"
            >
                <span className="relative hidden h-12 w-[4.5rem] shrink-0 overflow-hidden rounded-md border border-border bg-muted sm:block">
                    {blog.coverImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={cloudinaryImageVariant(blog.coverImage.url, 160)} alt="" className="size-full object-cover" loading="lazy" />
                    ) : (
                        <span className="flex size-full items-center justify-center text-muted-foreground/60">
                            <ImageIcon className="size-4" aria-hidden />
                        </span>
                    )}
                </span>

                <span className="min-w-0">
                    <span dir="auto" className="block truncate font-medium text-foreground">
                        {blog.title || "Untitled post"}
                    </span>
                    <span dir="auto" className="mt-0.5 block truncate text-sm text-muted-foreground">
                        {excerpt || "No text yet"}
                    </span>
                    {/* On small screens the status moves under the title, where the columns are hidden. */}
                    <span className="mt-1.5 flex items-center gap-2 md:hidden">
                        <BlogStatusBadge status={blog.status} />
                        <span className="text-xs text-muted-foreground">{dateFormat.format(new Date(blog.updatedAt))}</span>
                    </span>
                </span>
            </button>

            <div className="hidden w-36 shrink-0 md:block">
                {blog.category ? (
                    <span dir="auto" className="inline-block max-w-full truncate rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        {blog.category}
                    </span>
                ) : (
                    <span className="text-xs text-muted-foreground/60">No category</span>
                )}
            </div>

            <div className="hidden w-28 shrink-0 md:block">
                <BlogStatusBadge status={blog.status} />
            </div>

            <time
                dateTime={blog.updatedAt}
                title={dateTimeFormat.format(new Date(blog.updatedAt))}
                className="hidden w-28 shrink-0 text-sm text-muted-foreground lg:block"
            >
                {dateFormat.format(new Date(blog.updatedAt))}
            </time>

            <DropdownMenu>
                <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label={`Actions for ${blog.title || "untitled post"}`} />}>
                    <MoreHorizontal />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={() => onOpen(blog.id)}>
                        <Pencil /> Edit
                    </DropdownMenuItem>
                    {published && (
                        <DropdownMenuItem render={<a href={blogPostPath(blog.slug)} target="_blank" rel="noopener noreferrer" />}>
                            <ExternalLink /> View live post
                        </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={toggleStatus} disabled={isChangingStatus}>
                        {published ? <Undo2 /> : <Send />} {published ? "Unpublish" : "Publish"}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onClick={() => onDelete(blog)}>
                        <Trash2 /> Delete
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </li>
    );
}
