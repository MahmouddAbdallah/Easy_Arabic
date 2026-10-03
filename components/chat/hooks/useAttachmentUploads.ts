"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { MAX_ATTACHMENTS_PER_MESSAGE, sanitizeFileName, validateAttachmentFile } from "../lib/attachments";
import { COMPOSER_TOAST_POSITION } from "../lib/constants";
import {
    discardUploadedAsset,
    isAbortError,
    requestUploadTickets,
    toAttachmentPayload,
    toUploadError,
    uploadToCloudinary,
} from "../lib/attachmentUpload";
import type { SendAttachmentInput } from "../lib/schemas";
import type { AttachmentType, UploadedAsset, UploadTicket } from "../types";

/** Uploads running at once; the rest wait their turn (keeps a phone's connection usable). */
const MAX_PARALLEL_UPLOADS = 3;

export type UploadStatus = "queued" | "uploading" | "done" | "error";

/** One attachment on its way to being sent. */
export interface PendingAttachment {
    id: string;
    file: File;
    type: AttachmentType;
    /** Display-safe name. */
    fileName: string;
    /** Local preview (object URL). Only used to draw the thumbnail: it is never sent or stored. */
    previewUrl: string | null;
    status: UploadStatus;
    /** 0-100. */
    progress: number;
    error: string | null;
    /** Whether "retry" can help (false for a file the server refused). */
    retryable: boolean;
    /** Set once Cloudinary has the file. */
    result: UploadedAsset | null;
}

const makeId = () =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

interface Options {
    /** Uploads belong to one chat: switching chats drops them (and deletes what was already uploaded). */
    chatId: string | null;
    receiverId: string | null;
}

/**
 * The attachments of the message being written. Choosing files validates them, asks the server for
 * signed upload tickets, and uploads straight to Cloudinary (3 at a time) while the UI shows
 * progress. A file can be removed (cancels it / deletes it from Cloudinary) or retried at any time.
 * Sending only needs `getPayload()`; nothing here ever holds a Cloudinary secret.
 */
