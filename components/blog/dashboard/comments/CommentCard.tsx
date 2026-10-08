"use client";

import { useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { format, formatDistanceToNow } from "date-fns";
import { Check, CornerDownRight, ExternalLink, EyeOff, Loader2, Mail, Reply, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AdminComment, CommentStatus } from "@/components/blog/lib/comment-types";
import { BLOG_BASE_PATH, COMMENT_SITE_NAME, blogPostPath } from "@/components/blog/lib/constants";
import { initialOf } from "@/components/blog/lib/format";
import type { DeleteCommentTarget } from "../dialogs/DeleteCommentDialog";
import { setCommentStatus, toApiFailure } from "../lib/commentsApi";
import { ReplyComposer } from "./ReplyComposer";

interface CommentCardProps {
    comment: AdminComment;
    onChanged: () => void;
    onDelete: (target: DeleteCommentTarget) => void;
}

function When({ iso, className }: { iso: string; className?: string }) {
    const date = new Date(iso);
    return (
        <time dateTime={iso} title={format(date, "PPpp")} className={cn("text-xs text-muted-foreground", className)}>
            {formatDistanceToNow(date, { addSuffix: true })}
        </time>
    );
}

function StatusPill({ status }: { status: CommentStatus }) {
    const pending = status === "pending";
    return (
        <span
            className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
                pending ? "bg-amber-500/15 text-amber-700 dark:text-amber-400" : "bg-brand-soft text-brand"
            )}
        >
            <span aria-hidden className={cn("size-1.5 rounded-full", pending ? "bg-amber-500" : "bg-brand")} />
            {pending ? "Pending review" : "Published"}
        </span>
    );
}

