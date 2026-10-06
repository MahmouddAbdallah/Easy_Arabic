"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import "@/components/blog/content/blog-prose.css";
import type { BlogDoc, BlogUploadedMedia } from "@/components/blog/lib/types";
import { MEDIA_RULES } from "@/components/blog/lib/constants";
import { useMediaUpload } from "../../hooks/useMediaUpload";
import { EditorToolbar } from "./EditorToolbar";
import { EmbedDialog } from "./EmbedDialog";
import { LinkDialog } from "./LinkDialog";
import { BLOG_EDITOR_EXTENSIONS } from "./extensions";
import "./editor.css";

interface RichTextEditorProps {
    /** The content to start from. Read once; the editor owns the content afterwards. */
    initialContent: BlogDoc;
    /** Uploads go into this post's media folder. */
    blogId: string;
    /** Called when the content changes, so the screen can show "unsaved changes". */
    onDirty: () => void;
    /** Hands the screen the live editor (and `null` on unmount), so it can read the content when saving. */
    onEditorChange: (editor: Editor | null) => void;
}

const isImageFile = (file: File) => (MEDIA_RULES.image.mimeTypes as readonly string[]).includes(file.type);

export function RichTextEditor({ initialContent, blogId, onDirty, onEditorChange }: RichTextEditorProps) {
    const { upload, isUploading, progress } = useMediaUpload(blogId);
    const [linkOpen, setLinkOpen] = useState(false);
    const [embedOpen, setEmbedOpen] = useState(false);
    const imageInput = useRef<HTMLInputElement>(null);
    const videoInput = useRef<HTMLInputElement>(null);

    // The editor's event handlers are created once, so they read the latest callbacks through refs.
    const editorRef = useRef<Editor | null>(null);
    const uploadRef = useRef(upload);
    const onDirtyRef = useRef(onDirty);
    useEffect(() => {
        uploadRef.current = upload;
        onDirtyRef.current = onDirty;
    }, [upload, onDirty]);

    const insertImage = useCallback((media: BlogUploadedMedia) => {
        editorRef.current
            ?.chain()
            .focus()
            .insertContent({ type: "image", attrs: { src: media.url, alt: "", width: media.width, height: media.height } })
            .run();
    }, []);

    const uploadImages = useCallback(
        async (files: File[]) => {
            // One at a time: each lands at the cursor in order, and the rate limit isn't hammered.
            for (const file of files) {
                const media = await uploadRef.current(file, "image");
                if (media) insertImage(media);
            }
        },
        [insertImage]
    );

    const editor = useEditor({
        extensions: BLOG_EDITOR_EXTENSIONS,
        content: initialContent,
        // Required in Next.js: the editor only exists in the browser, so don't render it during SSR.
        immediatelyRender: false,
        onUpdate: () => onDirtyRef.current(),
        editorProps: {
            attributes: {
                class: "blog-prose blog-editor",
                role: "textbox",
                "aria-multiline": "true",
                "aria-label": "Post content",
            },
            handlePaste: (_view, event) => {
                const data = event.clipboardData;
                if (!data) return false;
                // Only take over a pure image paste (a screenshot). Copied web or document content carries
                // text as well, and that should paste normally.
                if (data.types.includes("text/plain") || data.types.includes("text/html")) return false;
                const images = Array.from(data.files).filter(isImageFile);
                if (images.length === 0) return false;
                event.preventDefault();
                void uploadImages(images);
                return true;
            },
            handleDrop: (_view, event) => {
                const images = Array.from(event.dataTransfer?.files ?? []).filter(isImageFile);
                if (images.length === 0) return false;
                event.preventDefault();
                void uploadImages(images);
                return true;
            },
            handleKeyDown: (_view, event) => {
                if ((event.metaKey || event.ctrlKey) && !event.shiftKey && event.key.toLowerCase() === "k") {
                    event.preventDefault();
                    setLinkOpen(true);
                    return true;
                }
                return false;
            },
        },
    });

    useEffect(() => {
        editorRef.current = editor;
        onEditorChange(editor);
        return () => onEditorChange(null);
    }, [editor, onEditorChange]);

    const stats = useEditorState({
        editor,
        selector: ({ editor: current }) => {
            const text = current?.state.doc.textContent.trim();
            return { words: text ? text.split(/\s+/).length : 0 };
        },
    });

    const handleImages = async (event: ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.target.files ?? []);
        event.target.value = "";
        await uploadImages(files);
    };

    const handleVideo = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;
        const media = await upload(file, "video");
        if (media && editorRef.current) {
            editorRef.current
                .chain()
                .focus()
                .insertContent({ type: "video", attrs: { src: media.url, poster: media.poster ?? null, width: media.width, height: media.height } })
                .run();
        }
    };

    if (!editor) {
        return <div aria-busy className="h-[34rem] animate-pulse rounded-xl border border-border bg-muted/40" />;
    }

    return (
        <div className="rounded-xl border border-border bg-card shadow-xs">
            {/* Sticks under the dashboard header (4rem) and the screen's action bar (3.5rem). */}
            <div className="sticky top-[7.5rem] z-10 rounded-t-xl">
                <EditorToolbar
                    editor={editor}
                    isUploading={isUploading}
                    uploadProgress={progress}
                    onPickImage={() => imageInput.current?.click()}
                    onPickVideo={() => videoInput.current?.click()}
                    onOpenLink={() => setLinkOpen(true)}
                    onOpenEmbed={() => setEmbedOpen(true)}
                />
            </div>

            <EditorContent editor={editor} />

            <div className="flex items-center justify-between rounded-b-xl border-t border-border bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
                <span>{stats?.words ?? 0} words</span>
                <span className="hidden sm:inline">Tip: paste or drop an image straight into the text</span>
            </div>

            <input ref={imageInput} type="file" accept={MEDIA_RULES.image.mimeTypes.join(",")} multiple hidden onChange={handleImages} />
            <input ref={videoInput} type="file" accept={MEDIA_RULES.video.mimeTypes.join(",")} hidden onChange={handleVideo} />

            <LinkDialog editor={editor} open={linkOpen} onOpenChange={setLinkOpen} />
            <EmbedDialog editor={editor} open={embedOpen} onOpenChange={setEmbedOpen} />
        </div>
    );
}
