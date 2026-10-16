"use client";

import { ArrowRightIcon, CheckIcon, InfoIcon, Loader2Icon, RefreshCwIcon, SearchIcon, UserRoundXIcon, XIcon } from "lucide-react";
import { cn } from "cn";
import type { GroupCandidatesHandle } from "../hooks/useGroupCandidates";
import { ui } from "../lib/chatTheme";
import { GROUP_MAX_ADDED_MEMBERS, firstNameOf, type GroupCandidate } from "../lib/groups";
import { getRoleLabel } from "../lib/roles";
import { PersonAvatar } from "./GroupAvatar";

function PersonRowSkeleton() {
    return (
        <li className="flex items-center gap-3 px-3 py-2" aria-hidden="true">
            <div className="chat-skeleton size-10 shrink-0 rounded-full" />
            <div className="flex flex-1 flex-col gap-2">
                <div className="chat-skeleton h-3.5 w-2/5 rounded-md" />
                <div className="chat-skeleton h-3 w-1/5 rounded-md" />
            </div>
        </li>
    );
}

interface PersonRowProps {
    person: GroupCandidate;
    checked: boolean;
    /** The group is full: nobody else can be chosen (but a chosen person can still be taken off). */
    disabled: boolean;
    onToggle: (person: GroupCandidate) => void;
}

/** One person: the whole row is the checkbox's label, so a tap anywhere on it chooses them, and the keyboard works as usual. */
function PersonRow({ person, checked, disabled, onToggle }: PersonRowProps) {
    const role = getRoleLabel(person.role);
    return (
        <li>
            <label
                className={cn(
                    "flex cursor-pointer items-center gap-3 px-3 py-2 transition-colors motion-reduce:transition-none",
                    "hover:bg-(--chat-surface-2) has-checked:bg-(--chat-accent-soft) has-disabled:cursor-not-allowed has-disabled:opacity-50"
                )}
            >
                <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    onChange={() => onToggle(person)}
                    className="peer sr-only"
                />
                <PersonAvatar name={person.name} imageUrl={person.imageUrl} className="size-10" />
                <span className="flex min-w-0 flex-1 flex-col">
                    <span dir="auto" className="truncate text-[15px] font-medium text-(--chat-ink)">
                        {person.name}
                    </span>
                    {role && <span className="truncate text-[13px] text-(--chat-ink-3)">{role}</span>}
                </span>
                <span
                    aria-hidden="true"
                    className={cn(
                        "grid size-6 shrink-0 place-items-center rounded-full border-2 border-(--chat-line-strong) text-transparent transition-colors motion-reduce:transition-none",
                        "peer-checked:border-(--chat-accent) peer-checked:bg-(--chat-accent) peer-checked:text-(--chat-accent-ink)",
                        "peer-focus-visible:ring-2 peer-focus-visible:ring-(--chat-accent-ring) peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-(--chat-surface)"
                    )}
                >
                    <CheckIcon className="size-3.5" strokeWidth={3} />
                </span>
            </label>
        </li>
    );
}

interface AddPeopleStepProps {
    keyword: string;
    onKeywordChange: (value: string) => void;
    candidates: GroupCandidatesHandle;
    selected: ReadonlyMap<string, GroupCandidate>;
    onToggle: (person: GroupCandidate) => void;
    onRemove: (id: string) => void;
    /** Something the person should know before going on, e.g. who had to be taken off the list. */
    notice: string | null;
    onNext: () => void;
}

/**
 * Step 1: who is in the group. Search narrows the list, a tap chooses (or un-chooses) a person, and everybody
 * chosen stays visible as a chip above the list even when the search no longer shows them.
 */
