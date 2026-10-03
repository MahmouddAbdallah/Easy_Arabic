import type {
    AttachmentType,
    CloudinaryResourceType,
    MessageAttachment,
} from "../types";

/**
 * Attachment rules shared by the browser and the server. Pure helpers: no secrets, no Node or
 * browser APIs. The browser uses them to give instant feedback; the server runs the very same
 * checks again and is the one that decides (never trust the client).
 */

export const ATTACHMENT_TYPES = ["image", "video", "file"] as const;

/** Most attachments one message can carry. */
export const MAX_ATTACHMENTS_PER_MESSAGE = 10;

const MB = 1024 * 1024;

/** Largest accepted file per attachment type, in bytes. Keep in line with the Cloudinary plan limits. */
export const MAX_ATTACHMENT_BYTES: Record<AttachmentType, number> = {
    image: 10 * MB,
    video: 50 * MB,
    // A voice message is capped by its length (MAX_VOICE_SECONDS); this is the safety net behind it.
    audio: 10 * MB,
    file: 10 * MB,
};

export const MAX_FILE_NAME_LENGTH = 255;

/** Documents are stored in Cloudinary as `raw` files; images and videos keep their own kind. */
export const CLOUDINARY_RESOURCE_TYPE: Record<AttachmentType, CloudinaryResourceType> = {
    image: "image",
    video: "video",
    // Cloudinary stores audio under the `video` asset kind.
    audio: "video",
    file: "raw",
};

interface AttachmentFormat {
    type: AttachmentType;
    /** Lower-case extensions without the dot. */
    extensions: readonly string[];
    /** MIME types browsers report for it; the first one is the canonical one. */
    mimeTypes: readonly string[];
}

/**
 * The allow-list. Anything not listed here (executables, scripts, SVG/HTML, disk images...) is
 * refused. The extension decides the type; a MIME type the browser reports must not contradict it.
 */
const FORMATS: readonly AttachmentFormat[] = [
    { type: "image", extensions: ["jpg", "jpeg"], mimeTypes: ["image/jpeg", "image/pjpeg"] },
    { type: "image", extensions: ["png"], mimeTypes: ["image/png"] },
    { type: "image", extensions: ["webp"], mimeTypes: ["image/webp"] },
    { type: "image", extensions: ["gif"], mimeTypes: ["image/gif"] },
    { type: "image", extensions: ["avif"], mimeTypes: ["image/avif"] },
    { type: "image", extensions: ["heic"], mimeTypes: ["image/heic", "image/heic-sequence"] },
    { type: "image", extensions: ["heif"], mimeTypes: ["image/heif", "image/heif-sequence"] },

    { type: "video", extensions: ["mp4"], mimeTypes: ["video/mp4"] },
    { type: "video", extensions: ["mov"], mimeTypes: ["video/quicktime"] },
    { type: "video", extensions: ["webm"], mimeTypes: ["video/webm"] },
    { type: "video", extensions: ["3gp"], mimeTypes: ["video/3gpp"] },
    { type: "video", extensions: ["mkv"], mimeTypes: ["video/x-matroska"] },

    { type: "file", extensions: ["pdf"], mimeTypes: ["application/pdf"] },
    { type: "file", extensions: ["doc"], mimeTypes: ["application/msword"] },
    {
        type: "file",
        extensions: ["docx"],
        mimeTypes: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    },
    { type: "file", extensions: ["xls"], mimeTypes: ["application/vnd.ms-excel"] },
    {
        type: "file",
        extensions: ["xlsx"],
        mimeTypes: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
    },
    { type: "file", extensions: ["ppt"], mimeTypes: ["application/vnd.ms-powerpoint"] },
    {
        type: "file",
        extensions: ["pptx"],
        mimeTypes: ["application/vnd.openxmlformats-officedocument.presentationml.presentation"],
    },
    { type: "file", extensions: ["odt"], mimeTypes: ["application/vnd.oasis.opendocument.text"] },
    { type: "file", extensions: ["ods"], mimeTypes: ["application/vnd.oasis.opendocument.spreadsheet"] },
    { type: "file", extensions: ["odp"], mimeTypes: ["application/vnd.oasis.opendocument.presentation"] },
    { type: "file", extensions: ["txt"], mimeTypes: ["text/plain"] },
    { type: "file", extensions: ["csv"], mimeTypes: ["text/csv", "application/csv"] },
    { type: "file", extensions: ["rtf"], mimeTypes: ["application/rtf", "text/rtf"] },
    { type: "file", extensions: ["zip"], mimeTypes: ["application/zip", "application/x-zip-compressed"] },
];

