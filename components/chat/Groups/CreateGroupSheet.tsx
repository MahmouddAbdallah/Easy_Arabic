"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeftIcon, XIcon } from "lucide-react";
import toast from "react-hot-toast";
import { cn } from "cn";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { useCreateGroup } from "../hooks/useCreateGroup";
import { useGroupCandidates } from "../hooks/useGroupCandidates";
import { validateAttachmentFile } from "../lib/attachments";
import { CHAT_ROOT_CLASS, ui } from "../lib/chatTheme";
import {
    GROUP_MAX_ADDED_MEMBERS,
    GROUP_PHOTO_MIME_TYPES,
    normalizeGroupText,
    validateGroupDescription,
    validateGroupName,
    type GroupCandidate,
    type GroupSummary,
} from "../lib/groups";
import { AddPeopleStep } from "./AddPeopleStep";
import { GroupDetailsStep } from "./GroupDetailsStep";

type Step = "people" | "details";

interface PanelProps {
    onClose: () => void;
    onCreated: (group: GroupSummary) => void;
    /** Tells the sheet that the server is being asked to create the group, so it doesn't let itself be dismissed meanwhile. */
    onBusyChange: (busy: boolean) => void;
}

/**
 * Everything the person has typed, chosen or picked lives in here. The panel only exists while the sheet is open,
 * so every "New group" starts from nothing: no leftovers of the last one, and a fresh group id.
 */
function CreateGroupPanel({ onClose, onCreated, onBusyChange }: PanelProps) {
    const [step, setStep] = useState<Step>("people");
    const [keyword, setKeyword] = useState("");
    const [selected, setSelected] = useState<ReadonlyMap<string, GroupCandidate>>(() => new Map());
    const [notice, setNotice] = useState<string | null>(null);

    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [nameTouched, setNameTouched] = useState(false);
    const [attempted, setAttempted] = useState(false);
    const [photo, setPhoto] = useState<{ file: File; previewUrl: string } | null>(null);
    const [photoError, setPhotoError] = useState<string | null>(null);

    const candidates = useGroupCandidates(keyword);
    const create = useCreateGroup();
    const nameRef = useRef<HTMLInputElement>(null);
    const previewRef = useRef<string | null>(null);

    // While the server is being asked the outcome is unknown, so the sheet can't be dismissed. An upload can be.
    useEffect(() => {
        onBusyChange(create.creating);
    }, [create.creating, onBusyChange]);
    useEffect(() => () => onBusyChange(false), [onBusyChange]);

    // The name is what comes next, so the cursor is already in it.
    useEffect(() => {
        if (step === "details") nameRef.current?.focus();
    }, [step]);

    // A preview is an object URL: it has to be released.
    useEffect(
        () => () => {
            if (previewRef.current) URL.revokeObjectURL(previewRef.current);
        },
        []
    );

    const toggle = useCallback((person: GroupCandidate) => {
        setNotice(null);
        setSelected((current) => {
            const next = new Map(current);
            if (next.has(person.id)) next.delete(person.id);
            else if (next.size < GROUP_MAX_ADDED_MEMBERS) next.set(person.id, person);
            return next;
        });
    }, []);

    const remove = useCallback((id: string) => {
        setNotice(null);
        setSelected((current) => {
            if (!current.has(id)) return current;
            const next = new Map(current);
            next.delete(id);
            return next;
        });
    }, []);

    const choosePhoto = useCallback((file: File | null) => {
        setPhotoError(null);

        if (!file) {
            if (previewRef.current) URL.revokeObjectURL(previewRef.current);
            previewRef.current = null;
            setPhoto(null);
            return;
        }

        // A file that isn't acceptable is explained and ignored: the picture chosen before it stays.
        const check = validateAttachmentFile({ name: file.name, size: file.size, type: file.type });
        if (!check.ok) {
            setPhotoError(check.message);
            return;
        }
        if (check.type !== "image" || !(GROUP_PHOTO_MIME_TYPES as readonly string[]).includes(check.mimeType)) {
            setPhotoError("Choose a JPG, PNG or WebP picture.");
            return;
        }

        if (previewRef.current) URL.revokeObjectURL(previewRef.current);
        const previewUrl = URL.createObjectURL(file);
        previewRef.current = previewUrl;
        setPhoto({ file, previewUrl });
    }, []);

    const goNext = () => {
        if (selected.size === 0) return;
        setNotice(null);
        setStep("details");
    };

    const nameError = nameTouched || attempted ? validateGroupName(name) : null;
    const descriptionError = validateGroupDescription(description);

    const submit = async () => {
        setAttempted(true);
        if (validateGroupName(name)) {
            nameRef.current?.focus();
            return;
        }
        if (descriptionError) return;
        if (selected.size === 0) {
            setStep("people");
            return;
        }

        const result = await create.submit({
            name: normalizeGroupText(name),
            description: normalizeGroupText(description),
            memberIds: [...selected.keys()],
            photo: photo?.file ?? null,
        });

        if (result.ok) {
            onCreated(result.group);
            return;
        }

        const refused = result.failure?.memberIds ?? [];
        if (refused.length > 0) {
            // The server's rules say these people can't be added: take exactly them off, and let the person look again.
            const names = refused.map((id) => selected.get(id)?.name).filter((value): value is string => !!value);
            setSelected((current) => {
                const next = new Map(current);
                for (const id of refused) next.delete(id);
                return next;
            });
            setNotice(
                names.length > 0
                    ? `${names.join(", ")} can't be added to a group, so they were taken off your list. Check it and continue.`
                    : "Some of the people you chose can't be added to a group, so they were taken off your list. Check it and continue."
            );
            create.clearFailure();
            setStep("people");
        }
    };

    const onDetails = step === "details";

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <header className="flex shrink-0 items-center gap-1 border-b border-(--chat-line) px-2 py-2.5">
                <button
                    type="button"
                    onClick={onDetails ? () => setStep("people") : onClose}
                    disabled={create.busy}
                    aria-label={onDetails ? "Back to people" : "Close"}
                    className={ui.iconButton}
                >
                    {onDetails ? <ArrowLeftIcon className="rtl:rotate-180" aria-hidden="true" /> : <XIcon aria-hidden="true" />}
                </button>
                <div className="min-w-0 flex-1 ps-1">
                    <SheetTitle className="truncate text-base leading-tight font-semibold text-(--chat-ink)">New group</SheetTitle>
                    <SheetDescription className="truncate text-xs text-(--chat-ink-3)">
                        {onDetails ? "Group details · Step 2 of 2" : "Add people · Step 1 of 2"}
                    </SheetDescription>
                </div>
            </header>

            <div key={step} className={cn("chat-rise flex min-h-0 flex-1 flex-col")}>
                {onDetails ? (
                    <GroupDetailsStep
                        name={name}
                        onNameChange={(value) => {
                            setName(value);
                            create.clearFailure();
                        }}
                        onNameBlur={() => setNameTouched(true)}
                        nameError={nameError}
                        nameRef={nameRef}
                        description={description}
                        onDescriptionChange={setDescription}
                        descriptionError={descriptionError}
                        photoPreviewUrl={photo?.previewUrl ?? null}
                        photoError={photoError}
                        onPickPhoto={choosePhoto}
                        members={[...selected.values()]}
                        onEditMembers={() => setStep("people")}
                        failure={create.failure?.message ?? null}
                        phase={create.phase}
                        progress={create.progress}
                        onSubmit={submit}
                    />
                ) : (
                    <AddPeopleStep
                        keyword={keyword}
                        onKeywordChange={setKeyword}
                        candidates={candidates}
                        selected={selected}
                        onToggle={toggle}
                        onRemove={remove}
                        notice={notice}
                        onNext={goNext}
                    />
                )}
            </div>
        </div>
    );
}