export function useAttachmentUploads({ chatId, receiverId }: Options) {
    const [items, setItems] = useState<PendingAttachment[]>([]);

    // The ref is the source of truth for code that runs outside render (uploads finishing, event
    // handlers); the state mirrors it for rendering. Every change goes through `commit`.
    const itemsRef = useRef<PendingAttachment[]>([]);
    const controllers = useRef(new Map<string, AbortController>());
    const queue = useRef<Array<() => Promise<void>>>([]);
    const active = useRef(0);
    /** Bumped whenever the pending set is thrown away, so work started before that can tell it's stale. */
    const session = useRef(0);

    const commit = useCallback((update: (current: PendingAttachment[]) => PendingAttachment[]) => {
        itemsRef.current = update(itemsRef.current);
        setItems(itemsRef.current);
    }, []);

    const patch = useCallback(
        (id: string, changes: Partial<PendingAttachment>) => {
            if (!itemsRef.current.some((item) => item.id === id)) return;
            commit((current) => current.map((item) => (item.id === id ? { ...item, ...changes } : item)));
        },
        [commit]
    );

    /** Starts queued uploads until MAX_PARALLEL_UPLOADS are running; each one that ends starts the next. */
    const pump = useCallback(() => {
        function drain(): void {
            while (active.current < MAX_PARALLEL_UPLOADS && queue.current.length > 0) {
                const task = queue.current.shift()!;
                active.current++;
                void task().finally(() => {
                    active.current--;
                    drain();
                });
            }
        }
        drain();
    }, []);

    const enqueueUpload = useCallback(
        (item: PendingAttachment, ticket: UploadTicket, startedIn: number) => {
            queue.current.push(async () => {
                // It may have been removed (or the chat switched) while it waited for its turn.
                if (startedIn !== session.current || !itemsRef.current.some((current) => current.id === item.id)) return;

                const controller = new AbortController();
                controllers.current.set(item.id, controller);
                patch(item.id, { status: "uploading", progress: 0, error: null, retryable: true });

                try {
                    const asset = await uploadToCloudinary(item.file, ticket, {
                        signal: controller.signal,
                        onProgress: (progress) => patch(item.id, { progress }),
                    });
                    if (controller.signal.aborted || !itemsRef.current.some((current) => current.id === item.id)) {
                        discardUploadedAsset(asset); // removed in the last moment: don't leave it behind
                        return;
                    }
                    patch(item.id, { status: "done", progress: 100, error: null, result: asset });
                } catch (error) {
                    if (isAbortError(error)) return;
                    const failure = toUploadError(error);
                    patch(item.id, { status: "error", error: failure.message, retryable: failure.retryable });
                } finally {
                    controllers.current.delete(item.id);
                }
            });
            pump();
        },
        [patch, pump]
    );

    /** Gets tickets for `batch` in one request, then queues an upload for each file the server accepted. */
    const startBatch = useCallback(
        async (batch: PendingAttachment[]) => {
            if (!receiverId) return;
            const startedIn = session.current;
            try {
                const results = await requestUploadTickets(
                    receiverId,
                    batch.map(({ fileName, file }) => ({ name: fileName, size: file.size, mimeType: file.type }))
                );
                if (startedIn !== session.current) return;

                results.forEach((result, index) => {
                    const item = batch[index];
                    if (!itemsRef.current.some((current) => current.id === item.id)) return; // removed meanwhile
                    if (result.ok) enqueueUpload(item, result.ticket, startedIn);
                    else patch(item.id, { status: "error", error: result.message, retryable: false });
                });
            } catch (error) {
                if (isAbortError(error) || startedIn !== session.current) return;
                const failure = toUploadError(error);
                for (const item of batch) {
                    patch(item.id, { status: "error", error: failure.message, retryable: failure.retryable });
                }
            }
        },
        [enqueueUpload, patch, receiverId]
    );

    const addFiles = useCallback(
        (files: File[]) => {
            if (!receiverId || files.length === 0) return;

            const room = MAX_ATTACHMENTS_PER_MESSAGE - itemsRef.current.length;
            if (room <= 0) {
                toast.error(`You can attach up to ${MAX_ATTACHMENTS_PER_MESSAGE} files to a message.`, { position: COMPOSER_TOAST_POSITION });
                return;
            }

            const accepted: PendingAttachment[] = [];
            const problems: string[] = [];
            let skipped = 0;

            for (const file of files) {
                const fileName = sanitizeFileName(file.name);
                const check = validateAttachmentFile(file);
                if (!check.ok) {
                    problems.push(`${fileName}: ${check.message}`);
                } else if (accepted.length >= room) {
                    skipped++;
                } else {
                    accepted.push({
                        id: makeId(),
                        file,
                        type: check.type,
                        fileName,
                        previewUrl: check.type === "file" ? null : URL.createObjectURL(file),
                        status: "queued",
                        progress: 0,
                        error: null,
                        retryable: true,
                        result: null,
                    });
                }
            }

            if (skipped > 0) {
                problems.push(`Only ${MAX_ATTACHMENTS_PER_MESSAGE} files fit in one message, so ${skipped} ${skipped === 1 ? "file wasn't" : "files weren't"} added.`);
            }
            if (problems.length > 0) {
                toast.error(problems.length === 1 ? problems[0] : `${problems[0]} (and ${problems.length - 1} more)`, {
                    position: COMPOSER_TOAST_POSITION,
                });
            }

            if (accepted.length === 0) return;
            commit((current) => [...current, ...accepted]);
            void startBatch(accepted);
        },
        [commit, receiverId, startBatch]
    );

    const remove = useCallback(
        (id: string) => {
            const item = itemsRef.current.find((current) => current.id === id);
            if (!item) return;
            controllers.current.get(id)?.abort();
            if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
            if (item.result) discardUploadedAsset(item.result);
            commit((current) => current.filter((candidate) => candidate.id !== id));
        },
        [commit]
    );

    const retry = useCallback(
        (id: string) => {
            const item = itemsRef.current.find((current) => current.id === id);
            if (!item || item.status !== "error" || !item.retryable) return;
            const queued = { ...item, status: "queued" as const, progress: 0, error: null };
            patch(id, { status: "queued", progress: 0, error: null });
            void startBatch([queued]); // a fresh ticket: the old one may have expired
        },
        [patch, startBatch]
    );

    /** The message was sent: forget these items WITHOUT deleting their files (the message owns them now). */
    const release = useCallback(
        (ids: string[]) => {
            const gone = new Set(ids);
            for (const item of itemsRef.current) {
                if (gone.has(item.id) && item.previewUrl) URL.revokeObjectURL(item.previewUrl);
            }
            commit((current) => current.filter((item) => !gone.has(item.id)));
        },
        [commit]
    );

    /** Throws everything away: cancels running uploads and deletes what already reached Cloudinary. */
    const discardAll = useCallback(() => {
        session.current++;
        queue.current = [];
        controllers.current.forEach((controller) => controller.abort());
        controllers.current.clear();
        for (const item of itemsRef.current) {
            if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
            if (item.result) discardUploadedAsset(item.result);
        }
        commit(() => []);
    }, [commit]);

    // Uploads are tied to one chat (their files live in that chat's folder): leaving it drops them.
    useEffect(() => discardAll, [chatId, discardAll]);

    /** The finished uploads, ready to go into the "send message" request. */
    const getReady = useCallback(
        () => itemsRef.current.filter((item) => item.status === "done" && item.result !== null),
        []
    );
    const getPayload = useCallback(
        (): SendAttachmentInput[] => getReady().map((item) => toAttachmentPayload(item.fileName, item.result!)),
        [getReady]
    );

    const summary = useMemo(() => {
        const uploading = items.filter((item) => item.status === "queued" || item.status === "uploading").length;
        const failed = items.filter((item) => item.status === "error").length;
        return {
            /** Something is still queued or uploading. */
            isBusy: uploading > 0,
            uploading,
            hasFailed: failed > 0,
            failed,
            remaining: Math.max(0, MAX_ATTACHMENTS_PER_MESSAGE - items.length),
        };
    }, [items]);

    return { items, ...summary, addFiles, remove, retry, release, getReady, getPayload };
}