const BY_EXTENSION = new Map<string, AttachmentFormat>();
const BY_MIME_TYPE = new Map<string, AttachmentFormat>();
for (const format of FORMATS) {
    for (const extension of format.extensions) BY_EXTENSION.set(extension, format);
    for (const mimeType of format.mimeTypes) if (!BY_MIME_TYPE.has(mimeType)) BY_MIME_TYPE.set(mimeType, format);
}

/** Browsers send these when they don't know the file type (common for .heic, .mkv, some Office files). */
const GENERIC_MIME_TYPES = new Set(["", "application/octet-stream", "binary/octet-stream", "application/x-octet-stream"]);

/** The allow-list entry for a file extension (case-insensitive, no dot), if there is one. */
export function lookupExtension(extension: string): { type: AttachmentType; extension: string; mimeType: string } | null {
    const format = BY_EXTENSION.get(extension.toLowerCase());
    return format ? { type: format.type, extension: extension.toLowerCase(), mimeType: format.mimeTypes[0] } : null;
}

/** Extensions for the formats of one type, e.g. what Cloudinary's `allowed_formats` takes. */
export function getFormatExtensions(type: AttachmentType): string[] {
    return FORMATS.filter((format) => format.type === type).flatMap((format) => [...format.extensions]);
}

/** Values for the `accept` attribute of the file inputs. */
export const ATTACHMENT_ACCEPT: Record<AttachmentType, string> = {
    // Broad on purpose: the picker then offers the camera/photo library on phones. Formats we don't
    // support (SVG, BMP...) are turned down with a clear message by validateAttachmentFile.
    image: "image/*",
    video: "video/*",
    // Voice messages are recorded in the chat, never picked, so no chooser uses this.
    audio: "audio/*",
    file: getFormatExtensions("file")
        .map((extension) => `.${extension}`)
        .join(","),
};

export type AttachmentErrorCode =
    | "EMPTY_FILE"
    | "UNSUPPORTED_TYPE"
    | "TYPE_MISMATCH"
    | "FILE_TOO_LARGE";

export type AttachmentValidation =
    | {
          ok: true;
          type: AttachmentType;
          resourceType: CloudinaryResourceType;
          /** The MIME type to store: the browser's when it is trustworthy, else the canonical one. */
          mimeType: string;
          /** Lower-case extension without the dot. */
          extension: string;
      }
    | { ok: false; code: AttachmentErrorCode; message: string };

// Control characters and bidi overrides (the "invoice‮fdp.exe" trick) have no place in a file name.
const UNSAFE_NAME_CHARS = /[\u0000-\u001f\u007f\u200e\u200f\u202a-\u202e\u2066-\u2069]/g;

/** A display-safe file name: no path parts, control or bidi characters, bounded length. Keeps Arabic and other scripts. */
export function sanitizeFileName(name: string): string {
    let clean = name
        .replace(UNSAFE_NAME_CHARS, "")
        .replace(/[\\/]+/g, "_")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/^\.+/, "");
    if (!clean) return "file";

    if (clean.length > MAX_FILE_NAME_LENGTH) {
        const extension = getFileExtension(clean);
        const suffix = extension ? `.${extension}` : "";
        clean = clean.slice(0, MAX_FILE_NAME_LENGTH - suffix.length) + suffix;
    }
    return clean;
}

/** Lower-case extension without the dot, or "" when there is none. */
export function getFileExtension(name: string): string {
    const dot = name.lastIndexOf(".");
    if (dot <= 0 || dot === name.length - 1) return "";
    const extension = name.slice(dot + 1).toLowerCase();
    return /^[a-z0-9]{1,8}$/.test(extension) ? extension : "";
}

