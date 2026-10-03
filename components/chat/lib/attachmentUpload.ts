import axios from "axios";
import type { UploadedAsset, UploadTicket, UploadTicketResult } from "../types";
import { compact } from "./attachments";
import { ATTACHMENTS_API_URL } from "./constants";
import type { SendAttachmentInput, SignUploadsRequest } from "./schemas";

/**
 * Browser side of an attachment upload:
 *   requestUploadTickets  ->  the server validates the files and signs one upload per file
 *   uploadToCloudinary    ->  the file goes straight to Cloudinary (progress, cancel, stall detection)
 *   toAttachmentPayload   ->  what the finished upload looks like inside the "send message" request
 * The Cloudinary secret never gets here: a ticket carries only a signature.
 */

/** An upload failure with a message that is safe to show, and whether trying again can help. */
export class AttachmentUploadError extends Error {
    readonly retryable: boolean;

    constructor(message: string, retryable: boolean) {
        super(message);
        this.name = "AttachmentUploadError";
        this.retryable = retryable;
    }
}

export const isAbortError = (error: unknown): boolean =>
    error instanceof DOMException && error.name === "AbortError";

/** Any thrown value -> an AttachmentUploadError (the one thing the UI has to understand). */
export function toUploadError(error: unknown): AttachmentUploadError {
    if (error instanceof AttachmentUploadError) return error;
    return new AttachmentUploadError("Something went wrong. Please try again.", true);
}

/* -------------------------------------------------------------------------------------------------
 * Tickets
 * ---------------------------------------------------------------------------------------------- */

function ticketRequestError(error: unknown): AttachmentUploadError {
    if (!axios.isAxiosError(error) || !error.response) {
        return new AttachmentUploadError("Can't reach the server. Check your connection and try again.", true);
    }
    const { status, data } = error.response;
    const serverMessage = (data as { error?: { message?: string } } | undefined)?.error?.message;

    if (status === 401) return new AttachmentUploadError("Your session expired. Please sign in again.", false);
    if (status === 429) {
        return new AttachmentUploadError(serverMessage ?? "Too many uploads. Wait a moment and try again.", true);
    }
    return new AttachmentUploadError(
        serverMessage ?? "Couldn't prepare the upload. Please try again.",
        status >= 500
    );
}

/** One signed upload ticket (or a per-file refusal) for each file, in the same order. */
export async function requestUploadTickets(
    receiverId: string,
    files: SignUploadsRequest["files"],
    signal?: AbortSignal
): Promise<UploadTicketResult[]> {
    try {
        const { data } = await axios.post<{ results?: UploadTicketResult[] }>(
            ATTACHMENTS_API_URL,
            { receiverId, files },
            { signal }
        );
        if (!Array.isArray(data.results) || data.results.length !== files.length) {
            throw new AttachmentUploadError("Unexpected response from the server. Please try again.", true);
        }
        return data.results;
    } catch (error) {
        if (axios.isCancel(error)) throw new DOMException("Aborted", "AbortError");
        throw error instanceof AttachmentUploadError ? error : ticketRequestError(error);
    }
}

/* -------------------------------------------------------------------------------------------------
 * Upload to Cloudinary
 * ---------------------------------------------------------------------------------------------- */

/** No byte moved for this long: give up (a hung connection must not leave the UI loading forever). */
const STALL_MS = 60_000;
/** After the last byte is sent Cloudinary still processes the file (longer for big videos). */
const PROCESSING_MS = 5 * 60_000;

function cloudinaryError(status: number, message: string): AttachmentUploadError {
    const text = message.toLowerCase();

    if (text.includes("too large") || text.includes("file size")) {
        return new AttachmentUploadError("This file is too large to upload.", false);
    }
    if (text.includes("not allowed") || text.includes("unsupported")) {
        return new AttachmentUploadError("This file type isn't supported.", false);
    }
    if (text.includes("invalid image") || text.includes("invalid video") || text.includes("corrupt")) {
        return new AttachmentUploadError("This file couldn't be read. Try a different one.", false);
    }
    if (status === 401 || status === 403 || text.includes("signature") || text.includes("stale request")) {
        // The ticket is rejected or expired: a retry asks for a fresh one.
        return new AttachmentUploadError("The upload was rejected. Please try again.", true);
    }
    if (status === 420 || status === 429 || status >= 500) {
        return new AttachmentUploadError("The upload service is busy. Try again in a moment.", true);
    }
    return new AttachmentUploadError("Upload failed. Please try again.", true);
}

const finiteNumber = (value: unknown): number | undefined =>
    typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;

interface UploadOptions {
    signal?: AbortSignal;
    /** Whole percent, 0-100; only called when it changes. */
    onProgress?: (percent: number) => void;
}

