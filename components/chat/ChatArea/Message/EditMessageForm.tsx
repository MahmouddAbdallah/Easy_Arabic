"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2Icon } from "lucide-react";
import { MAX_MESSAGE_LENGTH } from "../../lib/constants";

interface EditMessageFormProps {
    initialText: string;
    saving: boolean;
    onSave: (text: string) => void;
    onCancel: () => void;
}

/** Inline editor rendered inside the sender's own bubble. Enter saves, Escape cancels. */
export function EditMessageForm({ initialText, saving, onSave, onCancel }: EditMessageFormProps) {
    const [value, setValue] = useState(initialText);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const trimmed = value.trim();
    const canSave = !saving && trimmed.length > 0 && trimmed !== initialText.trim();

    // Focus with the caret at the end.
    useEffect(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
    }, []);

    // Grow with the content.
    useEffect(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = "auto";
        el.style.height = `${el.scrollHeight}px`;
    }, [value]);

    const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key === "Escape") {
            event.preventDefault();
            if (!saving) onCancel();
            return;
        }
        // Don't submit while an IME (Arabic, CJK, ...) composition is being confirmed.
        if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            if (canSave) onSave(trimmed);
        }
    };

    return (
        <div className="flex flex-col gap-2">
            <textarea
                ref={textareaRef}
                dir="auto"
                value={value}
                rows={1}
                maxLength={MAX_MESSAGE_LENGTH}
                disabled={saving}
                aria-label="Edit message"
                onChange={(event) => setValue(event.target.value)}
                onKeyDown={handleKeyDown}
                className="max-h-48 min-h-0 w-full resize-none rounded-xl border border-(--chat-out-soft) bg-(--chat-out-soft) px-3 py-2 text-[15px] leading-[1.5] text-(--chat-out-ink) outline-none placeholder:text-(--chat-out-meta) focus:border-white/50 disabled:opacity-70"
            />
            <div className="flex items-center justify-end gap-1.5">
                <button
                    type="button"
                    disabled={saving}
                    onClick={onCancel}
                    className="inline-flex h-8 items-center rounded-full px-3 text-[13px] font-medium text-(--chat-out-ink) outline-none transition-colors hover:bg-(--chat-out-soft) focus-visible:ring-2 focus-visible:ring-white/60 disabled:opacity-60"
                >
                    Cancel
                </button>
                <button
                    type="button"
                    disabled={!canSave}
                    onClick={() => onSave(trimmed)}
                    className="inline-flex h-8 items-center gap-1.5 rounded-full bg-white px-3.5 text-[13px] font-semibold text-(--chat-accent-text) outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-white/60 disabled:opacity-50"
                >
                    {saving && <Loader2Icon className="size-3.5 animate-spin" />}
                    Save
                </button>
            </div>
        </div>
    );
}
