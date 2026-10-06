"use client";

import { useId, useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { BLOG_LIMITS } from "@/components/blog/lib/constants";
import { taxonomyKey } from "@/components/blog/lib/slug";
import { normalizeTags } from "@/components/blog/lib/taxonomy";

interface TagsInputProps {
    id: string;
    value: string[];
    onChange: (tags: string[]) => void;
    /** Tags already used on other posts, offered as completions. */
    suggestions?: string[];
}

/** Type a tag and press Enter or comma. Backspace on an empty box removes the last one. */
export function TagsInput({ id, value, onChange, suggestions = [] }: TagsInputProps) {
    const [draft, setDraft] = useState("");
    const listId = useId();
    const used = new Set(value.map(taxonomyKey));
    const available = suggestions.filter((tag) => !used.has(taxonomyKey(tag)));
    const full = value.length >= BLOG_LIMITS.tags;

    const commit = (text: string) => {
        const next = normalizeTags([...value, ...text.split(",")]);
        if (next.length !== value.length) onChange(next);
        setDraft("");
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter" || event.key === ",") {
            event.preventDefault();
            if (draft.trim()) commit(draft);
        } else if (event.key === "Backspace" && !draft && value.length > 0) {
            onChange(value.slice(0, -1));
        }
    };

    return (
        <div className="grid gap-2">
            <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-lg border border-input bg-transparent px-2 py-1.5 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
                {value.map((tag) => (
                    <span key={tag} className="inline-flex items-center gap-1 rounded-md bg-muted py-0.5 ps-2 pe-1 text-sm">
                        {tag}
                        <button
                            type="button"
                            aria-label={`Remove tag ${tag}`}
                            onClick={() => onChange(value.filter((item) => item !== tag))}
                            className="rounded p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
                        >
                            <X className="size-3" aria-hidden />
                        </button>
                    </span>
                ))}
                <input
                    id={id}
                    value={draft}
                    list={listId}
                    disabled={full}
                    maxLength={BLOG_LIMITS.tag}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={handleKeyDown}
                    onBlur={() => draft.trim() && commit(draft)}
                    placeholder={full ? "Tag limit reached" : value.length ? "" : "Add a tag…"}
                    className="min-w-24 flex-1 bg-transparent px-1 py-0.5 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
                />
                <datalist id={listId}>
                    {available.map((tag) => (
                        <option key={tag} value={tag} />
                    ))}
                </datalist>
            </div>
            <p className="text-xs text-muted-foreground">
                Press Enter or comma to add. {value.length}/{BLOG_LIMITS.tags}
            </p>
        </div>
    );
}
