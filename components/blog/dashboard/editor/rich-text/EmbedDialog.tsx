"use client";

import { useState, type FormEvent } from "react";
import type { Editor } from "@tiptap/react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { embedLabel, parseVideoUrl } from "@/components/blog/lib/url";

interface EmbedDialogProps {
    editor: Editor;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

function EmbedForm({ editor, onDone }: { editor: Editor; onDone: () => void }) {
    const [value, setValue] = useState("");
    const [error, setError] = useState<string | null>(null);
    const detected = value.trim() ? parseVideoUrl(value) : null;

    const insert = (event: FormEvent) => {
        event.preventDefault();
        const video = parseVideoUrl(value);
        if (!video) {
            setError("That doesn't look like a YouTube or Vimeo link.");
            return;
        }
        editor.chain().focus().insertContent({ type: "embed", attrs: { provider: video.provider, videoId: video.videoId } }).run();
        onDone();
    };

    return (
        <form onSubmit={insert} className="grid gap-4">
            <DialogHeader>
                <DialogTitle>Embed a video</DialogTitle>
                <DialogDescription>Paste a YouTube or Vimeo link. Videos play on the post without leaving the page.</DialogDescription>
            </DialogHeader>

            <div className="grid gap-1.5">
                <Label htmlFor="blog-embed-url">Video link</Label>
                <Input
                    id="blog-embed-url"
                    autoFocus
                    value={value}
                    onChange={(event) => {
                        setValue(event.target.value);
                        setError(null);
                    }}
                    placeholder="https://www.youtube.com/watch?v=…"
                    aria-invalid={error ? true : undefined}
                    aria-describedby="blog-embed-hint"
                />
                <p id="blog-embed-hint" role={error ? "alert" : undefined} className={error ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
                    {error ?? (detected ? `${embedLabel(detected.provider)} found.` : "Works with watch, share, Shorts and embed links.")}
                </p>
            </div>

            <DialogFooter>
                <Button type="button" variant="outline" onClick={onDone}>
                    Cancel
                </Button>
                <Button type="submit" disabled={!detected}>
                    Insert video
                </Button>
            </DialogFooter>
        </form>
    );
}

export function EmbedDialog({ editor, open, onOpenChange }: EmbedDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent showCloseButton={false}>
                <EmbedForm editor={editor} onDone={() => onOpenChange(false)} />
            </DialogContent>
        </Dialog>
    );
}
