"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
            <Textarea
                ref={textareaRef}
                value={value}
                rows={1}
                maxLength={MAX_MESSAGE_LENGTH}
                disabled={saving}
                aria-label="Edit message"
                onChange={(event) => setValue(event.target.value)}
                onKeyDown={handleKeyDown}
                className="min-h-0 max-h-48 resize-none rounded-lg border-primary-foreground/25 bg-primary-foreground/10 px-2.5 py-1.5 text-[12px] leading-relaxed text-primary-foreground focus-visible:border-primary-foreground/50 focus-visible:ring-primary-foreground/20 md:text-[13px] dark:bg-primary-foreground/10"
            />
            <div className="flex items-center justify-end gap-1.5">
                <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    disabled={saving}
                    onClick={onCancel}
                    className="text-primary-foreground/90 hover:bg-primary-foreground/10 hover:text-primary-foreground dark:hover:bg-primary-foreground/10"
                >
                    Cancel
                </Button>
                <Button
                    type="button"
                    size="xs"
                    disabled={!canSave}
                    onClick={() => onSave(trimmed)}
                    className="bg-primary-foreground text-primary hover:bg-primary-foreground/90"
                >
                    {saving && <Loader2Icon className="animate-spin" />}
                    Save
                </Button>
            </div>
        </div>
    );
}