export function AddPeopleStep({ keyword, onKeywordChange, candidates, selected, onToggle, onRemove, notice, onNext }: AddPeopleStepProps) {
    const { people, hasMore, loading, refreshing, error, retry } = candidates;
    const count = selected.size;
    const full = count >= GROUP_MAX_ADDED_MEMBERS;
    const searching = keyword.trim().length > 0;

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <div className="px-3 pt-3 pb-2">
                <div className="group relative flex items-center">
                    <SearchIcon
                        className="pointer-events-none absolute start-3.5 z-10 size-[18px] text-(--chat-ink-3) transition-colors group-focus-within:text-(--chat-accent-text)"
                        aria-hidden="true"
                    />
                    <input
                        value={keyword}
                        onChange={(event) => onKeywordChange(event.target.value)}
                        dir="auto"
                        inputMode="search"
                        enterKeyHint="search"
                        autoComplete="off"
                        aria-label="Search people to add"
                        placeholder="Search people"
                        className={cn(ui.field, "ps-11 pe-11")}
                    />
                    <div className="absolute end-2 z-10 flex items-center">
                        {refreshing && searching ? (
                            <Loader2Icon className="mx-2 size-4 animate-spin text-(--chat-accent-text)" aria-hidden="true" />
                        ) : keyword ? (
                            <button
                                type="button"
                                onClick={() => onKeywordChange("")}
                                aria-label="Clear search"
                                className="grid size-7 place-items-center rounded-full text-(--chat-ink-3) outline-none transition-colors hover:bg-(--chat-line) hover:text-(--chat-ink) focus-visible:ring-2 focus-visible:ring-(--chat-accent-ring)"
                            >
                                <XIcon className="size-4" aria-hidden="true" />
                            </button>
                        ) : null}
                    </div>
                </div>
            </div>

            {count > 0 && (
                <ul aria-label="Chosen people" className="chat-scroll flex shrink-0 gap-2 overflow-x-auto px-3 pb-2">
                    {[...selected.values()].map((person) => (
                        <li key={person.id} className="chat-rise shrink-0">
                            <button
                                type="button"
                                onClick={() => onRemove(person.id)}
                                aria-label={`Remove ${person.name}`}
                                className={cn(
                                    "flex max-w-40 items-center gap-1.5 rounded-full bg-(--chat-accent-soft) py-1 ps-1 pe-2 text-[13px] font-medium text-(--chat-accent-text) outline-none transition-colors hover:bg-(--chat-surface-3)",
                                    ui.focus
                                )}
                            >
                                <PersonAvatar name={person.name} imageUrl={person.imageUrl} className="size-6 ring-0" />
                                <span dir="auto" className="truncate">
                                    {firstNameOf(person.name) || person.name}
                                </span>
                                <XIcon className="size-3.5 shrink-0 opacity-70" aria-hidden="true" />
                            </button>
                        </li>
                    ))}
                </ul>
            )}

            <div className="flex items-center justify-between gap-2 px-4 pb-1.5">
                <p aria-live="polite" className={cn("text-xs", full ? "font-medium text-(--chat-danger)" : "text-(--chat-ink-3)")}>
                    {full
                        ? `Group is full (${GROUP_MAX_ADDED_MEMBERS} people plus you)`
                        : count === 0
                          ? "Choose who to add"
                          : `${count} of ${GROUP_MAX_ADDED_MEMBERS} chosen`}
                </p>
            </div>

            {notice && (
                <div role="status" className="mx-3 mb-2 flex items-start gap-2 rounded-xl bg-(--chat-accent-soft) p-3 text-[13px] text-(--chat-accent-text)">
                    <InfoIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    <p>{notice}</p>
                </div>
            )}

            <div className="chat-scroll min-h-0 flex-1 overflow-y-auto border-t border-(--chat-line)" aria-busy={loading || refreshing}>
                {loading ? (
                    <ul role="status" aria-label="Loading people">
                        {Array.from({ length: 7 }, (_, index) => (
                            <PersonRowSkeleton key={index} />
                        ))}
                    </ul>
                ) : error && people.length === 0 ? (
                    <div role="alert" className="flex flex-col items-center px-6 py-14 text-center">
                        <p className="text-base font-semibold text-(--chat-ink)">Couldn&apos;t load people</p>
                        <p className="mt-1 max-w-64 text-sm text-(--chat-ink-2)">{error}</p>
                        <button type="button" onClick={retry} className={cn(ui.primaryButton, "mt-4")}>
                            <RefreshCwIcon className="size-4" aria-hidden="true" />
                            Try again
                        </button>
                    </div>
                ) : people.length === 0 ? (
                    <div role="status" className="flex flex-col items-center px-6 py-14 text-center">
                        <UserRoundXIcon className="mb-3 size-8 text-(--chat-ink-3)" strokeWidth={1.5} aria-hidden="true" />
                        <p className="text-base font-semibold text-(--chat-ink)">{searching ? "No people found" : "No one to add yet"}</p>
                        <p className="mt-1 max-w-64 text-sm text-(--chat-ink-2)">
                            {searching ? "Try a different name, email or phone number." : "The people you can add to a group will appear here."}
                        </p>
                    </div>
                ) : (
                    <>
                        <p className="sr-only" role="status">
                            {`${people.length}${hasMore ? "+" : ""} ${people.length === 1 ? "person" : "people"} listed`}
                        </p>
                        <ul className={cn("py-1 transition-opacity motion-reduce:transition-none", refreshing && "opacity-60")}>
                            {people.map((person) => {
                                const checked = selected.has(person.id);
                                return <PersonRow key={person.id} person={person} checked={checked} disabled={full && !checked} onToggle={onToggle} />;
                            })}
                        </ul>
                        {error && (
                            <p role="alert" className="px-4 py-2 text-center text-xs text-(--chat-danger)">
                                {error}{" "}
                                <button type="button" onClick={retry} className="font-medium underline underline-offset-2">
                                    Try again
                                </button>
                            </p>
                        )}
                        {hasMore && (
                            <p className="px-4 py-3 text-center text-xs text-(--chat-ink-3)">Search to find anyone who isn&apos;t listed.</p>
                        )}
                    </>
                )}
            </div>

            <div className="border-t border-(--chat-line) p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                <button type="button" onClick={onNext} disabled={count === 0} className={cn(ui.primaryButton, "h-11 w-full")}>
                    Next
                    <ArrowRightIcon className="size-4 rtl:rotate-180" aria-hidden="true" />
                    {count > 0 && (
                        <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs tabular-nums" aria-hidden="true">
                            {count}
                        </span>
                    )}
                </button>
            </div>
        </div>
    );
}
