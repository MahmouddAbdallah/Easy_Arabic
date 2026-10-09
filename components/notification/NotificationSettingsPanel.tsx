'use client';

import { useId, useState, type ReactNode } from 'react';
import { ArrowLeft, BellOff, BellRing, Info, LoaderCircle, Moon, Play, TriangleAlert, Volume2, type LucideIcon } from 'lucide-react';
import { cn } from 'cn';
import { Button } from '../ui/button';
import { Switch } from './Switch';
import { CATEGORY_ICONS } from './categoryIcons';
import type { PushRegistration } from './hooks/usePushRegistration';
import type { NotificationSettingsState } from './hooks/useNotificationSettingsState';
import { previewNotificationSound } from './lib/client/sound';
import { visibleCategories, type NotificationConfig } from './lib/config';

function browserTimeZone(): string | undefined {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
    } catch {
        return undefined;
    }
}

// ── Building blocks ──────────────────────────────────────────────────────────

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
    return (
        <section className="flex flex-col gap-1.5">
            <div className="px-1">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
                {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
            </div>
            <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">{children}</div>
        </section>
    );
}

interface RowProps {
    icon?: LucideIcon;
    title: string;
    description?: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
    children?: ReactNode;
}

function SettingRow({ icon: Icon, title, description, checked, onChange, disabled, children }: RowProps) {
    const id = useId();
    return (
        <div className={cn('flex items-start gap-3 p-3.5', disabled && 'opacity-60')}>
            {Icon && (
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand dark:bg-brand/15">
                    <Icon className="size-4" aria-hidden="true" />
                </span>
            )}
            <div className="min-w-0 flex-1">
                <p id={`${id}-title`} className="text-sm font-medium leading-6">
                    {title}
                </p>
                {description && (
                    <p id={`${id}-desc`} className="text-sm text-muted-foreground">
                        {description}
                    </p>
                )}
                {children}
            </div>
            <Switch
                checked={checked}
                onCheckedChange={onChange}
                disabled={disabled}
                aria-labelledby={`${id}-title`}
                aria-describedby={description ? `${id}-desc` : undefined}
            />
        </div>
    );
}

function Notice({ tone, icon: Icon, title, children }: { tone: 'info' | 'warning'; icon: LucideIcon; title: string; children: ReactNode }) {
    return (
        <div className="flex items-start gap-3 p-3.5">
            <span
                className={cn(
                    'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full',
                    tone === 'warning' ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' : 'bg-muted text-muted-foreground'
                )}
            >
                <Icon className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1 text-sm">
                <p className="font-medium leading-6">{title}</p>
                <div className="text-muted-foreground">{children}</div>
            </div>
        </div>
    );
}

// ── Push on this device ──────────────────────────────────────────────────────

/** Push is a property of THIS browser, so it follows the browser's permission rather than the account's settings. */
function PushSection({ push }: { push: PushRegistration }) {
    const [busy, setBusy] = useState(false);

    const run = async (task: () => Promise<unknown>) => {
        setBusy(true);
        try {
            await task();
        } finally {
            setBusy(false);
        }
    };

    if (push.isSupported === null) {
        return (
            <Section title="Push notifications" hint="On this device, even when the app is closed.">
                <div className="flex items-center gap-2 p-3.5 text-sm text-muted-foreground">
                    <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> Checking this browser…
                </div>
            </Section>
        );
    }

    let body: ReactNode;
    if (push.isSupported === false) {
        body = (
            <Notice tone="info" icon={Info} title="Not available in this browser">
                You&apos;ll still see everything in the app. On iPhone and iPad, add this app to your Home Screen to turn on push notifications.
            </Notice>
        );
    } else if (push.permission === 'denied') {
        body = (
            <Notice tone="warning" icon={TriangleAlert} title="Blocked in your browser">
                To turn push notifications on, allow them for this site: click the lock icon next to the address, open site settings and set
                Notifications to Allow. This page will notice the change by itself.
            </Notice>
        );
    } else if (push.permission === 'default') {
        body = (
            <div className="flex flex-col items-start gap-3 p-3.5">
                <p className="text-sm text-muted-foreground">
                    Get a heads-up about new messages and lessons even when Easy Arabic isn&apos;t open. Your browser will ask you to confirm.
                </p>
                <Button
                    type="button"
                    size="lg"
                    disabled={busy}
                    onClick={() => void run(push.enableNotifications)}
                    className="bg-brand text-brand-foreground hover:bg-brand-deep"
                >
                    {busy ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <BellRing aria-hidden="true" />}
                    Turn on push notifications
                </Button>
            </div>
        );
    } else {
        const on = !push.isOptedOut;
        body = (
            <SettingRow
                icon={BellRing}
                title="Push on this device"
                description={
                    !on
                        ? 'Off on this device. Your other devices are not affected.'
                        : push.isActive
                            ? 'On. You’ll be notified here even when the app is closed.'
                            : 'Setting up this device…'
                }
                checked={on}
                disabled={busy}
                onChange={(next) => void run(next ? push.enableNotifications : push.disableNotifications)}
            />
        );
    }

    return (
        <Section title="Push notifications" hint="On this device, even when the app is closed.">
            {body}
        </Section>
    );
}

// ── Quiet hours ──────────────────────────────────────────────────────────────

function TimeField({ label, value, onChange, disabled }: { label: string; value: string; onChange: (value: string) => void; disabled: boolean }) {
    const id = useId();
    return (
        <div className="flex flex-col gap-1">
            <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
                {label}
            </label>
            <input
                id={id}
                type="time"
                value={value}
                disabled={disabled}
                onChange={(event) => event.target.value && onChange(event.target.value)}
                className="h-9 w-28 rounded-lg border border-input bg-background px-2.5 text-sm [color-scheme:light] outline-none dark:[color-scheme:dark] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
            />
        </div>
    );
}