function kindOfMimeType(mimeType: string): AttachmentType {
    if (mimeType.startsWith("image/")) return "image";
    if (mimeType.startsWith("video/")) return "video";
    return "file";
}

const TYPE_LABELS: Record<AttachmentType, string> = {
    image: "Photos",
    video: "Videos",
    audio: "Voice messages",
    file: "Files",
};

/**
 * Is this file allowed as an attachment? Checks the type (allow-list), that the extension and the
 * reported MIME type don't contradict each other, and the size limit of its type.
 */
export function validateAttachmentFile(file: { name: string; size: number; type?: string }): AttachmentValidation {
    if (!Number.isFinite(file.size) || file.size <= 0) {
        return { ok: false, code: "EMPTY_FILE", message: "This file is empty." };
    }

    const name = sanitizeFileName(file.name);
    const claimed = (file.type ?? "").split(";")[0].trim().toLowerCase();
    const extension = getFileExtension(name);

    // The extension decides; a pasted/dragged file without one is recognised by its MIME type.
    const format = (extension ? BY_EXTENSION.get(extension) : undefined) ?? BY_MIME_TYPE.get(claimed);
    if (!format) {
        return { ok: false, code: "UNSUPPORTED_TYPE", message: "This file type isn't supported." };
    }

    const trusted = !GENERIC_MIME_TYPES.has(claimed);
    if (trusted && kindOfMimeType(claimed) !== format.type) {
        return { ok: false, code: "TYPE_MISMATCH", message: "The file extension doesn't match its type." };
    }

    const limit = MAX_ATTACHMENT_BYTES[format.type];
    if (file.size > limit) {
        return {
            ok: false,
            code: "FILE_TOO_LARGE",
            message: `${TYPE_LABELS[format.type]} must be ${formatFileSize(limit)} or smaller.`,
        };
    }

    return {
        ok: true,
        type: format.type,
        resourceType: CLOUDINARY_RESOURCE_TYPE[format.type],
        mimeType: trusted ? claimed : format.mimeTypes[0],
        extension: extension || format.extensions[0],
    };
}

/** 1536 -> "1.5 KB". Empty string when the size is unknown. */
export function formatFileSize(bytes: number | undefined): string {
    if (bytes === undefined || !Number.isFinite(bytes) || bytes < 0) return "";
    if (bytes < 1024) return `${Math.round(bytes)} B`;

    const units = ["KB", "MB", "GB"];
    let value = bytes / 1024;
    let unit = 0;
    while (value >= 1024 && unit < units.length - 1) {
        value /= 1024;
        unit++;
    }
    const rounded = value >= 100 ? Math.round(value) : Math.round(value * 10) / 10;
    return `${rounded % 1 === 0 ? rounded : rounded.toFixed(1)} ${units[unit]}`;
}

/** 75 -> "1:15", 3725 -> "1:02:05". */
export function formatDuration(seconds: number | undefined): string {
    if (seconds === undefined || !Number.isFinite(seconds) || seconds < 0) return "";
    const total = Math.round(seconds);
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    const two = (n: number) => String(n).padStart(2, "0");
    return hours > 0 ? `${hours}:${two(minutes)}:${two(secs)}` : `${minutes}:${two(secs)}`;
}

/* -------------------------------------------------------------------------------------------------
 * Voice messages
 *
 * A voice message is an `audio` attachment recorded in the browser (MediaRecorder). It is not part of
 * FORMATS on purpose: .webm and .mp4 already mean *video* to the file chooser, so audio gets its own
 * allow-list and its own validator, and only a request that says it is a voice message can use it.
 * ---------------------------------------------------------------------------------------------- */