/** Sends `file` to Cloudinary with the ticket's signed fields. Rejects with AttachmentUploadError, or AbortError when cancelled. */
export function uploadToCloudinary(
    file: File,
    ticket: UploadTicket,
    { signal, onProgress }: UploadOptions = {}
): Promise<UploadedAsset> {
    return new Promise<UploadedAsset>((resolve, reject) => {
        if (signal?.aborted) {
            reject(new DOMException("Aborted", "AbortError"));
            return;
        }

        const xhr = new XMLHttpRequest();
        const form = new FormData();
        for (const [name, value] of Object.entries(ticket.fields)) form.append(name, value);
        form.append("file", file, ticket.fileName);

        let settled = false;
        let stalled = false;
        let lastPercent = -1;
        let watchdog: ReturnType<typeof setTimeout> | undefined;

        const abort = () => xhr.abort();
        const settle = (finish: () => void) => {
            if (settled) return;
            settled = true;
            clearTimeout(watchdog);
            signal?.removeEventListener("abort", abort);
            finish();
        };
        const armWatchdog = (ms: number) => {
            clearTimeout(watchdog);
            watchdog = setTimeout(() => {
                stalled = true;
                xhr.abort();
            }, ms);
        };
        const report = (percent: number) => {
            if (percent === lastPercent) return;
            lastPercent = percent;
            onProgress?.(percent);
        };

        signal?.addEventListener("abort", abort, { once: true });

        xhr.upload.onprogress = (event) => {
            armWatchdog(STALL_MS);
            // Hold at 99 until the upload is confirmed: 100% means "Cloudinary has it".
            if (event.lengthComputable && event.total > 0) report(Math.min(99, Math.floor((event.loaded / event.total) * 100)));
        };
        xhr.upload.onload = () => armWatchdog(PROCESSING_MS);

        xhr.onload = () =>
            settle(() => {
                let body: Record<string, unknown> | null = null;
                try {
                    body = JSON.parse(xhr.responseText) as Record<string, unknown>;
                } catch {
                    body = null;
                }

                if (xhr.status < 200 || xhr.status >= 300) {
                    const message = (body?.error as { message?: string } | undefined)?.message ?? "";
                    reject(cloudinaryError(xhr.status, message));
                    return;
                }

                const bytes = finiteNumber(body?.bytes);
                const version = finiteNumber(body?.version);
                if (
                    typeof body?.public_id !== "string" ||
                    body.resource_type !== ticket.resourceType ||
                    bytes === undefined ||
                    version === undefined
                ) {
                    reject(new AttachmentUploadError("Unexpected response from the upload service. Please try again.", true));
                    return;
                }

                report(100);
                resolve(
                    compact<UploadedAsset>({
                        publicId: body.public_id,
                        resourceType: ticket.resourceType,
                        version,
                        format: typeof body.format === "string" ? body.format : undefined,
                        bytes,
                        width: finiteNumber(body.width),
                        height: finiteNumber(body.height),
                        duration: finiteNumber(body.duration),
                    })
                );
            });

        xhr.onerror = () =>
            settle(() =>
                reject(new AttachmentUploadError("Network error. Check your connection and try again.", true))
            );

        xhr.onabort = () =>
            settle(() =>
                reject(
                    stalled
                        ? new AttachmentUploadError("The upload stalled. Check your connection and try again.", true)
                        : new DOMException("Aborted", "AbortError")
                )
            );

        xhr.open("POST", ticket.uploadUrl);
        armWatchdog(STALL_MS);
        xhr.send(form);
    });
}

/* -------------------------------------------------------------------------------------------------
 * Sending and clean-up
 * ---------------------------------------------------------------------------------------------- */

/** A finished upload as it goes into the "send message" request. */
export function toAttachmentPayload(fileName: string, asset: UploadedAsset): SendAttachmentInput {
    return compact<SendAttachmentInput>({
        publicId: asset.publicId,
        resourceType: asset.resourceType,
        version: asset.version,
        format: asset.format,
        fileName,
        fileSize: Math.round(asset.bytes),
        width: asset.width ? Math.round(asset.width) : undefined,
        height: asset.height ? Math.round(asset.height) : undefined,
        duration: asset.duration,
    });
}

/**
 * A finished voice-message upload as it goes into the "send message" request. The length and the
 * waveform come from the recorder: a browser recording carries no reliable duration of its own.
 */
export function toVoicePayload(
    fileName: string,
    asset: UploadedAsset,
    recording: { duration: number; waveform: number[] }
): SendAttachmentInput {
    return compact<SendAttachmentInput>({
        ...toAttachmentPayload(fileName, asset),
        kind: "voice",
        duration: recording.duration,
        waveform: recording.waveform,
    });
}

/**
 * Tells the server to delete an upload that won't be sent. Fire and forget: `keepalive` lets it
 * finish even when the chat is closing, and a failure only leaves one orphaned file behind.
 */
export function discardUploadedAsset(asset: Pick<UploadedAsset, "publicId" | "resourceType">): void {
    fetch(ATTACHMENTS_API_URL, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicId: asset.publicId, resourceType: asset.resourceType }),
        keepalive: true,
    }).catch(() => undefined);
}
