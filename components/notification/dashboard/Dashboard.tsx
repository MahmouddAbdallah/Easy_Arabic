'use client';

import type { FormEvent } from 'react';
import { LoaderCircle, RotateCcw, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from 'cn';
import { useNotificationConfigEditor, type NotificationConfigEditor } from '../hooks/useNotificationConfigEditor';
import { DeliveryTab } from './DeliveryTab';
import { PreviewPanel } from './PreviewPanel';
import { SectionsTab } from './SectionsTab';
import { SoundTab } from './SoundTab';
import { UserSettingsTab } from './UserSettingsTab';

/**
 * Which tab each part of the configuration is edited on, so a tab can show that something inside it needs attention.
 * (A path is "sound.notes.1.frequency"; a tab owns every path that starts with one of its prefixes.)
 */
const TABS = [
    { value: 'sections', label: 'Sections', prefixes: ['categories', 'fallbackCategory', 'copy'] },
    { value: 'delivery', label: 'Types & delivery', prefixes: ['types', 'delivery'] },
    { value: 'sound', label: 'Sound', prefixes: ['sound'] },
    { value: 'users', label: 'User settings', prefixes: ['settings'] },
] as const;

const owns = (prefixes: readonly string[], path: string) => prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}.`));

/**
 * The notification system's configuration, as a form — a standalone component: render it on any page, it needs no props
 * and nothing else in the app refers to it.
 *
 * What it edits is the notification CONFIGURATION (lib/config.ts), stored once for the whole app: which sections users can be
 * notified about (add, rename, reorder, switch off, remove), how notifications sound, which settings users get and what they
 * default to, and how each notification type is routed and delivered. It is NOT where a person's own preferences are
 * edited — those stay on the user's settings screen and are never touched from here.
 *
 * Only admins can open it (the server refuses anyone else; this shows a notice). Nothing is stored until "Save changes".
 */
export function NotificationDashboard({ className }: { className?: string }) {
    const editor = useNotificationConfigEditor();

    if (editor.status === 'loading') {
        return (
            <div role="status" className={cn('flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground', className)}>
                <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                Loading the notification configuration…
            </div>
        );
    }

    if (editor.status === 'forbidden') {
        return (
            <div role="alert" className={cn('mx-auto flex max-w-xl flex-col gap-1 p-10 text-center', className)}>
                <h2 className="text-lg font-semibold">Admins only</h2>
                <p className="text-sm text-muted-foreground">You don’t have permission to manage the notification configuration.</p>
            </div>
        );
    }

    if (editor.status === 'error') {
        return (
            <div role="alert" className={cn('mx-auto flex max-w-xl flex-col items-center gap-3 p-10 text-center', className)}>
                <div>
                    <h2 className="text-lg font-semibold">Couldn’t load the configuration</h2>
                    <p className="text-sm text-muted-foreground">{editor.error ?? 'Something went wrong.'}</p>
                </div>
                <Button type="button" variant="outline" onClick={() => void editor.reload()}>
                    Try again
                </Button>
            </div>
        );
    }

    return <NotificationDashboardForm editor={editor} className={className} />;
}

function NotificationDashboardForm({ editor, className }: { editor: NotificationConfigEditor; className?: string }) {
    const { draft, saved, customised, dirty, issues, saving, conflict } = editor;

    const submit = (event: FormEvent) => {
        event.preventDefault(); // Enter inside a field submits the form: that is a save, but only when there is something to save
        if (dirty && !conflict) void editor.save();
    };

    return (
        <form onSubmit={submit} noValidate className={cn('mx-auto flex w-full max-w-6xl flex-col gap-4 p-4', className)}>
            <header className="flex flex-col gap-1">
                <h1 className="text-xl font-semibold">Notification configuration</h1>
                <p className="text-sm text-muted-foreground">
                    What the notification system offers and how it behaves, for everyone. People’s own preferences are separate and are never changed
                    from here.
                </p>
                <p className="text-xs text-muted-foreground">
                    {customised
                        ? `Last saved ${saved.updatedAt ? new Date(saved.updatedAt).toLocaleString() : 'just now'} · revision ${saved.revision}.`
                        : 'Nothing has been saved yet: the built-in defaults are in force, which is how notifications behaved before this existed.'}
                </p>
            </header>

            {conflict && (
                <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
                    <TriangleAlert className="size-4 shrink-0 text-destructive" aria-hidden="true" />
                    <p className="min-w-0 flex-1">
                        Someone else saved a new configuration while you were editing, so yours was not saved. Reload to see theirs (your unsaved
                        changes will be discarded).
                    </p>
                    <Button type="button" size="sm" variant="outline" onClick={() => void editor.reload()}>
                        Reload
                    </Button>
                </div>
            )}

            {issues.length > 0 && (
                <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
                    <p className="font-medium">
                        {issues.length === 1 ? '1 problem to fix' : `${issues.length} problems to fix`} before saving:
                    </p>
                    <ul className="mt-1 list-disc ps-5 text-muted-foreground">
                        {issues.slice(0, 5).map((issue) => (
                            <li key={`${issue.path}:${issue.message}`}>
                                <code className="text-xs">{issue.path || 'configuration'}</code> {issue.message}
                            </li>
                        ))}
                        {issues.length > 5 && <li>…and {issues.length - 5} more.</li>}
                    </ul>
                </div>
            )}

            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
                <Tabs defaultValue="sections">
                    <TabsList className="h-auto w-full flex-wrap sm:w-fit">
                        {TABS.map((tab) => {
                            const broken = issues.some((issue) => owns(tab.prefixes, issue.path));
                            return (
                                <TabsTrigger key={tab.value} value={tab.value}>
                                    {tab.label}
                                    {broken && (
                                        <span aria-label="has problems" className="size-1.5 rounded-full bg-destructive" />
                                    )}
                                </TabsTrigger>
                            );
                        })}
                    </TabsList>
                    <TabsContent value="sections" className="mt-2">
                        <SectionsTab editor={editor} />
                    </TabsContent>
                    <TabsContent value="delivery" className="mt-2">
                        <DeliveryTab editor={editor} />
                    </TabsContent>
                    <TabsContent value="sound" className="mt-2">
                        <SoundTab editor={editor} />
                    </TabsContent>
                    <TabsContent value="users" className="mt-2">
                        <UserSettingsTab editor={editor} />
                    </TabsContent>
                </Tabs>

                <aside className="lg:sticky lg:top-4">
                    <PreviewPanel config={draft} />
                </aside>
            </div>

            <div
                className={cn(
                    'sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center gap-2 border-t border-border bg-background/95 px-4 py-3 backdrop-blur',
                    'supports-[backdrop-filter]:bg-background/80'
                )}
            >
                <p role="status" className="min-w-0 flex-1 text-sm text-muted-foreground">
                    {saving ? 'Saving…' : dirty ? 'You have unsaved changes.' : 'All changes saved.'}
                </p>
                <Button type="button" variant="ghost" onClick={editor.restoreDefaults} disabled={saving}>
                    <RotateCcw aria-hidden="true" /> Restore defaults
                </Button>
                <Button type="button" variant="outline" onClick={editor.discard} disabled={!dirty || saving}>
                    Discard changes
                </Button>
                <Button type="submit" disabled={!dirty || issues.length > 0 || saving || conflict}>
                    {saving && <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
                    Save changes
                </Button>
            </div>
        </form>
    );
}

export default NotificationDashboard;
