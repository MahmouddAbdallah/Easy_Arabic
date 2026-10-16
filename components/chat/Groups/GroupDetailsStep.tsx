"use client";

import { useId, useRef, type ChangeEvent, type FormEvent, type RefObject } from "react";
import { AlertCircleIcon, CameraIcon, CheckIcon, Loader2Icon, UsersIcon } from "lucide-react";
import { cn } from "cn";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { CreateGroupPhase } from "../hooks/useCreateGroup";
import { ui } from "../lib/chatTheme";
import {
    GROUP_DESCRIPTION_MAX_LENGTH,
    GROUP_NAME_MAX_LENGTH,
    GROUP_PHOTO_ACCEPT,
    firstNameOf,
    type GroupCandidate,
} from "../lib/groups";
import { PersonAvatar } from "./GroupAvatar";

/** How many members are drawn in the review before "+N more". */
const MEMBER_PREVIEW_LIMIT = 12;

const charCount = (value: string) => Array.from(value).length;

interface GroupDetailsStepProps {
    name: string;
    onNameChange: (value: string) => void;
    onNameBlur: () => void;
    nameError: string | null;
    nameRef: RefObject<HTMLInputElement | null>;
    description: string;
    onDescriptionChange: (value: string) => void;
    descriptionError: string | null;
    /** An object URL of the chosen picture, or null when there is none. */
    photoPreviewUrl: string | null;
    photoError: string | null;
    /** The person chose a file (the parent checks it) or took the picture off (null). */
    onPickPhoto: (file: File | null) => void;
    members: readonly GroupCandidate[];
    onEditMembers: () => void;
    /** Why the last attempt failed, in words. */
    failure: string | null;
    phase: CreateGroupPhase;
    /** 0-100, while the picture is uploading. */
    progress: number;
    onSubmit: () => void;
}

/**
 * Step 2: what the group is called, its picture and (optionally) what it is for, with the members shown one last time.
 * Everything is checked as the person types and again when they press Create, and the server checks it all a third time.
 */
