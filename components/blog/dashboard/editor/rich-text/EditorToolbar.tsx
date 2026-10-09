"use client";

import type { ReactNode } from "react";
import { useEditorState, type Editor } from "@tiptap/react";
import {
    Bold,
    Braces,
    Code,
    Heading2,
    Heading3,
    Heading4,
    Highlighter,
    ImagePlus,
    Italic,
    Link as LinkIcon,
    List,
    ListOrdered,
    Loader2,
    Minus,
    Quote,
    Redo2,
    Strikethrough,
    StickyNote,
    Underline,
    Undo2,
    Video,
    MonitorPlay,
} from "lucide-react";
import { CODE_LANGUAGES } from "@/components/blog/lib/highlight";
import { CALLOUT_VARIANTS, type CalloutVariant } from "@/components/blog/lib/types";
import { cn } from 'cn'

const CALLOUT_NAMES: Record<CalloutVariant, string> = { info: "Note", tip: "Tip", warning: "Warning", recommended: "Recommended" };

interface ToolButtonProps {
    label: string;
    onClick: () => void;
    active?: boolean;
    disabled?: boolean;
    children: ReactNode;
}

function ToolButton({ label, onClick, active = false, disabled = false, children }: ToolButtonProps) {
    return (
        <button
            type="button"
            title={label}
            aria-label={label}
            aria-pressed={active}
            disabled={disabled}
            // Keeps the editor's selection: clicking a toolbar button must not blur the text.
            onMouseDown={(event) => event.preventDefault()}
            onClick={onClick}
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-foreground/80 transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-35 aria-pressed:bg-brand-soft aria-pressed:text-brand [&_svg]:size-4"
        >
            {children}
        </button>
    );
}

const Divider = () => <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-border" />;

const fieldClass =
    "h-8 min-w-0 rounded-md border border-border bg-background px-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/30";

interface EditorToolbarProps {
    editor: Editor;
    isUploading: boolean;
    uploadProgress: number | null;
    onPickImage: () => void;
    onPickVideo: () => void;
    onOpenLink: () => void;
    onOpenEmbed: () => void;
}

