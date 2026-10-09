"use client";

import { useId, useState } from "react";
import toast from "react-hot-toast";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from 'cn'
import type { AdminComment } from "@/components/blog/lib/comment-types";
import { COMMENT_LIMITS, COMMENT_SITE_NAME } from "@/components/blog/lib/constants";
import { replyToComment, setCommentStatus, toApiFailure } from "../lib/commentsApi";

interface ReplyComposerProps {
    comment: AdminComment;
    onClose: () => void;
    /** The reply (and, for a pending comment, its approval) went through: reload the list. */
    onPosted: () => void;
}

/**
 * Writes a reply under a comment. Replying to a comment that is still pending approves it first, so the
 * reply is never sitting under something visitors can't see; the button says so.
 */
export function ReplyComposer({ comment, onClose, onPosted }: ReplyComposerProps) {
    const fieldId = useId();
    const [text, setText] = useState("");
    const [sending, setSending] = useState(false);

    const needsApproval = comment.status === "pending";
    const length = text.trim().length;
    const tooLong = text.length > COMMENT_LIMITS.body;
    const canSend = length >= COMMENT_LIMITS.minBody && !tooLong && !sending;

    async function send() {
        if (!canSend) return;
        setSending(true);
        let approved = !needsApproval;
        try {
            if (needsApproval) {
                await setCommentStatus(comment.id, "approved");
                approved = true;
            }
            await replyToComment(comment.id, text);
            toast.success(needsApproval ? "Comment approved and reply posted" : "Reply posted");
            onPosted();
            onClose();
        } catch (error) {
            toast.error(
                approved && needsApproval
                    ? `The comment was approved, but the reply couldn’t be posted: ${toApiFailure(error).message}`
                    : toApiFailure(error).message
            );
            // Approval may have gone through even though the reply didn't: show the list as it now stands.
            if (approved && needsApproval) onPosted();
        } finally {
            setSending(false);
        }
    }

    return (
        <div className="space-y-2.5 rounded-lg border border-brand/25 bg-brand-soft/30 p-3">
            <label htmlFor={fieldId} className="block text-sm font-medium text-foreground">
                Reply as <span className="text-brand">{COMMENT_SITE_NAME}</span>
                <span className="font-normal text-muted-foreground"> — shown publicly with an “Admin” label</span>
            </label>
            <Textarea
                id={fieldId}
                dir="auto"
                autoFocus
                rows={3}
                value={text}
                disabled={sending}
                onChange={(event) => setText(event.target.value)}
                onKeyDown={(event) => {
                    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                        event.preventDefault();
                        void send();
                    }
                }}
                placeholder="Write your reply…"
                aria-invalid={tooLong}
                className="min-h-20 resize-y bg-background"
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
                <span className={cn("text-xs tabular-nums text-muted-foreground", tooLong && "font-medium text-destructive")}>
                    {text.length} / {COMMENT_LIMITS.body}
                </span>
                <div className="flex gap-2">
                    <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={sending}>
                        Cancel
                    </Button>
                    <Button type="button" size="sm" onClick={send} disabled={!canSend} className="bg-brand text-brand-foreground hover:bg-brand/90">
                        {sending ? <Loader2 aria-hidden className="animate-spin" /> : <Send aria-hidden className="rtl:-scale-x-100" />}
                        {sending ? "Posting…" : needsApproval ? "Approve & reply" : "Post reply"}
                    </Button>
                </div>
            </div>
        </div>
    );
}
