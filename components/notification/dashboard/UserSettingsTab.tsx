'use client';

import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import type { NotificationConfigEditor } from '../hooks/useNotificationConfigEditor';
import type { SettingsControls, SettingsDefaults } from '../lib/config';
import { Card, TextField, ToggleField } from './fields';

const TIME_ZONES_ID = 'notification-config-time-zones';

/** The time zones this browser knows, for suggestions. Any valid IANA name can still be typed. */
function useTimeZones(): string[] {
    return useMemo(() => {
        try {
            return Intl.supportedValuesOf('timeZone');
        } catch {
            return [];
        }
    }, []);
}

/**
 * Which settings people get on their own screen, and what they start with. A control hidden here is locked to its
 * default for everybody — useful for a policy such as "everyone has quiet hours at night" — and what people chose
 * before is kept, so showing the control again brings it back.
 */
export function UserSettingsTab({ editor }: { editor: NotificationConfigEditor }) {
    const { draft, edit, issueAt } = editor;
    const { controls, defaults } = draft.settings;
    const timeZones = useTimeZones();

    const setControl = (patch: Partial<SettingsControls>) =>
        edit((current) => ({ ...current, settings: { ...current.settings, controls: { ...current.settings.controls, ...patch } } }));
    const setDefault = (patch: Partial<SettingsDefaults>) =>
        edit((current) => ({ ...current, settings: { ...current.settings, defaults: { ...current.settings.defaults, ...patch } } }));
    const setQuiet = (patch: Partial<SettingsDefaults['quietHours']>) => setDefault({ quietHours: { ...defaults.quietHours, ...patch } });

    const locked = (shown: boolean) => (shown ? undefined : ' Locked: people cannot change this, so this is what everyone gets.');
    const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    return (
        <div className="flex flex-col gap-4">
            <Card
                title="Controls people see"
                description="Switch a control off to take it away from the settings screen. Its default below then applies to everyone."
            >
                <ToggleField
                    title="Pop-ups"
                    description="“Show a pop-up when something new arrives.”"
                    checked={controls.popups}
                    onChange={(popups) => setControl({ popups })}
                />
                <ToggleField
                    title="Sound"
                    description={
                        draft.sound.enabled
                            ? '“A soft chime for new notifications.”'
                            : 'Already hidden: notification sound is switched off on the Sound tab.'
                    }
                    checked={controls.sound}
                    onChange={(sound) => setControl({ sound })}
                />
                <ToggleField
                    title="Push on this device"
                    description="The block where people allow push notifications in their browser. Hiding it does not stop pushes that are already registered."
                    checked={controls.push}
                    onChange={(push) => setControl({ push })}
                />
                <ToggleField
                    title="Quiet hours"
                    description="People choose a daily window with no push and no sound."
                    checked={controls.quietHours}
                    onChange={(quietHours) => setControl({ quietHours })}
                />
            </Card>

            <Card title="Defaults" description="What people get who have never changed a setting. Anyone who has chosen keeps their choice.">
                <ToggleField
                    title="Notifications on"
                    description="The master switch. Off starts people paused: they get no alerts until they turn it on."
                    checked={defaults.enabled}
                    onChange={(enabled) => setDefault({ enabled })}
                />
                <ToggleField
                    title="Pop-ups"
                    description={`Show an in-app pop-up for new notifications.${locked(controls.popups) ?? ''}`}
                    checked={defaults.popups}
                    onChange={(popups) => setDefault({ popups })}
                />
                <ToggleField
                    title="Sound"
                    description={
                        draft.sound.enabled
                            ? `Play the notification sound.${locked(controls.sound) ?? ''}`
                            : 'Has no effect while notification sound is switched off.'
                    }
                    checked={defaults.sound}
                    onChange={(sound) => setDefault({ sound })}
                />
                <ToggleField
                    title="Quiet hours"
                    description={`No push and no sound inside the window below.${locked(controls.quietHours) ?? ''}`}
                    checked={defaults.quietHours.enabled}
                    onChange={(enabled) => setQuiet({ enabled })}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                    <TextField
                        label="Quiet hours from"
                        type="time"
                        value={defaults.quietHours.start}
                        error={issueAt('settings.defaults.quietHours.start')}
                        onChange={(start) => setQuiet({ start })}
                    />
                    <TextField
                        label="Quiet hours until"
                        type="time"
                        value={defaults.quietHours.end}
                        hint="A window that ends before it starts runs overnight."
                        error={issueAt('settings.defaults.quietHours.end')}
                        onChange={(end) => setQuiet({ end })}
                    />
                    <div className="flex flex-col gap-2 sm:col-span-2">
                        <TextField
                            label="Time zone"
                            value={defaults.quietHours.timeZone}
                            list={TIME_ZONES_ID}
                            monospace
                            hint="An IANA name such as Africa/Cairo. People who turn quiet hours on themselves get their own browser’s time zone."
                            error={issueAt('settings.defaults.quietHours.timeZone')}
                            onChange={(timeZone) => setQuiet({ timeZone })}
                        />
                        <datalist id={TIME_ZONES_ID}>
                            {timeZones.map((zone) => (
                                <option key={zone} value={zone} />
                            ))}
                        </datalist>
                        {browserZone && browserZone !== defaults.quietHours.timeZone && (
                            <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => setQuiet({ timeZone: browserZone })}>
                                Use this browser’s ({browserZone})
                            </Button>
                        )}
                    </div>
                </div>
            </Card>
        </div>
    );
}
