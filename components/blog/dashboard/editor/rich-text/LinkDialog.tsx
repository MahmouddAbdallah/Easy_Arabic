"use client";

import { useState, type FormEvent } from "react";
import type { Editor } from "@tiptap/react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { normalizeLinkInput } from "@/components/blog/lib/url";

interface LinkDialogProps {
    editor: Editor;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

/** The form lives in its own component so it mounts fresh (and re-reads the current link) every time the dialog opens. */
function LinkForm({ editor, onDone }: { editor: Editor; onDone: () => void }) {
    const existing = typeof editor.getAttributes("link").href === "string" ? (editor.getAttributes("link").href as string) : "";
    const [value, setValue] = useState(existing);
    const [error, setError] = useState<string | null>(null);

    const apply = (event: FormEvent) => {
        event.preventDefault();

        if (!value.trim()) {
            // An empty box removes the link.
            editor.chain().focus().extendMarkRange("link").unsetLink().run();
            onDone();
            return;
        }

        const href = normalizeLinkInput(value);
        if (!href) {
            setError("Enter a web address (https://…), an email address, or a path like /contact.");
            return;
        }

        if (editor.state.selection.empty && !editor.isActive("link")) {
            // Nothing selected: insert the address itself as the link text.
            editor.chain().focus().insertContent({ type: "text", text: href, marks: [{ type: "link", attrs: { href } }] }).run();
        } else {
            editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
        }
        onDone();
    };

    return (
        <form onSubmit={apply} className="grid gap-4">
            <DialogHeader>
                <DialogTitle>{existing ? "Edit link" : "Add link"}</DialogTitle>
                <DialogDescription>
                    {editor.state.selection.empty && !existing
                        ? "No text is selected, so the address itself will be inserted as the link."
                        : "The selected text will link here. Leave it empty to remove the link."}
                </DialogDescription>
            </DialogHeader>

            <div className="grid gap-1.5">
                <Label htmlFor="blog-link-url">Address</Label>
                <Input
                    id="blog-link-url"
                    autoFocus
                    value={value}
                    onChange={(event) => {
                        setValue(event.target.value);
                        setError(null);
                    }}
                    placeholder="https://example.com"
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? "blog-link-error" : undefined}
                />
                {error && (
                    <p id="blog-link-error" role="alert" className="text-xs text-destructive">
                        {error}
                    </p>
                )}
            </div>

            <DialogFooter>
                <Button type="button" variant="outline" onClick={onDone}>
                    Cancel
                </Button>
                <Button type="submit">{existing ? "Update link" : "Add link"}</Button>
            </DialogFooter>
        </form>
    );
}

export function LinkDialog({ editor, open, onOpenChange }: LinkDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent showCloseButton={false}>
                <LinkForm editor={editor} onDone={() => onOpenChange(false)} />
            </DialogContent>
        </Dialog>
    );
}
