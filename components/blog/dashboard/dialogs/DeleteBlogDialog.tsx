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
import type { BlogSummary } from "@/components/blog/lib/types";
import { removeBlog, toApiFailure } from "../lib/blogApi";

interface DeleteBlogDialogProps {
    blog: Pick<BlogSummary, "id" | "title" | "status">;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onDeleted: () => void;
}

export function DeleteBlogDialog({ blog, open, onOpenChange, onDeleted }: DeleteBlogDialogProps) {
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            await removeBlog(blog.id);
            toast.success("Post deleted");
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
                    <AlertDialogTitle>Delete this post?</AlertDialogTitle>
                    <AlertDialogDescription>
                        <span className="font-medium text-foreground">“{blog.title || "Untitled post"}”</span>
                        {blog.status === "published" ? " is live and will disappear from the site. " : " "}
                        Its text and every image and video uploaded to it will be permanently deleted. This can’t be undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                    <AlertDialogAction variant="destructive" onClick={handleDelete} disabled={isDeleting}>
                        {isDeleting && <Loader2 className="animate-spin" />}
                        {isDeleting ? "Deleting…" : "Delete post"}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