/** Longest recording. At the recorder's bit rate this stays far below the size limit. */
export const MAX_VOICE_SECONDS = 10 * 60;
/** Shorter recordings are an accidental tap and are thrown away. */
export const MIN_VOICE_SECONDS = 1;
/** Bars in the waveform the recorder produces. */
export const VOICE_WAVEFORM_BARS = 40;
/** Most bars the server stores (headroom over VOICE_WAVEFORM_BARS). */
export const MAX_WAVEFORM_BARS = 128;

interface VoiceFormat {
    /** Extensions Cloudinary may report for this kind of recording; the first is the one we upload as. */
    extensions: readonly string[];
    /** MIME types for it; the first is the canonical one. */
    mimeTypes: readonly string[];
}

/** What browsers record: WebM/Opus (Chrome, Edge, Firefox, Android), Ogg/Opus (Firefox), MP4/AAC (Safari, iOS). */
const VOICE_FORMATS: readonly VoiceFormat[] = [
    { extensions: ["webm"], mimeTypes: ["audio/webm"] },
    { extensions: ["ogg", "opus"], mimeTypes: ["audio/ogg", "audio/opus"] },
    // Cloudinary may name an audio-only MP4/AAC recording "m4a", "mp4" or "aac" depending on how it probes it.
    { extensions: ["m4a", "mp4", "aac"], mimeTypes: ["audio/mp4", "audio/x-m4a", "audio/m4a"] },
];

const VOICE_BY_EXTENSION = new Map<string, VoiceFormat>();
const VOICE_BY_MIME_TYPE = new Map<string, VoiceFormat>();
for (const format of VOICE_FORMATS) {
    for (const extension of format.extensions) VOICE_BY_EXTENSION.set(extension, format);
    for (const mimeType of format.mimeTypes) VOICE_BY_MIME_TYPE.set(mimeType, format);
}

/** The voice-message entry for a file extension (case-insensitive, no dot), if there is one. */
export function lookupVoiceExtension(
    extension: string
): { type: "audio"; extension: string; mimeType: string } | null {
    const format = VOICE_BY_EXTENSION.get(extension.toLowerCase());
    return format ? { type: "audio", extension: extension.toLowerCase(), mimeType: format.mimeTypes[0] } : null;
}

/** Every extension of the recording family `extension` belongs to ("m4a" -> m4a, mp4): what Cloudinary's `allowed_formats` takes. */
export function getVoiceFormatExtensions(extension: string): string[] {
    return [...(VOICE_BY_EXTENSION.get(extension.toLowerCase())?.extensions ?? [])];
}

/**
 * Is this recording acceptable as a voice message? Checks the audio format (the MIME type decides,
 * and the extension must not contradict it), that it isn't empty, and the size limit.
 */
export function validateVoiceFile(file: { name: string; size: number; type?: string }): AttachmentValidation {
    if (!Number.isFinite(file.size) || file.size <= 0) {
        return { ok: false, code: "EMPTY_FILE", message: "This recording is empty." };
    }

    const claimed = (file.type ?? "").split(";")[0].trim().toLowerCase();
    const extension = getFileExtension(sanitizeFileName(file.name));
    const byMime = VOICE_BY_MIME_TYPE.get(claimed);
    const byExtension = extension ? VOICE_BY_EXTENSION.get(extension) : undefined;

    // A MIME type the browser states is trusted over the name; without one the extension has to do.
    const trusted = !GENERIC_MIME_TYPES.has(claimed);
    const format = trusted ? byMime : byExtension;
    if (!format) {
        return { ok: false, code: "UNSUPPORTED_TYPE", message: "This audio format isn't supported." };
    }
    if (trusted && byExtension && byExtension !== format) {
        return { ok: false, code: "TYPE_MISMATCH", message: "The file extension doesn't match its type." };
    }

    if (file.size > MAX_ATTACHMENT_BYTES.audio) {
        return {
            ok: false,
            code: "FILE_TOO_LARGE",
            message: `${TYPE_LABELS.audio} must be ${formatFileSize(MAX_ATTACHMENT_BYTES.audio)} or smaller.`,
        };
    }

    return {
        ok: true,
        type: "audio",
        resourceType: CLOUDINARY_RESOURCE_TYPE.audio,
        mimeType: format.mimeTypes[0],
        extension: byExtension ? extension : format.extensions[0],
    };
}

