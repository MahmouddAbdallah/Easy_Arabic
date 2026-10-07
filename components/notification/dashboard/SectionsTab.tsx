'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { CATEGORY_ICONS } from '../categoryIcons';
import type { NotificationConfigEditor } from '../hooks/useNotificationConfigEditor';
import { CONFIG_LIMITS, type CategoryConfig } from '../lib/config';
import {
    addCategory,
    canAddCategory,
    categoryIdProblem,
    moveCategory,
    removeCategory,
    renameCategoryId,
    typesRoutedTo,
    updateCategory,
} from '../lib/configEdit';
import { Card, IconPicker, SelectField, TextField, ToggleField } from './fields';

/**
 * "What to be notified about": the sections users see on their settings screen. Nothing about them is in the code —
 * they are the list below, and everything done here (add, rename, reorder, switch off, remove) is what users get after Save.
 */
export function SectionsTab({ editor }: { editor: NotificationConfigEditor }) {
    const { draft, saved, edit, issueAt } = editor;
    const savedIds = new Set(saved.categories.map((category) => category.id));
    // Brand-new sections are opened for editing; saved ones stay compact until asked.
    const [justAdded, setJustAdded] = useState<string | undefined>();

    return (
        <div className="flex flex-col gap-4">
            <Card
                title="Sections"
                description="Each section is one switch on the user's settings screen. Notification types are routed to a section on the “Types & delivery” tab."
                actions={
                    <Button
                        type="button"
                        size="sm"
                        disabled={!canAddCategory(draft)}
                        onClick={() => {
                            const added = addCategory(draft);
                            edit(() => added.config);
                            setJustAdded(added.id);
                        }}
                    >
                        <Plus aria-hidden="true" /> Add section
                    </Button>
                }
            >
                <ul className="flex flex-col gap-3">
                    {draft.categories.map((category, index) => (
                        <li key={category.id}>
                            <SectionCard
                                editor={editor}
                                category={category}
                                index={index}
                                isNew={!savedIds.has(category.id)}
                                autoFocus={category.id === justAdded}
                            />
                        </li>
                    ))}
                </ul>
                {!canAddCategory(draft) && (
                    <p className="text-xs text-muted-foreground">You can have at most {CONFIG_LIMITS.categories.max} sections.</p>
                )}
                {issueAt('categories') && (
                    <p role="alert" className="text-xs text-destructive">
                        {issueAt('categories')}
                    </p>
                )}
            </Card>

            <Card
                title="Fallback section"
                description="Where a notification goes when the section its type was routed to no longer exists. Removing a section moves its types here."
            >
                <SelectField
                    label="Fallback section"
                    value={draft.fallbackCategory}
                    options={draft.categories.map((category) => ({ value: category.id, label: category.title }))}
                    error={issueAt('fallbackCategory')}
                    onChange={(fallbackCategory) => edit((current) => ({ ...current, fallbackCategory }))}
                />
            </Card>

            <Card title="Wording" description="The heading and hint above the sections on the user's settings screen.">
                <div className="grid gap-4 sm:grid-cols-2">
                    <TextField
                        label="Heading"
                        value={draft.copy.categoriesTitle}
                        maxLength={CONFIG_LIMITS.copy.title}
                        error={issueAt('copy.categoriesTitle')}
                        onChange={(categoriesTitle) => edit((current) => ({ ...current, copy: { ...current.copy, categoriesTitle } }))}
                    />
                    <TextField
                        label="Hint"
                        value={draft.copy.categoriesHint}
                        maxLength={CONFIG_LIMITS.copy.hint}
                        hint="Leave empty for no hint."
                        error={issueAt('copy.categoriesHint')}
                        onChange={(categoriesHint) => edit((current) => ({ ...current, copy: { ...current.copy, categoriesHint } }))}
                    />
                </div>
            </Card>
        </div>
    );
}

