'use client';

import type { NotificationConfigEditor } from '../hooks/useNotificationConfigEditor';
import { CONFIG_LIMITS, PUSH_URGENCIES } from '../lib/config';
import { updateTypeDelivery } from '../lib/configEdit';
import { NOTIFICATION_TYPES } from '../lib/contract';
import { Card, NumberField, SelectField, TextField } from './fields';

const URGENCY_LABELS = { 'very-low': 'Very low', low: 'Low', normal: 'Normal', high: 'High' } as const;

const typeLabel = (type: string) => type.replace(/_/g, ' ');

/** "86400" → "1 day"; for the hint under a time-to-live field. */
function formatDuration(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds < 0) return '';
    if (seconds === 0) return 'only delivered if the device is reachable right now';
    const units: [number, string][] = [
        [86_400, 'day'],
        [3_600, 'hour'],
        [60, 'minute'],
        [1, 'second'],
    ];
    const [size, name] = units.find(([unit]) => seconds >= unit) ?? units[3];
    const amount = Math.round((seconds / size) * 10) / 10;
    return `${amount} ${name}${amount === 1 ? '' : 's'}`;
}

/** How notifications are routed and delivered: which section each type belongs to, how urgent it is, how long it waits, how pop-ups and system notifications look. */
export function DeliveryTab({ editor }: { editor: NotificationConfigEditor }) {
    const { draft, edit, issueAt } = editor;
    const sections = draft.categories.map((category) => ({ value: category.id, label: category.enabled ? category.title : `${category.title} (off)` }));

    return (
        <div className="flex flex-col gap-4">
            <Card
                title="Notification types"
                description="Types are defined in code (lib/contract.ts); here you choose which section each one belongs to — the switch a user would use to mute it — and how it is delivered."
            >
                <ul className="flex flex-col gap-3">
                    {NOTIFICATION_TYPES.map((type) => {
                        const delivery = draft.types[type];
                        return (
                            <li key={type} className="rounded-lg border border-border p-3">
                                <p className="mb-3 text-sm font-medium capitalize">
                                    {typeLabel(type)} <code className="ms-1 text-xs font-normal normal-case text-muted-foreground">{type}</code>
                                </p>
                                <div className="grid gap-4 sm:grid-cols-3">
                                    <SelectField
                                        label="Section"
                                        value={delivery.category}
                                        options={sections}
                                        error={issueAt(`types.${type}.category`)}
                                        onChange={(category) => edit((current) => updateTypeDelivery(current, type, { category }))}
                                    />
                                    <SelectField
                                        label="Urgency"
                                        value={delivery.urgency}
                                        options={PUSH_URGENCIES.map((urgency) => ({ value: urgency, label: URGENCY_LABELS[urgency] }))}
                                        error={issueAt(`types.${type}.urgency`)}
                                        hint="High wakes a sleeping phone; low waits to save battery."
                                        onChange={(urgency) => edit((current) => updateTypeDelivery(current, type, { urgency }))}
                                    />
                                    <NumberField
                                        label="Keep for"
                                        value={delivery.ttlSeconds}
                                        min={0}
                                        max={CONFIG_LIMITS.ttlSeconds.max}
                                        suffix="seconds"
                                        error={issueAt(`types.${type}.ttlSeconds`)}
                                        hint={`How long an offline device can still receive it: ${formatDuration(delivery.ttlSeconds)}.`}
                                        onChange={(ttlSeconds) => edit((current) => updateTypeDelivery(current, type, { ttlSeconds }))}
                                    />
                                </div>
                            </li>
                        );
                    })}
                </ul>
            </Card>

            <Card title="Pop-ups and system notifications">
                <div className="grid gap-4 sm:grid-cols-2">
                    <NumberField
                        label="Pop-up stays for"
                        value={draft.delivery.popupDurationMs}
                        min={CONFIG_LIMITS.popup.minMs}
                        max={CONFIG_LIMITS.popup.maxMs}
                        step={500}
                        suffix="ms"
                        hint="How long the in-app pop-up is shown."
                        error={issueAt('delivery.popupDurationMs')}
                        onChange={(popupDurationMs) => edit((current) => ({ ...current, delivery: { ...current.delivery, popupDurationMs } }))}
                    />
                    <TextField
                        label="Default icon"
                        value={draft.delivery.defaultIcon ?? ''}
                        maxLength={CONFIG_LIMITS.assetUrl}
                        placeholder="/icons/notification-icon.png"
                        monospace
                        hint="Used for system notifications whose sender gave no icon: an internal path or an https URL. Empty uses the app’s own."
                        error={issueAt('delivery.defaultIcon')}
                        onChange={(value) => edit((current) => ({ ...current, delivery: { ...current.delivery, defaultIcon: value === '' ? null : value } }))}
                    />
                </div>
            </Card>
        </div>
    );
}