/** Waveform bars from anywhere (the browser, Firestore, a request) -> whole numbers 0-100, bounded in count. */
export function sanitizeWaveform(value: unknown): number[] | undefined {
    if (!Array.isArray(value) || value.length === 0) return undefined;
    return value
        .slice(0, MAX_WAVEFORM_BARS)
        .map((bar) => (typeof bar === "number" && Number.isFinite(bar) ? Math.min(100, Math.max(0, Math.round(bar))) : 0));
}

/** Old messages stored the size as a label ("12.3 KB"); turn it back into bytes so every size is a number. */
function parseLegacyFileSize(label: string): number | undefined {
    const match = /^\s*([\d.]+)\s*(B|KB|MB|GB)\s*$/i.exec(label);
    if (!match) return undefined;
    const value = parseFloat(match[1]);
    if (!Number.isFinite(value) || value <= 0) return undefined;
    const power = { B: 0, KB: 1, MB: 2, GB: 3 }[match[2].toUpperCase() as "B" | "KB" | "MB" | "GB"];
    return Math.round(value * 1024 ** power);
}

/** Drops `undefined` values (Firestore refuses them and they only add noise). */
export function compact<T extends object>(value: T): T {
    return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;
}

const positiveNumber = (value: unknown): number | undefined =>
    typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;

const text = (value: unknown): string | undefined => (typeof value === "string" && value ? value : undefined);

/**
 * Any stored attachment (current or the old single-attachment shape) -> a clean MessageAttachment.
 * Only https URLs are kept, so a leftover blob:/data:/javascript: URL can never reach an <img>.
 */
export function normalizeAttachment(raw: unknown): MessageAttachment | null {
    if (!raw || typeof raw !== "object") return null;
    const source = raw as Record<string, unknown>;

    const type: AttachmentType =
        source.type === "image" || source.type === "video" || source.type === "audio" ? source.type : "file";
    const url = text(source.url);
    const resourceType =
        source.resourceType === "image" || source.resourceType === "video" || source.resourceType === "raw"
            ? source.resourceType
            : undefined;

    return compact<MessageAttachment>({
        type,
        url: url && /^https:\/\//i.test(url) ? url : undefined,
        publicId: text(source.publicId),
        resourceType,
        fileName: text(source.fileName),
        fileSize: typeof source.fileSize === "string" ? parseLegacyFileSize(source.fileSize) : positiveNumber(source.fileSize),
        mimeType: text(source.mimeType),
        width: positiveNumber(source.width),
        height: positiveNumber(source.height),
        duration: positiveNumber(source.duration),
        waveform: type === "audio" ? sanitizeWaveform(source.waveform) : undefined,
    });
}

/** The attachments of a message document: the `attachments` list, or the old single `attachment`. */
export function getMessageAttachments(data: { attachments?: unknown; attachment?: unknown }): MessageAttachment[] {
    if (Array.isArray(data.attachments)) {
        return data.attachments.map(normalizeAttachment).filter((a): a is MessageAttachment => a !== null);
    }
    const legacy = normalizeAttachment(data.attachment);
    return legacy ? [legacy] : [];
}

/** Does the message document carry any attachment (new list or the old single field)? */
export const hasAttachments = (data: { attachments?: unknown; attachment?: unknown }): boolean =>
    getMessageAttachments(data).length > 0;

export const isMediaAttachment = (attachment: Pick<MessageAttachment, "type">): boolean =>
    attachment.type === "image" || attachment.type === "video";

/** A recorded voice message (shown with the audio player, not the photo/video grid or the file cards). */
export const isVoiceAttachment = (attachment: Pick<MessageAttachment, "type">): boolean =>
    attachment.type === "audio";

/** Cloudinary asset kind of a stored attachment. */
export function getAttachmentResourceType(attachment: Pick<MessageAttachment, "type" | "resourceType">): CloudinaryResourceType {
    return attachment.resourceType ?? CLOUDINARY_RESOURCE_TYPE[attachment.type];
}
