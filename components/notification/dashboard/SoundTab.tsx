'use client';

import { useState } from 'react';
import { Play, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { NotificationConfigEditor } from '../hooks/useNotificationConfigEditor';
import { previewNotificationSound } from '../lib/client/sound';
import { CONFIG_LIMITS, SOUND_TONES, type SoundConfig, type SoundTone } from '../lib/config';
import { addNote, canAddNote, removeNote, resetSound, updateNote } from '../lib/configEdit';
import { Card, NumberField, RangeField, SelectField, TextField, ToggleField } from './fields';

const TONE_LABELS: Record<SoundTone, string> = {
    sine: 'Sine — soft and round',
    triangle: 'Triangle — mellow',
    square: 'Square — hollow, retro',
    sawtooth: 'Sawtooth — bright and buzzy',
};

/** How notifications sound: the master switch, volume, the chime itself (or an audio file instead), and how often it may play. */
export function SoundTab({ editor }: { editor: NotificationConfigEditor }) {
    const { draft, edit, issueAt } = editor;
    const sound = draft.sound;
    const [blocked, setBlocked] = useState(false);
    const setSound = (patch: Partial<SoundConfig>) => edit((current) => ({ ...current, sound: { ...current.sound, ...patch } }));
    const usingFile = sound.customUrl !== null;
    const ignoredHint = usingFile ? 'Not used while an audio file is set.' : undefined;

    return (
        <div className="flex flex-col gap-4">
            <Card
                title="Sound"
                description="One setting for the whole app. People can still turn their own sound off, unless you hide that control on the “User settings” tab."
                actions={
                    <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={async () => setBlocked(!(await previewNotificationSound(sound)))}>
                            <Play aria-hidden="true" /> Play sample
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => edit(resetSound)}>
                            <RotateCcw aria-hidden="true" /> Reset sound
                        </Button>
                    </div>
                }
            >
                {blocked && (
                    <p role="alert" className="text-xs text-muted-foreground">
                        The browser blocked the sample. Check that this tab isn&apos;t muted, and that the audio file (if any) can be loaded.
                    </p>
                )}
                <ToggleField
                    title="Notification sound is on"
                    description="Off silences everything: no in-app chime, every push is silent, and the “Sound” switch disappears from users’ settings."
                    checked={sound.enabled}
                    onChange={(enabled) => setSound({ enabled })}
                />
                <RangeField
                    label="Volume"
                    value={sound.volume}
                    error={issueAt('sound.volume')}
                    hint="40% is the original chime volume. Applies to the chime and to an audio file."
                    onChange={(volume) => setSound({ volume })}
                />
                <TextField
                    label="Audio file (optional)"
                    value={sound.customUrl ?? ''}
                    maxLength={CONFIG_LIMITS.assetUrl}
                    placeholder="/sounds/notification.mp3"
                    monospace
                    hint="An internal path or an https URL. When set, it plays instead of the chime below."
                    error={issueAt('sound.customUrl')}
                    onChange={(value) => setSound({ customUrl: value === '' ? null : value })}
                />
            </Card>

            <Card title="The chime" description="A short run of notes, played by the browser itself — no file needed.">
                <SelectField
                    label="Tone"
                    value={sound.tone}
                    options={SOUND_TONES.map((tone) => ({ value: tone, label: TONE_LABELS[tone] }))}
                    hint={ignoredHint}
                    error={issueAt('sound.tone')}
                    onChange={(tone) => setSound({ tone })}
                />

                <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-2">
                        <h4 className="text-sm font-medium">Notes</h4>
                        <Button type="button" variant="outline" size="sm" disabled={!canAddNote(draft)} onClick={() => edit(addNote)}>
                            <Plus aria-hidden="true" /> Add note
                        </Button>
                    </div>
                    {issueAt('sound.notes') && (
                        <p role="alert" className="text-xs text-destructive">
                            {issueAt('sound.notes')}
                        </p>
                    )}
                    <ol className="flex flex-col gap-2">
                        {sound.notes.map((note, index) => (
                            <li key={index} className="flex items-start gap-2 rounded-lg border border-border p-2.5">
                                <span className="mt-6 w-5 shrink-0 text-center text-xs text-muted-foreground tabular-nums">{index + 1}</span>
                                <div className="grid flex-1 gap-3 sm:grid-cols-2">
                                    <NumberField
                                        label="Pitch"
                                        value={note.frequency}
                                        min={CONFIG_LIMITS.sound.minHz}
                                        max={CONFIG_LIMITS.sound.maxHz}
                                        step={0.01}
                                        suffix="Hz"
                                        error={issueAt(`sound.notes.${index}.frequency`)}
                                        onChange={(frequency) => edit((current) => updateNote(current, index, { frequency }))}
                                    />
                                    <NumberField
                                        label="Starts after"
                                        value={note.delayMs}
                                        min={0}
                                        max={CONFIG_LIMITS.sound.maxDelayMs}
                                        step={10}
                                        suffix="ms"
                                        error={issueAt(`sound.notes.${index}.delayMs`)}
                                        onChange={(delayMs) => edit((current) => updateNote(current, index, { delayMs }))}
                                    />
                                </div>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon-sm"
                                    className="mt-5"
                                    aria-label={`Remove note ${index + 1}`}
                                    disabled={sound.notes.length <= 1}
                                    onClick={() => edit((current) => removeNote(current, index))}
                                >
                                    <Trash2 aria-hidden="true" />
                                </Button>
                            </li>
                        ))}
                    </ol>
                    {usingFile && <p className="text-xs text-muted-foreground">{ignoredHint}</p>}
                </div>

                <NumberField
                    label="Each note rings for"
                    value={sound.noteDurationMs}
                    min={CONFIG_LIMITS.sound.minNoteMs}
                    max={CONFIG_LIMITS.sound.maxNoteMs}
                    step={10}
                    suffix="ms"
                    hint={ignoredHint}
                    error={issueAt('sound.noteDurationMs')}
                    onChange={(noteDurationMs) => setSound({ noteDurationMs })}
                />
            </Card>

            <Card title="Politeness" description="Keeps a busy inbox from turning into noise.">
                <NumberField
                    label="Minimum gap between sounds"
                    value={sound.minGapMs}
                    min={0}
                    max={CONFIG_LIMITS.sound.maxGapMs}
                    step={100}
                    suffix="ms"
                    hint="However many notifications arrive, at most one sound plays in this time."
                    error={issueAt('sound.minGapMs')}
                    onChange={(minGapMs) => setSound({ minGapMs })}
                />
                <ToggleField
                    title="One tab plays per notification"
                    description="With several tabs open, only one makes the sound (where the browser supports it); off lets every tab play."
                    checked={sound.onePerAlertAcrossTabs}
                    onChange={(onePerAlertAcrossTabs) => setSound({ onePerAlertAcrossTabs })}
                />
            </Card>
        </div>
    );
}