interface CreateGroupSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Where focus goes when the sheet closes (the menu button that opened it). */
    finalFocus?: () => HTMLElement | true;
}

/**
 * "Create Group": a two-step sheet (who, then what it is called) that creates the group through the chat API and
 * opens it. It slides in over the sidebar like the profile and preferences sheets, and is full screen on a phone.
 * While a group is being created it can't be dismissed, so nothing is abandoned half way.
 */
export function CreateGroupSheet({ open, onOpenChange, finalFocus }: CreateGroupSheetProps) {
    const router = useRouter();
    const pathname = usePathname();
    const busy = useRef(false);
    const onBusyChange = useCallback((value: boolean) => {
        busy.current = value;
    }, []);

    const handleOpenChange = (next: boolean) => {
        if (!next && busy.current) return;
        onOpenChange(next);
    };

    const handleCreated = (group: GroupSummary) => {
        busy.current = false;
        onOpenChange(false);
        toast.success(`"${group.name}" is ready.`, { id: "chat-group-created" });
        // The group is already in everybody's sidebar (the document is what the sidebar listens to): this just opens it.
        router.push(`${pathname}?groupId=${encodeURIComponent(group.id)}`);
    };

    return (
        <Sheet open={open} onOpenChange={handleOpenChange}>
            <SheetContent
                side="left"
                showCloseButton={false}
                finalFocus={finalFocus}
                className={`${CHAT_ROOT_CLASS} gap-0 bg-(--chat-surface) p-0 data-[side=left]:w-full data-[side=left]:sm:w-96`}
            >
                <CreateGroupPanel onClose={() => handleOpenChange(false)} onCreated={handleCreated} onBusyChange={onBusyChange} />
            </SheetContent>
        </Sheet>
    );
}
