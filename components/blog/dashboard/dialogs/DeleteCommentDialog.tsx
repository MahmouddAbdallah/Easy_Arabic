"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { Loader2, Trash2 } from "lucide-react";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogMedia,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { CommentStatus } from "@/components/blog/lib/comment-types";
import { removeComment, toApiFailure } from "../lib/commentsApi";

/** What is about to be removed: a reader's comment (pending = "reject") or one admin reply. */
export interface DeleteCommentTarget {
    id: string;
    kind: "comment" | "reply";
    status: CommentStatus;
    authorName: string;
    /** Replies that would be removed together with a comment. */
    replyCount: number;
}

interface DeleteCommentDialogProps {
    target: DeleteCommentTarget;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onDeleted: () => void;
}

export function DeleteCommentDialog({ target, open, onOpenChange, onDeleted }: DeleteCommentDialogProps) {
    const [isDeleting, setIsDeleting] = useState(false);

    const isReply = target.kind === "reply";
    const isReject = !isReply && target.status === "pending";
    const noun = isReply ? "reply" : "comment";
    const title = isReply ? "Delete this reply?" : isReject ? "Reject this comment?" : "Delete this comment?";
    const action = isReply ? "Delete reply" : isReject ? "Reject comment" : "Delete comment";

    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            await removeComment(target.id);
            toast.success(isReject ? "Comment rejected" : `${isReply ? "Reply" : "Comment"} deleted`);
            onOpenChange(false);
            onDeleted();
        } catch (error) {
            toast.error(toApiFailure(error).message);
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <AlertDialog open={open} onOpenChange={(next) => !isDeleting && onOpenChange(next)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogMedia className="bg-destructive/10 text-destructive">
                        <Trash2 />
                    </AlertDialogMedia>
                    <AlertDialogTitle>{title}</AlertDialogTitle>
                    <AlertDialogDescription>
                        The {noun} from <span className="font-medium text-foreground">{target.authorName}</span>
                        {isReject ? " has not been shown on the blog and will be discarded. " : target.status === "approved" && !isReply ? " is live and will disappear from the post. " : " will disappear from the post. "}
                        {target.replyCount > 0 && `Its ${target.replyCount === 1 ? "reply" : `${target.replyCount} replies`} will be deleted with it. `}
                        This can’t be undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                    <AlertDialogAction variant="destructive" onClick={handleDelete} disabled={isDeleting}>
                        {isDeleting && <Loader2 className="animate-spin" />}
                        {isDeleting ? "Deleting…" : action}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
