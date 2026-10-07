'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { fetchNotificationConfigForEditing, saveNotificationConfigRequest } from '../lib/client/api';
import { configStore } from '../lib/client/configStore';
import { DEFAULT_NOTIFICATION_CONFIG, type NotificationConfig } from '../lib/config';
import { builtInDraft, sameConfig } from '../lib/configEdit';
import { parseConfig, type ConfigIssue } from '../lib/configParse';

export interface NotificationConfigEditor {
    /**
     * `loading` until the first answer; `forbidden` if the signed-in user is not an admin; `error` if it could not be
     * loaded (see `error`); `ready` otherwise.
     */
    status: 'loading' | 'ready' | 'forbidden' | 'error';
    error: string | undefined;
    /** What the form shows and the admin edits. */
    draft: NotificationConfig;
    /** What is stored (the built-in defaults while nothing was ever saved). */
    saved: NotificationConfig;
    /** Has an admin ever saved a configuration? false = the built-in defaults are in force. */
    customised: boolean;
    /** Does the draft differ from what is stored? */
    dirty: boolean;
    /** Everything wrong with the draft right now — the very rules the server applies on save. */
    issues: ConfigIssue[];
    /** The first problem at exactly `path` ("categories.1.title"), for showing next to its field. */
    issueAt: (path: string) => string | undefined;
    saving: boolean;
    /** Somebody else saved while this one was being edited: saving is refused until the admin reloads. */
    conflict: boolean;
    /** Changes the draft: `change` receives the current one and returns the new one (see lib/configEdit.ts). */
    edit: (change: (draft: NotificationConfig) => NotificationConfig) => void;
    save: () => Promise<boolean>;
    /** Throws away the unsaved changes. */
    discard: () => void;
    /** Puts the built-in defaults in the draft. Nothing is stored until the admin saves. */
    restoreDefaults: () => void;
    /** Loads what is stored again (dropping the draft). The way out of a conflict. */
    reload: () => Promise<void>;
}

function describe(error: unknown): { status?: number; message: string } {
    if (axios.isAxiosError(error)) {
        const message = (error.response?.data as { error?: { message?: string } } | undefined)?.error?.message;
        return { status: error.response?.status, message: message ?? error.message };
    }
    return { message: error instanceof Error ? error.message : 'Something went wrong.' };
}

/**
 * The state of the notification dashboard's form: loads the stored configuration, holds the admin's draft, validates it
 * with the same rules as the server (parseConfig), and saves it — refusing to overwrite a configuration the admin has
 * not seen (the save names the revision it was based on; a mismatch is a conflict, not a silent overwrite).
 */
export function useNotificationConfigEditor(): NotificationConfigEditor {
    const [status, setStatus] = useState<NotificationConfigEditor['status']>('loading');
    const [error, setError] = useState<string | undefined>();
    const [saved, setSaved] = useState<NotificationConfig>(DEFAULT_NOTIFICATION_CONFIG);
    const [draft, setDraft] = useState<NotificationConfig>(DEFAULT_NOTIFICATION_CONFIG);
    const [customised, setCustomised] = useState(false);
    const [saving, setSaving] = useState(false);
    const [conflict, setConflict] = useState(false);

    // Callbacks read the latest values through refs, so they stay stable and never act on a stale closure.
    const draftRef = useRef(draft);
    const savedRef = useRef(saved);
    const savingRef = useRef(false);
    useEffect(() => {
        draftRef.current = draft;
        savedRef.current = saved;
    }, [draft, saved]);

    const load = useCallback(async () => {
        setStatus('loading');
        setError(undefined);
        try {
            const { config, exists } = await fetchNotificationConfigForEditing();
            setSaved(config);
            setDraft(config);
            setCustomised(exists);
            setConflict(false);
            setStatus('ready');
        } catch (e) {
            const { status: code, message } = describe(e);
            if (code === 403) {
                setStatus('forbidden');
            } else {
                console.error('[notification] Could not load the notification configuration for editing:', e);
                setError(message);
                setStatus('error');
            }
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    const issues = useMemo(() => parseConfig(draft).issues, [draft]);
    const issueAt = useCallback((path: string) => issues.find((issue) => issue.path === path)?.message, [issues]);
    const dirty = useMemo(() => !sameConfig(draft, saved), [draft, saved]);

    const edit = useCallback((change: (draft: NotificationConfig) => NotificationConfig) => setDraft((current) => change(current)), []);

    const save = useCallback(async (): Promise<boolean> => {
        if (savingRef.current) return false;
        const submitted = draftRef.current;
        if (parseConfig(submitted).issues.length > 0) return false;

        savingRef.current = true;
        setSaving(true);
        try {
            const stored = await saveNotificationConfigRequest(submitted, savedRef.current.revision);
            setSaved(stored);
            // Edits made while the request was out are kept; only the server's revision and time are taken over.
            setDraft((current) => (current === submitted ? stored : { ...current, revision: stored.revision, updatedAt: stored.updatedAt }));
            setCustomised(true);
            setConflict(false);
            configStore.apply(stored); // this admin's own app uses it at once
            toast.success('Notification configuration saved.');
            return true;
        } catch (e) {
            const { status: code, message } = describe(e);
            if (code === 409) {
                setConflict(true);
                toast.error('Someone else changed the configuration. Reload it to continue.');
            } else if (code === 403) {
                setStatus('forbidden');
            } else {
                console.error('[notification] Could not save the notification configuration:', e);
                toast.error(code === 400 ? message : 'Could not save the configuration. Please try again.');
            }
            return false;
        } finally {
            savingRef.current = false;
            setSaving(false);
        }
    }, []);

    const discard = useCallback(() => setDraft(savedRef.current), []);
    const restoreDefaults = useCallback(() => setDraft((current) => builtInDraft(current)), []);

    // Unsaved work must not vanish with a closed tab.
    useEffect(() => {
        if (!dirty) return;
        const warn = (event: BeforeUnloadEvent) => event.preventDefault();
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [dirty]);

    return useMemo(
        () => ({ status, error, draft, saved, customised, dirty, issues, issueAt, saving, conflict, edit, save, discard, restoreDefaults, reload: load }),
        [status, error, draft, saved, customised, dirty, issues, issueAt, saving, conflict, edit, save, discard, restoreDefaults, load]
    );
}
