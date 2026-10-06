"use client";

import { useState, type FormEvent } from "react";
import toast from "react-hot-toast";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BLOG_LIMITS } from "@/components/blog/lib/constants";
import type { BlogRecord } from "@/components/blog/lib/types";
import { createBlogDraft, toApiFailure } from "../lib/blogApi";

interface NewBlogDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Called with the new draft, so the manager can open it in the editor. */
    onCreated: (blog: BlogRecord) => void;
}

/**
 * Starts a post from its title. The draft is created straight away: that gives it an id, so images
 * can be uploaded into the post's own folder from the first minute of writing.
 */
function NewBlogForm({ onCreated, onCancel }: { onCreated: (blog: BlogRecord) => void; onCancel: () => void }) {
    const [title, setTitle] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        if (!title.trim()) {
            setError("Give the post a title to start.");
            return;
        }
        setIsCreating(true);
        try {
            onCreated(await createBlogDraft(title.trim()));
        } catch (failure) {
            const message = toApiFailure(failure).message;
            setError(message);
            toast.error(message);
            setIsCreating(false);
        }
    };

    return (
        <form onSubmit={submit} className="grid gap-4">
            <DialogHeader>
                <DialogTitle>New post</DialogTitle>
                <DialogDescription>Start with a title. You can change it, and everything else, in the editor.</DialogDescription>
            </DialogHeader>

            <div className="grid gap-1.5">
                <Label htmlFor="new-blog-title">Title</Label>
                <Input
                    id="new-blog-title"
                    autoFocus
                    dir="auto"
                    value={title}
                    maxLength={BLOG_LIMITS.title}
                    onChange={(event) => {
                        setTitle(event.target.value);
                        setError(null);
                    }}
                    disabled={isCreating}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? "new-blog-error" : undefined}
                />
                {error && (
                    <p id="new-blog-error" role="alert" className="text-xs text-destructive">
                        {error}
                    </p>
                )}
            </div>

            <DialogFooter>
                <Button type="button" variant="outline" onClick={onCancel} disabled={isCreating}>
                    Cancel
                </Button>
                <Button type="submit" disabled={isCreating}>
                    {isCreating && <Loader2 className="animate-spin" aria-hidden />}
                    {isCreating ? "Creating…" : "Create draft"}
                </Button>
            </DialogFooter>
        </form>
    );
}

export function NewBlogDialog({ open, onOpenChange, onCreated }: NewBlogDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent showCloseButton={false}>
                <NewBlogForm
                    onCancel={() => onOpenChange(false)}
                    onCreated={(blog) => {
                        onOpenChange(false);
                        onCreated(blog);
                    }}
                />
            </DialogContent>
        </Dialog>
    );
}
