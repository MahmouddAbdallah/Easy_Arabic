"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BlogContentError, sanitizeDocument } from "@/components/blog/lib/content";
import { BLOG_LIMITS } from "@/components/blog/lib/constants";
import type { BlogDoc, BlogRecord } from "@/components/blog/lib/types";
import { displayFont } from "@/lib/fonts";
import { cn } from "@/lib/utils";
import { DeleteBlogDialog } from "../dialogs/DeleteBlogDialog";
import { DiscardChangesDialog } from "../dialogs/DiscardChangesDialog";
import { useBlogEditor } from "../hooks/useBlogEditor";
import { BlogSettingsPanel } from "./BlogSettingsPanel";
import { EditorHeader, type EditorView } from "./EditorHeader";
import { PreviewPane } from "./PreviewPane";
import { RichTextEditor } from "./rich-text/RichTextEditor";

interface BlogEditorProps {
    blog: BlogRecord;
    /** Categories and tags already in use, offered as completions. */
    suggestions: { categories: string[]; tags: string[] };
    /** Leave the editor (back to the list). Also called after the post is deleted. */
    onClose: () => void;
}

/** The full editing screen for one post: title, body, settings, preview, and the save/publish actions. */
export function BlogEditor({ blog: initial, suggestions, onClose }: BlogEditorProps) {
    const editor = useBlogEditor(initial);
    const { blog, fields, setField, fieldErrors, isDirty, busy, backup } = editor;

    const [view, setView] = useState<EditorView>("write");
    const [previewDoc, setPreviewDoc] = useState<BlogDoc | null>(null);
    const [previewError, setPreviewError] = useState<string | null>(null);
    const [confirmLeave, setConfirmLeave] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);

    // Ctrl/Cmd+S saves, wherever focus is. Kept in a ref so the listener is attached once.
    const saveRef = useRef(editor.save);
    useEffect(() => {
        saveRef.current = editor.save;
    }, [editor.save]);
    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
                event.preventDefault();
                void saveRef.current();
            }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, []);

    const changeView = useCallback(
        (next: EditorView) => {
            if (next === "preview") {
                // Validate the live body the same way the server will, so problems show up here, before saving.
                try {
                    const json = editor.editorRef.current?.getJSON();
                    setPreviewDoc(json ? sanitizeDocument(json) : blog.content);
                    setPreviewError(null);
                } catch (error) {
                    setPreviewDoc(null);
                    setPreviewError(error instanceof BlogContentError ? error.message : "The content couldn't be read.");
                }
            }
            setView(next);
        },
        [editor.editorRef, blog.content]
    );

    const requestClose = () => (isDirty ? setConfirmLeave(true) : onClose());

    return (
        <div className={cn(displayFont.variable, "min-h-full")}>
            <EditorHeader
                status={blog.status}
                slug={blog.slug}
                isDirty={isDirty}
                busy={busy}
                view={view}
                onViewChange={changeView}
                onBack={requestClose}
                onSave={() => void editor.save()}
                onPublish={() => void editor.publish()}
                onUnpublish={() => void editor.unpublish()}
                onDelete={() => setConfirmDelete(true)}
            />

            <div className="mx-auto w-full max-w-352 px-4 py-6 sm:px-6 lg:px-8">
                {backup && (
                    <div role="status" className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
                        <RotateCcw className="size-4 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden />
                        <p className="min-w-0 flex-1 text-foreground">
                            You have unsaved changes from {new Date(backup.savedAt).toLocaleString()} that weren’t saved. Restore them?
                        </p>
                        <div className="flex gap-2">
                            <Button type="button" size="sm" variant="outline" onClick={editor.discardBackup}>
                                Discard
                            </Button>
                            <Button type="button" size="sm" onClick={editor.restoreBackup}>
                                Restore
                            </Button>
                        </div>
                    </div>
                )}

                <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
                    <div className="min-w-0">
                        {/* Hidden (not unmounted) while previewing, so the editor keeps its content and undo history. */}
                        <div hidden={view !== "write"} className="grid gap-4">
                            <div className="grid gap-1.5">
                                <label htmlFor="blog-title" className="sr-only">
                                    Title
                                </label>
                                <textarea
                                    id="blog-title"
                                    dir="auto"
                                    rows={1}
                                    value={fields.title}
                                    maxLength={BLOG_LIMITS.title}
                                    onChange={(event) => setField("title", event.target.value.replace(/\n/g, " "))}
                                    placeholder="Post title"
                                    aria-invalid={fieldErrors.title?.length ? true : undefined}
                                    className="field-sizing-content w-full resize-none rounded-lg bg-transparent px-1 py-1 font-display text-3xl leading-tight font-bold tracking-tight text-foreground outline-none placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-brand/30 md:text-4xl"
                                />
                                {fieldErrors.title?.[0] && (
                                    <p role="alert" className="px-1 text-xs text-destructive">
                                        {fieldErrors.title[0]}
                                    </p>
                                )}
                                {fieldErrors.content?.[0] && (
                                    <p role="alert" className="px-1 text-xs text-destructive">
                                        {fieldErrors.content[0]}
                                    </p>
                                )}
                            </div>

                            <RichTextEditor
                                initialContent={initial.content}
                                blogId={blog.id}
                                onDirty={editor.markContentDirty}
                                onEditorChange={editor.setEditor}
                            />
                        </div>

                        {view === "preview" && <PreviewPane blog={blog} fields={fields} doc={previewDoc} error={previewError} />}
                    </div>

                    <div className="lg:sticky lg:top-0">
                        <BlogSettingsPanel
                            blog={blog}
                            fields={fields}
                            setField={setField}
                            regenerateSlug={editor.regenerateSlug}
                            fieldErrors={fieldErrors}
                            suggestions={suggestions}
                        />
                    </div>
                </div>
            </div>

            <DiscardChangesDialog
                open={confirmLeave}
                onOpenChange={setConfirmLeave}
                onDiscard={() => {
                    // Discarding means discarding: don't offer the same edits back next time.
                    editor.abandon();
                    onClose();
                }}
            />
            <DeleteBlogDialog blog={blog} open={confirmDelete} onOpenChange={setConfirmDelete} onDeleted={onClose} />
        </div>
    );
}