// ── The panel ────────────────────────────────────────────────────────────────

interface NotificationSettingsPanelProps {
    settingsState: NotificationSettingsState;
    push: PushRegistration | undefined;
    /**
     * The notification configuration the screen is drawn from: which sections exist, which controls are offered,
     * how the sound plays. (The dashboard passes its draft here to preview its own changes.)
     */
    config: NotificationConfig;
    /** Shows a back button when given. */
    onBack?: () => void;
}

/**
 * Everything a person can tune about notifications, grouped the way they think about it:
 * the master switch, what happens inside the app, push on this device, what they hear about, quiet hours.
 * Changes apply immediately and are saved in the background (useNotificationSettingsState).
 *
 * WHAT is on offer is not decided here: the sections of "What to be notified about", the pop-up and sound controls,
 * the push block and quiet hours all come from the admin's notification configuration (`config`), so adding,
 * renaming, hiding or removing any of them is done in the dashboard, not in this file.
 */
export function NotificationSettingsPanel({ settingsState, push, config, onBack }: NotificationSettingsPanelProps) {
    const { settings, status, update, saving } = settingsState;
    const quiet = settings.quietHours;
    const paused = !settings.enabled;
    const [soundError, setSoundError] = useState(false);

    const { controls } = config.settings;
    const showSound = controls.sound && config.sound.enabled;
    const sections = visibleCategories(config);

    const playSample = async () => setSoundError(!(await previewNotificationSound(config.sound)));
    const quietPatch = (patch: Partial<typeof quiet>) => update({ quietHours: { ...patch, timeZone: browserTimeZone() ?? quiet.timeZone } });

    return (
        <div className="flex flex-col gap-4">
            <header className="flex items-center gap-2">
                {onBack && (
                    <Button type="button" variant="ghost" size="icon" onClick={onBack} aria-label="Back to notifications">
                        <ArrowLeft className="rtl:rotate-180" />
                    </Button>
                )}
                <h2 className="flex-1 text-lg font-semibold">Notification settings</h2>
                <span role="status" aria-live="polite" className="text-xs text-muted-foreground">
                    {saving ? 'Saving…' : ''}
                </span>
            </header>

            {status === 'error' && (
                <p role="alert" className="rounded-lg border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
                    We couldn&apos;t load your saved settings, so the last known ones are shown. Changes may not be saved.
                </p>
            )}

            <Section title="Notifications">
                <SettingRow
                    icon={paused ? BellOff : BellRing}
                    title="Notifications"
                    description={
                        paused
                            ? 'Paused. No alerts, but new notifications still appear in your list.'
                            : 'Turn off to pause every alert. Your list keeps collecting.'
                    }
                    checked={settings.enabled}
                    onChange={(enabled) => update({ enabled })}
                />
            </Section>

            {(controls.popups || showSound) && (
                <Section title="In the app" hint="While you're using Easy Arabic.">
                    {controls.popups && (
                        <SettingRow
                            title="Pop-ups"
                            description="Show a pop-up when something new arrives."
                            checked={settings.popups}
                            disabled={paused}
                            onChange={(popups) => update({ popups })}
                        />
                    )}
                    {showSound && (
                        <SettingRow
                            icon={Volume2}
                            title="Sound"
                            description="A soft chime for new notifications. Also used for push notifications, where your browser allows it."
                            checked={settings.sound}
                            disabled={paused}
                            onChange={(sound) => update({ sound })}
                        >
                            <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => void playSample()}>
                                <Play aria-hidden="true" /> Play sample
                            </Button>
                            {soundError && (
                                <p role="alert" className="mt-1.5 text-xs text-muted-foreground">
                                    Your browser blocked the sound. Check that this tab isn&apos;t muted and try again.
                                </p>
                            )}
                        </SettingRow>
                    )}
                </Section>
            )}

            {push && controls.push && <PushSection push={push} />}

            {sections.length > 0 && (
                <Section title={config.copy.categoriesTitle} hint={config.copy.categoriesHint || undefined}>
                    {sections.map((section) => (
                        <SettingRow
                            key={section.id}
                            icon={CATEGORY_ICONS[section.icon]}
                            title={section.title}
                            description={[section.description, section.userCanMute ? '' : 'Always on.'].filter(Boolean).join(' ') || undefined}
                            checked={settings.categories[section.id] ?? section.defaultEnabled}
                            disabled={paused || !section.userCanMute}
                            onChange={(on) => update({ categories: { [section.id]: on } })}
                        />
                    ))}
                </Section>
            )}

            {controls.quietHours && (
                <Section title="Quiet hours" hint="No push and no sound during these hours. Pop-ups still appear while you're in the app.">
                    <SettingRow
                        icon={Moon}
                        title="Quiet hours"
                        description={quiet.enabled ? `Every day, in ${quiet.timeZone.replace(/_/g, ' ')} time.` : 'Silence push and sound at night.'}
                        checked={quiet.enabled}
                        disabled={paused}
                        onChange={(enabled) => quietPatch({ enabled })}
                    >
                        {quiet.enabled && (
                            <div className="mt-2.5 flex flex-wrap gap-3">
                                <TimeField label="From" value={quiet.start} disabled={paused} onChange={(start) => quietPatch({ start })} />
                                <TimeField label="Until" value={quiet.end} disabled={paused} onChange={(end) => quietPatch({ end })} />
                            </div>
                        )}
                    </SettingRow>
                </Section>
            )}

            <p className="px-1 text-xs text-muted-foreground">
                These settings follow your account on every device. Push notifications are set per device.
            </p>
        </div>
    );
}