export function GroupDetailsStep({
    name,
    onNameChange,
    onNameBlur,
    nameError,
    nameRef,
    description,
    onDescriptionChange,
    descriptionError,
    photoPreviewUrl,
    photoError,
    onPickPhoto,
    members,
    onEditMembers,
    failure,
    phase,
    progress,
    onSubmit,
}: GroupDetailsStepProps) {
    const ids = useId();
    const fileInput = useRef<HTMLInputElement>(null);
    const busy = phase !== "idle";
    const nameLength = charCount(name);
    const descriptionLength = charCount(description);

    const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0] ?? null;
        event.target.value = ""; // choosing the same file again must still count as a change
        if (file) onPickPhoto(file);
    };

    const handleSubmit = (event: FormEvent) => {
        event.preventDefault();
        onSubmit();
    };

    const shownMembers = members.slice(0, MEMBER_PREVIEW_LIMIT);
    const hiddenMembers = members.length - shownMembers.length;

    return (
        <form onSubmit={handleSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
            <fieldset disabled={busy} className="chat-scroll min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-5">
                <div className="flex flex-col items-center gap-2">
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => fileInput.current?.click()}
                            aria-label={photoPreviewUrl ? "Change group photo" : "Add group photo"}
                            className={cn("group block rounded-full", ui.focus)}
                        >
                            <Avatar className="size-28 bg-(--chat-accent-soft) ring-1 ring-(--chat-line)">
                                <AvatarImage src={photoPreviewUrl ?? undefined} alt="" className="object-cover" />
                                <AvatarFallback className="bg-(--chat-accent-soft) text-(--chat-accent-text)">
                                    <UsersIcon className="size-12" strokeWidth={1.5} aria-hidden="true" />
                                </AvatarFallback>
                            </Avatar>
                            <span className="absolute inset-0 grid place-items-center rounded-full bg-black/35 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none">
                                <CameraIcon className="size-7" aria-hidden="true" />
                            </span>
                        </button>
                        {/* A touch screen has no hover: the badge says "you can add a photo" without it. */}
                        <span
                            aria-hidden="true"
                            className="pointer-events-none absolute -bottom-0.5 -end-0.5 grid size-9 place-items-center rounded-full bg-(--chat-accent) text-(--chat-accent-ink) ring-4 ring-(--chat-surface)"
                        >
                            <CameraIcon className="size-4" />
                        </span>
                        <input
                            ref={fileInput}
                            type="file"
                            accept={GROUP_PHOTO_ACCEPT}
                            onChange={handleFile}
                            tabIndex={-1}
                            aria-hidden="true"
                            className="hidden"
                        />
                    </div>

                    {photoPreviewUrl ? (
                        <button
                            type="button"
                            onClick={() => onPickPhoto(null)}
                            className={cn("rounded-full px-2 py-1 text-[13px] font-medium text-(--chat-danger) hover:underline", ui.focus)}
                        >
                            Remove photo
                        </button>
                    ) : (
                        <p className="text-xs text-(--chat-ink-3)">Group photo (optional)</p>
                    )}
                    {photoError && (
                        <p role="alert" className="max-w-64 text-center text-xs text-(--chat-danger)">
                            {photoError}
                        </p>
                    )}
                </div>

                <div className="space-y-1.5">
                    <label htmlFor={`${ids}-name`} className="flex items-baseline justify-between px-1 text-[13px] font-medium text-(--chat-ink-2)">
                        <span>
                            Group name <span className="text-(--chat-danger)" aria-hidden="true">*</span>
                        </span>
                        <span className={cn("text-xs font-normal tabular-nums", nameLength >= GROUP_NAME_MAX_LENGTH ? "text-(--chat-danger)" : "text-(--chat-ink-3)")}>
                            {nameLength}/{GROUP_NAME_MAX_LENGTH}
                        </span>
                    </label>
                    <input
                        id={`${ids}-name`}
                        ref={nameRef}
                        value={name}
                        onChange={(event) => onNameChange(event.target.value)}
                        onBlur={onNameBlur}
                        maxLength={GROUP_NAME_MAX_LENGTH}
                        dir="auto"
                        autoComplete="off"
                        required
                        aria-required="true"
                        aria-invalid={nameError ? true : undefined}
                        aria-describedby={nameError ? `${ids}-name-error` : undefined}
                        placeholder="Name your group"
                        className={cn(ui.field, "disabled:opacity-60", nameError && "border-(--chat-danger) focus:border-(--chat-danger)")}
                    />
                    {nameError && (
                        <p id={`${ids}-name-error`} role="alert" className="px-1 text-xs text-(--chat-danger)">
                            {nameError}
                        </p>
                    )}
                </div>

                <div className="space-y-1.5">
                    <label
                        htmlFor={`${ids}-description`}
                        className="flex items-baseline justify-between px-1 text-[13px] font-medium text-(--chat-ink-2)"
                    >
                        <span>
                            Description <span className="font-normal text-(--chat-ink-3)">(optional)</span>
                        </span>
                        <span
                            className={cn(
                                "text-xs font-normal tabular-nums",
                                descriptionLength >= GROUP_DESCRIPTION_MAX_LENGTH ? "text-(--chat-danger)" : "text-(--chat-ink-3)"
                            )}
                        >
                            {descriptionLength}/{GROUP_DESCRIPTION_MAX_LENGTH}
                        </span>
                    </label>
                    <textarea
                        id={`${ids}-description`}
                        value={description}
                        onChange={(event) => onDescriptionChange(event.target.value)}
                        maxLength={GROUP_DESCRIPTION_MAX_LENGTH}
                        rows={3}
                        dir="auto"
                        aria-invalid={descriptionError ? true : undefined}
                        aria-describedby={descriptionError ? `${ids}-description-error` : undefined}
                        placeholder="What is this group for?"
                        className={cn(ui.field, "h-auto min-h-22 resize-none rounded-2xl py-3 disabled:opacity-60")}
                    />
                    {descriptionError && (
                        <p id={`${ids}-description-error`} role="alert" className="px-1 text-xs text-(--chat-danger)">
                            {descriptionError}
                        </p>
                    )}
                </div>

                <section aria-labelledby={`${ids}-members`} className="space-y-2.5">
                    <div className="flex items-center justify-between px-1">
                        <h3 id={`${ids}-members`} className="text-[13px] font-medium text-(--chat-ink-2)">
                            Members · {members.length + 1} <span className="font-normal text-(--chat-ink-3)">(including you)</span>
                        </h3>
                        <button
                            type="button"
                            onClick={onEditMembers}
                            className={cn("rounded-full px-2 py-1 text-[13px] font-medium text-(--chat-accent-text) hover:underline", ui.focus)}
                        >
                            Edit
                        </button>
                    </div>
                    <ul className="flex flex-wrap gap-x-3 gap-y-2.5 px-1">
                        {shownMembers.map((person) => (
                            <li key={person.id} className="flex w-14 flex-col items-center gap-1">
                                <PersonAvatar name={person.name} imageUrl={person.imageUrl} className="size-11" />
                                <span dir="auto" className="w-full truncate text-center text-[11px] text-(--chat-ink-2)">
                                    {firstNameOf(person.name) || person.name}
                                </span>
                            </li>
                        ))}
                        {hiddenMembers > 0 && (
                            <li className="flex w-14 flex-col items-center gap-1">
                                <span className="grid size-11 place-items-center rounded-full bg-(--chat-surface-3) text-xs font-semibold text-(--chat-ink-2)">
                                    +{hiddenMembers}
                                </span>
                                <span className="text-[11px] text-(--chat-ink-3)">more</span>
                            </li>
                        )}
                    </ul>
                </section>

                {failure && (
                    <div role="alert" className="flex items-start gap-2 rounded-xl bg-(--chat-danger-soft) p-3 text-sm text-(--chat-danger)">
                        <AlertCircleIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                        <p>{failure}</p>
                    </div>
                )}
            </fieldset>

            <div className="border-t border-(--chat-line) p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                <button type="submit" disabled={busy} className={cn(ui.primaryButton, "h-11 w-full")}>
                    {phase === "uploading" ? (
                        <>
                            <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
                            Uploading photo… {Math.round(progress)}%
                        </>
                    ) : phase === "creating" ? (
                        <>
                            <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
                            Creating group…
                        </>
                    ) : (
                        <>
                            <CheckIcon className="size-4" aria-hidden="true" />
                            Create group
                        </>
                    )}
                </button>
            </div>
        </form>
    );
}