/** One reader comment with everything an admin can do to it: approve, reply, unpublish, reject/delete. */
export function CommentCard({ comment, onChanged, onDelete }: CommentCardProps) {
    const [replying, setReplying] = useState(false);
    const [busy, setBusy] = useState<"approve" | "unpublish" | null>(null);

    const pending = comment.status === "pending";

    // A published post links to the comment on the live page; a draft can only be opened in the editor.
    const postHref = comment.blogSlug ? `${blogPostPath(comment.blogSlug, BLOG_BASE_PATH)}#comment-${comment.id}` : `/dashboard/blog?blog=${comment.blogId}`;

    async function moderate(kind: "approve" | "unpublish") {
        setBusy(kind);
        try {
            await setCommentStatus(comment.id, kind === "approve" ? "approved" : "pending");
            toast.success(kind === "approve" ? "Comment approved and published" : "Comment unpublished");
            onChanged();
        } catch (error) {
            toast.error(toApiFailure(error).message);
        } finally {
            setBusy(null);
        }
    }

    const askDelete = () =>
        onDelete({ id: comment.id, kind: "comment", status: comment.status, authorName: comment.authorName, replyCount: comment.replies.length });

    return (
        <li className={cn("px-4 py-5 sm:px-5", pending && "bg-amber-500/[0.045]")}>
            <div className="flex items-start gap-3">
                <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-muted font-display text-base font-bold text-foreground">
                    {initialOf(comment.authorName)}
                </span>

                <div className="min-w-0 flex-1 space-y-3">
                    <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                            <span dir="auto" className="font-semibold text-foreground">
                                {comment.authorName}
                            </span>
                            <StatusPill status={comment.status} />
                            <When iso={comment.createdAt} />
                        </div>
                        {comment.authorEmail && (
                            <a
                                href={`mailto:${comment.authorEmail}`}
                                className="inline-flex max-w-full items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                            >
                                <Mail aria-hidden className="size-3.5 shrink-0" />
                                <span className="truncate" dir="ltr">
                                    {comment.authorEmail}
                                </span>
                            </a>
                        )}
                        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <span className="shrink-0">On</span>
                            <Link
                                href={postHref}
                                target={comment.blogSlug ? "_blank" : undefined}
                                rel={comment.blogSlug ? "noopener" : undefined}
                                dir="auto"
                                className="inline-flex min-w-0 items-center gap-1 font-medium text-foreground underline-offset-4 hover:text-brand hover:underline"
                            >
                                <span className="truncate">{comment.blogTitle ?? "Deleted post"}</span>
                                {comment.blogSlug && <ExternalLink aria-hidden className="size-3 shrink-0" />}
                            </Link>
                            {!comment.blogSlug && comment.blogTitle && <span className="shrink-0 text-xs">(not published)</span>}
                        </p>
                    </div>

                    <p dir="auto" className="text-[0.95rem] leading-6 break-words whitespace-pre-line text-foreground/90">
                        {comment.body}
                    </p>

                    <div className="flex flex-wrap items-center gap-2">
                        {pending ? (
                            <>
                                <Button size="sm" onClick={() => moderate("approve")} disabled={busy !== null} className="bg-brand text-brand-foreground hover:bg-brand/90">
                                    {busy === "approve" ? <Loader2 aria-hidden className="animate-spin" /> : <Check aria-hidden />}
                                    Approve
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => setReplying((open) => !open)} disabled={busy !== null} aria-expanded={replying}>
                                    <Reply aria-hidden />
                                    Approve &amp; reply
                                </Button>
                                <Button size="sm" variant="ghost" onClick={askDelete} disabled={busy !== null} className="text-destructive hover:bg-destructive/10 hover:text-destructive">
                                    <X aria-hidden />
                                    Reject
                                </Button>
                            </>
                        ) : (
                            <>
                                <Button size="sm" variant="outline" onClick={() => setReplying((open) => !open)} disabled={busy !== null} aria-expanded={replying}>
                                    <Reply aria-hidden />
                                    Reply
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => moderate("unpublish")} disabled={busy !== null}>
                                    {busy === "unpublish" ? <Loader2 aria-hidden className="animate-spin" /> : <EyeOff aria-hidden />}
                                    Unpublish
                                </Button>
                                <Button size="sm" variant="ghost" onClick={askDelete} disabled={busy !== null} className="text-destructive hover:bg-destructive/10 hover:text-destructive">
                                    <Trash2 aria-hidden />
                                    Delete
                                </Button>
                            </>
                        )}
                    </div>

                    {replying && <ReplyComposer comment={comment} onClose={() => setReplying(false)} onPosted={onChanged} />}

                    {comment.replies.length > 0 && (
                        <ul className="space-y-2" aria-label={`Replies to ${comment.authorName}`}>
                            {comment.replies.map((reply) => (
                                <li key={reply.id} className="flex items-start gap-2.5 rounded-lg border border-brand/15 border-s-[3px] border-s-brand bg-brand-soft/40 px-3 py-2.5">
                                    <CornerDownRight aria-hidden className="mt-0.5 size-4 shrink-0 text-brand rtl:-scale-x-100" />
                                    <div className="min-w-0 flex-1 space-y-1">
                                        <p className="flex flex-wrap items-center gap-x-2 text-sm">
                                            <span className="font-semibold text-foreground">{COMMENT_SITE_NAME}</span>
                                            <span className="rounded-full bg-brand px-1.5 py-px text-[0.65rem] font-semibold tracking-wide text-primary-foreground uppercase">Admin</span>
                                            <When iso={reply.createdAt} />
                                        </p>
                                        <p dir="auto" className="text-sm leading-6 break-words whitespace-pre-line text-foreground/90">
                                            {reply.body}
                                        </p>
                                    </div>
                                    <Button
                                        size="icon-xs"
                                        variant="ghost"
                                        aria-label={`Delete reply posted ${formatDistanceToNow(new Date(reply.createdAt), { addSuffix: true })}`}
                                        onClick={() => onDelete({ id: reply.id, kind: "reply", status: reply.status, authorName: COMMENT_SITE_NAME, replyCount: 0 })}
                                        className="shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                    >
                                        <Trash2 aria-hidden />
                                    </Button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </li>
    );
}
