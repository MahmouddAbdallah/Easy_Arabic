import { LogoIcon } from "@/components/icons";
import { cn } from 'cn'
import { textDirection } from "../lib/direction";
import { formatPublicDate, initialOf } from "../lib/format";
import type { PublicComment } from "../lib/comment-types";

/**
 * Which way a comment reads, from its own words (then the author's name). Explicit, not `dir="auto"`:
 * auto ignores any descendant that sets its own `dir`, so it would settle on the date text instead.
 */
const directionOf = (comment: PublicComment) => textDirection(comment.body) ?? textDirection(comment.authorName) ?? "ltr";

/** The avatar (2.5rem) and its gap (0.75rem): the body text hangs under the name by this much on larger screens. */
const HANG = "sm:ps-[3.25rem]";

/** One comment or reply. Plain text only: newlines are kept, nothing is ever turned into markup or a link. */
function CommentBody({ text }: { text: string }) {
    return (
        <p dir={textDirection(text) ?? "ltr"} className="text-base leading-7 break-words whitespace-pre-line text-foreground/90 sm:text-[1.0625rem] [&[dir=rtl]]:leading-8">
            {text}
        </p>
    );
}

function CommentHeader({ comment, official }: { comment: PublicComment; official?: boolean }) {
    return (
        <div className="flex items-center gap-3">
            <span
                aria-hidden
                className={cn(
                    "grid size-10 shrink-0 place-items-center rounded-full font-display text-lg font-bold",
                    official ? "bg-brand-soft ring-1 ring-brand/20" : "bg-muted text-foreground"
                )}
            >
                {official ? <LogoIcon className="h-[15px] w-[19px] fill-brand stroke-brand" /> : initialOf(comment.authorName)}
            </span>
            <div className="min-w-0">
                <div className="flex items-center gap-2">
                    <span dir="auto" className="min-w-0 truncate font-semibold text-foreground">
                        {comment.authorName}
                    </span>
                    {official && (
                        <span className="shrink-0 rounded-full bg-brand px-2 py-0.5 text-xs leading-4 font-semibold text-brand-foreground">Admin</span>
                    )}
                </div>
                <time dateTime={comment.createdAt} className="block text-[0.8125rem] text-muted-foreground">
                    {formatPublicDate(comment.createdAt)}
                </time>
            </div>
        </div>
    );
}

/** The approved comments of a post: each comment, with the site's replies nested one level under it. */
export function CommentThread({ comments }: { comments: PublicComment[] }) {
    return (
        <ol className="space-y-4">
            {comments.map((comment) => (
                <li key={comment.id} id={`comment-${comment.id}`} dir={directionOf(comment)} className="scroll-mt-24 rounded-2xl border border-border bg-card p-5 sm:p-6">
                    <article className="space-y-3">
                        <CommentHeader comment={comment} />
                        <div className={HANG}>
                            <CommentBody text={comment.body} />
                        </div>
                    </article>

                    {comment.replies.length > 0 && (
                        <ol className="mt-5 space-y-3 sm:ms-[3.25rem]">
                            {comment.replies.map((reply) => (
                                <li
                                    key={reply.id}
                                    id={`comment-${reply.id}`}
                                    dir={directionOf(reply)}
                                    className="scroll-mt-24 rounded-xl border border-brand/15 border-s-[3px] border-s-brand bg-brand-soft/50 px-4 py-3.5"
                                >
                                    <article className="space-y-2.5">
                                        <CommentHeader comment={reply} official />
                                        <CommentBody text={reply.body} />
                                    </article>
                                </li>
                            ))}
                        </ol>
                    )}
                </li>
            ))}
        </ol>
    );
}
