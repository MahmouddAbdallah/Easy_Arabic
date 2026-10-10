"use client";

import { useId } from "react";
import { CheckIcon, InfoIcon, MoonIcon, SunIcon } from "lucide-react";
import { cn } from "cn";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { NotificationSettingsPanel } from "@/components/notification/NotificationSettingsPanel";
import { useOptionalNotificationControls } from "@/components/notification/NotificationProvider";
import { useTheme, type Theme } from "@/lib/theme";

const THEMES: { value: Theme; label: string; Icon: typeof SunIcon }[] = [
    { value: "light", label: "Light", Icon: SunIcon },
    { value: "dark", label: "Dark", Icon: MoonIcon },
];

/** A miniature chat in the theme's own colours (fixed values on purpose: it must not follow the current theme). */
function ThemePreview({ theme }: { theme: Theme }) {
    const dark = theme === "dark";
    return (
        <span
            aria-hidden="true"
            className={cn(
                "flex h-16 flex-col justify-center gap-1.5 rounded-lg border px-2.5",
                dark ? "border-neutral-700 bg-neutral-900" : "border-neutral-200 bg-white"
            )}
        >
            <span className={cn("h-2 w-3/5 rounded-full", dark ? "bg-neutral-700" : "bg-neutral-200")} />
            <span className={cn("ms-auto h-2 w-2/5 rounded-full", dark ? "bg-[#3dbdb3]" : "bg-[#066e6a]")} />
        </span>
    );
}

/**
 * Light or dark, applied at once and remembered on this device (the app's `useTheme`, the same switch the
 * site's navbar uses). Native radio inputs, so the arrow keys, focus and screen readers work without extra code.
 */
function ThemeChoice() {
    const { theme, setTheme } = useTheme();
    const id = useId();

    return (
        <section aria-labelledby={`${id}-title`} className="flex flex-col gap-3">
            <div>
                <h2 id={`${id}-title`} className="text-lg font-semibold">
                    Appearance
                </h2>
                <p className="text-sm text-muted-foreground">Choose how the app looks. Saved on this device.</p>
            </div>
            <div role="radiogroup" aria-labelledby={`${id}-title`} className="grid grid-cols-2 gap-2.5">
                {THEMES.map(({ value, label, Icon }) => {
                    const selected = theme === value;
                    return (
                        <label key={value} className="cursor-pointer">
                            <input
                                type="radio"
                                name={`${id}-theme`}
                                value={value}
                                checked={selected}
                                onChange={() => setTheme(value)}
                                className="peer sr-only"
                            />
                            <span
                                className={cn(
                                    "flex flex-col gap-2 rounded-xl border bg-card p-2.5 transition-colors motion-reduce:transition-none",
                                    "hover:bg-muted/40 peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50",
                                    selected ? "border-brand ring-1 ring-brand" : "border-border"
                                )}
                            >
                                <ThemePreview theme={value} />
                                <span className="flex items-center gap-1.5 px-0.5 text-sm font-medium">
                                    <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
                                    {label}
                                    {selected && <CheckIcon className="ms-auto size-4 text-brand" aria-hidden="true" />}
                                </span>
                            </span>
                        </label>
                    );
                })}
            </div>
        </section>
    );
}

interface PreferencesSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Where focus goes when the panel closes (the control that opened it). */
    finalFocus: () => HTMLElement | true;
}

/**
 * What a person can tune about the app from the chat: the theme, and the account's notification settings (the
 * app's own settings screen, reused as it is: pop-ups, sound, push on this device, what to be notified about, quiet
 * hours). Every switch applies immediately and is saved by the notification system, which also keeps a change that
 * is still waiting when this panel closes.
 */
export function PreferencesSheet({ open, onOpenChange, finalFocus }: PreferencesSheetProps) {
    const { push, settingsState, config } = useOptionalNotificationControls();

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side="left"
                finalFocus={finalFocus}
                className="gap-0 p-0 data-[side=left]:w-full data-[side=left]:sm:w-96"
            >
                <SheetHeader className="border-b border-border/40 px-4 py-3.5">
                    <SheetTitle>App preferences</SheetTitle>
                    <SheetDescription className="sr-only">Choose the theme and manage your notification settings.</SheetDescription>
                </SheetHeader>

                <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-4">
                    <ThemeChoice />

                    {settingsState ? (
                        <div aria-busy={settingsState.status === "loading"}>
                            <NotificationSettingsPanel settingsState={settingsState} push={push} config={config} />
                        </div>
                    ) : (
                        <div
                            role="status"
                            className="flex items-start gap-2.5 rounded-xl border border-border/60 bg-muted/40 p-3 text-sm text-muted-foreground"
                        >
                            <InfoIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                            Notification settings aren&apos;t available right now. Reload the page to try again.
                        </div>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
}
