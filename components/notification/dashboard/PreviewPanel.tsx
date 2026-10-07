'use client';

import { useMemo, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NotificationSettingsPanel } from '../NotificationSettingsPanel';
import type { NotificationSettingsState } from '../hooks/useNotificationSettingsState';
import type { NotificationConfig } from '../lib/config';
import { mergePatches, normalizeSettings, type NotificationSettingsPatch } from '../lib/settings';

/**
 * What the user's settings screen looks like under the draft configuration — the real NotificationSettingsPanel, fed the
 * draft and a throwaway in-memory state, so it cannot drift from what people will actually see. It behaves like a new user
 * (nothing chosen yet, so the defaults show); toggling is interactive but nothing here is saved anywhere.
 */
export function PreviewPanel({ config }: { config: NotificationConfig }) {
    const [choices, setChoices] = useState<NotificationSettingsPatch>({});

    const state: NotificationSettingsState = useMemo(
        () => ({
            settings: normalizeSettings(choices, config),
            status: 'ready',
            saving: false,
            update: (patch) => setChoices((current) => mergePatches(current, patch)),
        }),
        [choices, config]
    );

    return (
        <section aria-label="Preview of the settings screen" className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
            <header className="flex items-start justify-between gap-2">
                <div>
                    <h3 className="text-sm font-semibold">Preview</h3>
                    <p className="text-xs text-muted-foreground">The settings screen as a new user sees it. Nothing here is saved.</p>
                </div>
                <Button type="button" variant="ghost" size="icon-sm" aria-label="Reset the preview" onClick={() => setChoices({})}>
                    <RotateCcw aria-hidden="true" />
                </Button>
            </header>
            <div className="rounded-lg border border-dashed border-border p-3">
                <NotificationSettingsPanel settingsState={state} push={undefined} config={config} />
            </div>
        </section>
    );
}