export function EditorToolbar({ editor, isUploading, uploadProgress, onPickImage, onPickVideo, onOpenLink, onOpenEmbed }: EditorToolbarProps) {
    // Re-evaluated after every transaction, so buttons light up as the cursor moves.
    const state = useEditorState({
        editor,
        selector: ({ editor: current }) => ({
            bold: current.isActive("bold"),
            italic: current.isActive("italic"),
            underline: current.isActive("underline"),
            strike: current.isActive("strike"),
            code: current.isActive("code"),
            highlight: current.isActive("highlight"),
            link: current.isActive("link"),
            h2: current.isActive("heading", { level: 2 }),
            h3: current.isActive("heading", { level: 3 }),
            h4: current.isActive("heading", { level: 4 }),
            bulletList: current.isActive("bulletList"),
            orderedList: current.isActive("orderedList"),
            blockquote: current.isActive("blockquote"),
            codeBlock: current.isActive("codeBlock"),
            callout: current.isActive("callout"),
            image: current.isActive("image"),
            video: current.isActive("video"),
            embed: current.isActive("embed"),
            canUndo: current.can().undo(),
            canRedo: current.can().redo(),
            calloutVariant: String(current.getAttributes("callout").variant ?? "info"),
            codeLanguage: String(current.getAttributes("codeBlock").language ?? ""),
            imageAlt: String(current.getAttributes("image").alt ?? ""),
            imageCaption: String(current.getAttributes("image").caption ?? ""),
            videoCaption: String(current.getAttributes("video").caption ?? ""),
            embedCaption: String(current.getAttributes("embed").caption ?? ""),
            // Changes whenever the selection moves, which resets the contextual inputs below.
            selection: current.state.selection.from,
        }),
    });

    if (!state) return null;
    const run = () => editor.chain().focus();

    const toggleCallout = () => {
        if (state.callout) run().lift("callout").run();
        else run().wrapIn("callout", { variant: "info" }).run();
    };

    return (
        <div role="toolbar" aria-label="Formatting" className="rounded-t-xl border-b border-border bg-card">
            <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5">
                <ToolButton label="Undo (Ctrl+Z)" onClick={() => run().undo().run()} disabled={!state.canUndo}>
                    <Undo2 />
                </ToolButton>
                <ToolButton label="Redo (Ctrl+Shift+Z)" onClick={() => run().redo().run()} disabled={!state.canRedo}>
                    <Redo2 />
                </ToolButton>
                <Divider />

                <ToolButton label="Heading 2" active={state.h2} onClick={() => run().toggleHeading({ level: 2 }).run()}>
                    <Heading2 />
                </ToolButton>
                <ToolButton label="Heading 3" active={state.h3} onClick={() => run().toggleHeading({ level: 3 }).run()}>
                    <Heading3 />
                </ToolButton>
                <ToolButton label="Heading 4" active={state.h4} onClick={() => run().toggleHeading({ level: 4 }).run()}>
                    <Heading4 />
                </ToolButton>
                <Divider />

                <ToolButton label="Bold (Ctrl+B)" active={state.bold} onClick={() => run().toggleBold().run()}>
                    <Bold />
                </ToolButton>
                <ToolButton label="Italic (Ctrl+I)" active={state.italic} onClick={() => run().toggleItalic().run()}>
                    <Italic />
                </ToolButton>
                <ToolButton label="Underline (Ctrl+U)" active={state.underline} onClick={() => run().toggleUnderline().run()}>
                    <Underline />
                </ToolButton>
                <ToolButton label="Strikethrough" active={state.strike} onClick={() => run().toggleStrike().run()}>
                    <Strikethrough />
                </ToolButton>
                <ToolButton label="Highlight" active={state.highlight} onClick={() => run().toggleHighlight().run()}>
                    <Highlighter />
                </ToolButton>
                <ToolButton label="Inline code" active={state.code} onClick={() => run().toggleCode().run()}>
                    <Code />
                </ToolButton>
                <ToolButton label="Link (Ctrl+K)" active={state.link} onClick={onOpenLink}>
                    <LinkIcon />
                </ToolButton>
                <Divider />

                <ToolButton label="Bulleted list" active={state.bulletList} onClick={() => run().toggleBulletList().run()}>
                    <List />
                </ToolButton>
                <ToolButton label="Numbered list" active={state.orderedList} onClick={() => run().toggleOrderedList().run()}>
                    <ListOrdered />
                </ToolButton>
                <ToolButton label="Quote" active={state.blockquote} onClick={() => run().toggleBlockquote().run()}>
                    <Quote />
                </ToolButton>
                <ToolButton label="Callout box" active={state.callout} onClick={toggleCallout}>
                    <StickyNote />
                </ToolButton>
                <ToolButton label="Code block" active={state.codeBlock} onClick={() => run().toggleCodeBlock().run()}>
                    <Braces />
                </ToolButton>
                <ToolButton label="Divider" onClick={() => run().setHorizontalRule().run()}>
                    <Minus />
                </ToolButton>
                <Divider />

                <ToolButton label="Upload image" onClick={onPickImage} disabled={isUploading}>
                    <ImagePlus />
                </ToolButton>
                <ToolButton label="Upload video" onClick={onPickVideo} disabled={isUploading}>
                    <Video />
                </ToolButton>
                <ToolButton label="Embed YouTube or Vimeo" onClick={onOpenEmbed}>
                    <MonitorPlay />
                </ToolButton>

                {isUploading && (
                    <span role="status" className="ms-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Loader2 className="size-3.5 animate-spin" aria-hidden />
                        Uploading{uploadProgress !== null ? ` ${uploadProgress}%` : "…"}
                    </span>
                )}
            </div>

            {/* Options for whatever is selected: a callout's style, a code block's language, an image's text. */}
            {(state.callout || state.codeBlock || state.image || state.video || state.embed) && (
                <div className="flex flex-wrap items-center gap-2 border-t border-border bg-muted/40 px-3 py-2 text-sm">
                    {state.callout && (
                        <>
                            <span className="text-muted-foreground">Box style</span>
                            <div className="flex gap-1">
                                {CALLOUT_VARIANTS.map((variant) => (
                                    <button
                                        key={variant}
                                        type="button"
                                        aria-pressed={state.calloutVariant === variant}
                                        onMouseDown={(event) => event.preventDefault()}
                                        onClick={() => editor.chain().focus().updateAttributes("callout", { variant }).run()}
                                        className={cn(
                                            "h-7 rounded-md border px-2.5 text-xs font-medium transition-colors",
                                            state.calloutVariant === variant
                                                ? "border-brand bg-brand-soft text-brand"
                                                : "border-border bg-background text-muted-foreground hover:text-foreground"
                                        )}
                                    >
                                        {CALLOUT_NAMES[variant]}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}

                    {state.codeBlock && (
                        <label className="flex items-center gap-2">
                            <span className="text-muted-foreground">Language</span>
                            <select
                                value={state.codeLanguage}
                                onChange={(event) => editor.chain().focus().updateAttributes("codeBlock", { language: event.target.value || null }).run()}
                                className={cn(fieldClass, "w-40")}
                            >
                                {CODE_LANGUAGES.map((language) => (
                                    <option key={language.value} value={language.value}>
                                        {language.label}
                                    </option>
                                ))}
                            </select>
                        </label>
                    )}

                    {state.image && (
                        <>
                            <label className="flex min-w-48 flex-1 items-center gap-2">
                                <span className="text-muted-foreground">Description</span>
                                <input
                                    key={`alt-${state.selection}`}
                                    defaultValue={state.imageAlt}
                                    onChange={(event) => editor.chain().updateAttributes("image", { alt: event.target.value }).run()}
                                    placeholder="For screen readers and search engines"
                                    maxLength={200}
                                    className={cn(fieldClass, "min-w-0 flex-1")}
                                />
                            </label>
                            <label className="flex min-w-48 flex-1 items-center gap-2">
                                <span className="text-muted-foreground">Caption</span>
                                <input
                                    key={`cap-${state.selection}`}
                                    defaultValue={state.imageCaption}
                                    onChange={(event) => editor.chain().updateAttributes("image", { caption: event.target.value || null }).run()}
                                    placeholder="Optional, shown under the image"
                                    maxLength={300}
                                    className={cn(fieldClass, "min-w-0 flex-1")}
                                />
                            </label>
                        </>
                    )}

                    {(state.video || state.embed) && (
                        <label className="flex min-w-48 flex-1 items-center gap-2">
                            <span className="text-muted-foreground">Caption</span>
                            <input
                                key={`vcap-${state.selection}`}
                                defaultValue={state.video ? state.videoCaption : state.embedCaption}
                                onChange={(event) =>
                                    editor
                                        .chain()
                                        .updateAttributes(state.video ? "video" : "embed", { caption: event.target.value || null })
                                        .run()
                                }
                                placeholder="Optional, shown under the video"
                                maxLength={300}
                                className={cn(fieldClass, "min-w-0 flex-1")}
                            />
                        </label>
                    )}
                </div>
            )}
        </div>
    );
}