function SectionCard({
    editor,
    category,
    index,
    isNew,
    autoFocus,
}: {
    editor: NotificationConfigEditor;
    category: CategoryConfig;
    index: number;
    isNew: boolean;
    autoFocus: boolean;
}) {
    const { draft, edit, issueAt } = editor;
    const [confirmingRemove, setConfirmingRemove] = useState(false);
    const root = useRef<HTMLDivElement>(null);
    const Icon = CATEGORY_ICONS[category.icon];

    // A section that was just added scrolls into view, once, so the admin sees where it landed.
    useEffect(() => {
        if (autoFocus) root.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, [autoFocus]);
    const at = (field: string) => `categories.${index}.${field}`;

    const others = new Set(draft.categories.filter((other) => other.id !== category.id).map((other) => other.id));
    const routed = typesRoutedTo(draft, category.id);
    const isFallback = draft.fallbackCategory === category.id;
    const isLast = draft.categories.length === 1;
    const patch = (change: Partial<Omit<CategoryConfig, 'id'>>) => edit((current) => updateCategory(current, category.id, change));

    return (
        <div ref={root} className={cn('rounded-lg border border-border p-3', !category.enabled && 'bg-muted/40')}>
            <div className="flex items-center gap-2">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand dark:bg-brand/15">
                    <Icon className="size-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{category.title || category.id}</p>
                    <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                        <code>{category.id}</code>
                        {isNew && <Badge>New</Badge>}
                        {isFallback && <Badge>Fallback</Badge>}
                        {!category.enabled && <Badge tone="warn">Off for everyone</Badge>}
                    </p>
                </div>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Move ${category.title} up`}
                    disabled={index === 0}
                    onClick={() => edit((current) => moveCategory(current, category.id, -1))}
                >
                    <ArrowUp aria-hidden="true" />
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Move ${category.title} down`}
                    disabled={index === draft.categories.length - 1}
                    onClick={() => edit((current) => moveCategory(current, category.id, 1))}
                >
                    <ArrowDown aria-hidden="true" />
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove ${category.title}`}
                    disabled={isLast}
                    title={isLast ? 'The last section cannot be removed' : undefined}
                    onClick={() => setConfirmingRemove(true)}
                >
                    <Trash2 aria-hidden="true" />
                </Button>
            </div>

            {confirmingRemove && (
                <div role="alertdialog" aria-label={`Remove ${category.title}?`} className="mt-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
                    <p>
                        Remove <strong>{category.title}</strong>?{' '}
                        {routed.length > 0
                            ? `Its ${routed.length === 1 ? 'type' : 'types'} (${routed.join(', ')}) will go to the fallback section instead. `
                            : ''}
                        {!isNew && 'People’s choices for it are kept, in case you add it back with the same id.'}
                    </p>
                    <div className="mt-2 flex gap-2">
                        <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                                edit((current) => removeCategory(current, category.id));
                                setConfirmingRemove(false);
                            }}
                        >
                            Remove section
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => setConfirmingRemove(false)}>
                            Keep it
                        </Button>
                    </div>
                </div>
            )}

            <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <TextField
                    label="Title"
                    value={category.title}
                    maxLength={CONFIG_LIMITS.categories.title}
                    error={issueAt(at('title'))}
                    onChange={(title) => patch({ title })}
                />
                {isNew ? (
                    <IdField
                        id={category.id}
                        others={others}
                        error={issueAt(at('id'))}
                        onCommit={(id) => edit((current) => renameCategoryId(current, category.id, id))}
                    />
                ) : (
                    <div className="flex flex-col gap-1.5">
                        <span className="text-sm font-medium leading-none">Id</span>
                        <code className="flex h-8 items-center rounded-lg bg-muted px-2.5 text-sm">{category.id}</code>
                        <p className="text-xs text-muted-foreground">Permanent: people’s choices are stored under it.</p>
                    </div>
                )}
                <TextField
                    className="sm:col-span-2"
                    label="Description"
                    value={category.description}
                    maxLength={CONFIG_LIMITS.categories.description}
                    hint="Shown under the title. Optional."
                    error={issueAt(at('description'))}
                    onChange={(description) => patch({ description })}
                />
                <div className="sm:col-span-2">
                    <IconPicker label="Icon" value={category.icon} onChange={(icon) => patch({ icon })} />
                </div>
            </div>

            <div className="mt-4 flex flex-col gap-3 border-t border-border pt-3">
                <ToggleField
                    title="Section is on"
                    description="Off hides it from users and stops its notifications from alerting anyone (push, pop-up, sound). They still appear in the in-app list."
                    checked={category.enabled}
                    onChange={(enabled) => patch({ enabled })}
                />
                <ToggleField
                    title="On by default"
                    description="What people get who have never changed this switch."
                    checked={category.defaultEnabled}
                    disabled={!category.enabled || !category.userCanMute}
                    onChange={(defaultEnabled) => patch({ defaultEnabled })}
                />
                <ToggleField
                    title="Users can turn it off"
                    description="Off makes it always on: people see the section but cannot mute it (for security notices, say)."
                    checked={category.userCanMute}
                    disabled={!category.enabled}
                    onChange={(userCanMute) => patch({ userCanMute })}
                />
            </div>
        </div>
    );
}

function Badge({ children, tone }: { children: string; tone?: 'warn' }) {
    return (
        <span
            className={cn(
                'rounded-full px-1.5 py-px text-[0.6875rem] font-medium',
                tone === 'warn' ? 'bg-destructive/10 text-destructive' : 'bg-brand-soft text-brand dark:bg-brand/15'
            )}
        >
            {children}
        </span>
    );
}

/**
 * The id of a section that has not been saved yet, so it may still change. A section is keyed by its id, so the new
 * id is applied when typing stops (blur or Enter), not on every keystroke — otherwise each keystroke would replace the
 * input under the person's cursor. What is typed is checked as it is typed.
 */
function IdField({ id, others, error, onCommit }: { id: string; others: ReadonlySet<string>; error?: string; onCommit: (id: string) => void }) {
    const [text, setText] = useState(id);
    const commit = () => {
        if (text !== id) onCommit(text);
    };

    return (
        <TextField
            label="Id"
            value={text}
            monospace
            maxLength={32}
            hint="Permanent once saved: people’s choices are stored under it."
            error={categoryIdProblem(text, others) ?? error}
            onChange={setText}
            onBlur={commit}
            onEnter={commit}
        />
    );
}
