/**
 * SERVER ONLY — holds the Cloudinary credentials. Never import this from a client component.
 *
 * How attachments work:
 *  1. The browser describes the files it wants to send; createUploadTickets validates them and signs
 *     one upload per file. The browser then uploads straight to Cloudinary (no file ever passes
 *     through this server, so there's no request-size limit and the UI gets real progress).
 *  2. A signature can't cap a file's size, so everything is checked again when the message is sent
 *     (resolveAttachments): the file must sit in the sender's own folder for this chat, must really
 *     exist in Cloudinary, and its real type and size must be allowed. The URL that gets stored is
 *     Cloudinary's own, never one supplied by the client.
 *  3. Files that are removed before sending, or belong to a deleted message, are destroyed.
 *
 * Voice messages take the very same road. They differ in two places only: the file is checked against
 * the audio allow-list (a request has to say `kind: "voice"` for that), and the stored attachment is
 * an `audio` one that also carries its duration and waveform. Cloudinary keeps audio under `video`.
 *
 * Environment (server only): CLOUDINARY_URL, or CLOUDINARY_CLOUD_NAME + CLOUDINARY_API_KEY +
 * CLOUDINARY_API_SECRET. NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME (already used by next-cloudinary) is
 * accepted as the cloud name. The secret is only ever used here to sign and to call the Admin API.
 */
import { randomBytes } from "node:crypto";
import { v2 as cloudinary } from "cloudinary";
import {
    CLOUDINARY_RESOURCE_TYPE,
    MAX_ATTACHMENTS_PER_MESSAGE,
    MAX_ATTACHMENT_BYTES,
    MAX_VOICE_SECONDS,
    compact,
    getFileExtension,
    getFormatExtensions,
    getVoiceFormatExtensions,
    lookupExtension,
    lookupVoiceExtension,
    sanitizeFileName,
    sanitizeWaveform,
    validateAttachmentFile,
    validateVoiceFile,
} from "./attachments";
import { ChatApiError } from "./messageOperations.server";
import type { SendAttachmentInput } from "./schemas";
import type { CloudinaryResourceType, MessageAttachment, UploadTicketResult } from "../types";

/* -------------------------------------------------------------------------------------------------
 * Configuration
 * ---------------------------------------------------------------------------------------------- */

interface Credentials {
    cloudName: string;
    apiKey: string;
    apiSecret: string;
}

/** cloudinary://<api_key>:<api_secret>@<cloud_name> */
function parseCloudinaryUrl(value: string): Credentials | null {
    try {
        const url = new URL(value);
        if (url.protocol !== "cloudinary:") return null;
        const apiKey = decodeURIComponent(url.username);
        const apiSecret = decodeURIComponent(url.password);
        const cloudName = url.hostname;
        return apiKey && apiSecret && cloudName ? { cloudName, apiKey, apiSecret } : null;
    } catch {
        return null;
    }
}

function readCredentials(): Credentials | null {
    if (process.env.CLOUDINARY_URL) {
        const fromUrl = parseCloudinaryUrl(process.env.CLOUDINARY_URL);
        if (fromUrl) return fromUrl;
    }
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    return cloudName && apiKey && apiSecret ? { cloudName, apiKey, apiSecret } : null;
}

/** The configured SDK, or a 503 the UI can show when the credentials are missing. */
function getCloudinary() {
    const credentials = readCredentials();
    if (!credentials) {
        console.error(
            "[chat attachments] Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET (or CLOUDINARY_URL)."
        );
        throw new ChatApiError(
            "ATTACHMENTS_UNAVAILABLE",
            "Sending files isn't available right now. Please try again later.",
            503
        );
    }
    cloudinary.config({
        cloud_name: credentials.cloudName,
        api_key: credentials.apiKey,
        api_secret: credentials.apiSecret,
        secure: true,
    });
    return { sdk: cloudinary, credentials };
}

/* -------------------------------------------------------------------------------------------------
 * Naming: every upload lives in  easy-arabic/chat/<chat>/<sender>/<random>[.ext]
 * ---------------------------------------------------------------------------------------------- */

export const CHAT_UPLOAD_ROOT = "easy-arabic/chat";
const UPLOAD_TAG = "easy-arabic-chat";

/** What follows the sender's folder: 128 random bits, plus the extension for documents (raw files keep it in the id). */
const UPLOAD_ID = /^[a-f0-9]{32}(?:\.[a-z0-9]{1,8})?$/;

/**
 * Folder names use hyphens only: Cloudinary can read an underscore near the start of a path as a
 * transformation (u_2/photo), and the chat id joins the two user ids with one.
 */
const chatFolder = (chatId: string) => chatId.replace(/_/g, "-");

/** Where `userId`'s uploads for this chat live. Only files under it can be attached by that user. */
export const chatUploadPrefix = (chatId: string, userId: string) =>
    `${CHAT_UPLOAD_ROOT}/${chatFolder(chatId)}/${userId}/`;

/** Is this one of `userId`'s own chat uploads (in any chat)? Gate for removing an unsent upload. */
export function isUploadOf(publicId: string, userId: string): boolean {
    const parts = publicId.split("/");
    return (
        parts.length === 5 &&
        `${parts[0]}/${parts[1]}` === CHAT_UPLOAD_ROOT &&
        parts[3] === userId &&
        UPLOAD_ID.test(parts[4])
    );
}

/* -------------------------------------------------------------------------------------------------
 * 1. Upload tickets
 * ---------------------------------------------------------------------------------------------- */

export interface UploadFileRequest {
    name: string;
    size: number;
    mimeType: string;
    /** "voice": a recording made in the chat, checked as audio. */
    kind?: "voice";
}

/** Validates each file and signs one upload for every file that passes. Same order as `files`. */
export function createUploadTickets(
    actorId: string,
    chatId: string,
    files: readonly UploadFileRequest[]
): UploadTicketResult[] {
    const { sdk, credentials } = getCloudinary();
    const prefix = chatUploadPrefix(chatId, actorId);
    const timestamp = String(Math.round(Date.now() / 1000));

    return files.map((file): UploadTicketResult => {
        const isVoice = file.kind === "voice";
        const description = { name: file.name, size: file.size, type: file.mimeType };
        const check = isVoice ? validateVoiceFile(description) : validateAttachmentFile(description);
        if (!check.ok) return { ok: false, code: check.code, message: check.message };

        const isRaw = check.resourceType === "raw";
        // Everything in `params` is part of the signature, so the browser can't change any of it.
        const params = {
            // Documents must match the extension that was approved; images/videos any of their allowed
            // formats; a recording only the formats of its own family (Cloudinary may name an audio-only
            // MP4 "m4a" or "mp4").
            allowed_formats: isRaw
                ? check.extension
                : isVoice
                  ? getVoiceFormatExtensions(check.extension).join(",")
                  : getFormatExtensions(check.type).join(","),
            public_id: `${prefix}${randomBytes(16).toString("hex")}${isRaw ? `.${check.extension}` : ""}`,
            tags: UPLOAD_TAG,
            timestamp,
        };

        return {
            ok: true,
            ticket: {
                uploadUrl: `https://api.cloudinary.com/v1_1/${credentials.cloudName}/${check.resourceType}/upload`,
                fields: {
                    ...params,
                    api_key: credentials.apiKey,
                    signature: sdk.utils.api_sign_request(params, credentials.apiSecret),
                },
                fileName: `upload.${check.extension}`,
                type: check.type,
                resourceType: check.resourceType,
            },
        };
    });
}

/* -------------------------------------------------------------------------------------------------
 * 2. Verification when the message is sent
 * ---------------------------------------------------------------------------------------------- */

/** The part of Cloudinary's Admin API record we use. */
interface RemoteAsset {
    public_id: string;
    resource_type?: string;
    type?: string;
    format?: string;
    bytes?: number;
    width?: number;
    height?: number;
    secure_url?: string;
}

/** public id -> the asset, `null` when Cloudinary confirms it isn't there. Ids that could not be checked are absent. */
type Lookup = Map<string, RemoteAsset | null>;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function errorStatus(error: unknown): number | undefined {
    const e = error as { http_code?: number; error?: { http_code?: number } } | null;
    return e?.error?.http_code ?? e?.http_code;
}

/**
 * Asks Cloudinary about the uploads. The Admin API is rate limited (500 calls/hour on the free plan),
 * so this is best effort: if Cloudinary can't be asked (rate limit, outage, key without Admin access)
 * the ids stay unchecked and the message goes through on the strength of the signed upload and the
 * ownership check. A file Cloudinary positively says doesn't exist is rejected.
 */
async function lookupAssets(
    sdk: typeof cloudinary,
    resourceType: CloudinaryResourceType,
    publicIds: string[]
): Promise<Lookup> {
    const lookup: Lookup = new Map();
    let pending = publicIds;

    // A second look covers the brief window in which a just-finished upload isn't listed yet.
    for (let attempt = 0; attempt < 2 && pending.length > 0; attempt++) {
        if (attempt > 0) await sleep(600);
        try {
            const response = (await sdk.api.resources_by_ids(pending, {
                resource_type: resourceType,
                type: "upload",
            })) as { resources?: RemoteAsset[] };
            for (const asset of response.resources ?? []) lookup.set(asset.public_id, asset);
            pending = pending.filter((id) => !lookup.has(id));
        } catch (error) {
            console.warn(
                `[chat attachments] Couldn't verify ${resourceType} uploads with Cloudinary (HTTP ${errorStatus(error) ?? "no response"}); relying on the signed upload.`
            );
            return lookup;
        }
    }

    for (const id of pending) lookup.set(id, null);
    return lookup;
}

/** A voice message may run this much past MAX_VOICE_SECONDS before it is turned down. */
const VOICE_LENGTH_SLACK_SECONDS = 5;

const invalidAttachment = (label: string) =>
    new ChatApiError(
        "INVALID_ATTACHMENT",
        `"${label}" couldn't be verified. Remove it and attach it again.`,
        400
    );

/**
 * The attachments of a message to send -> what gets stored in Firestore. Throws a ChatApiError when
 * any of them isn't acceptable; nothing is stored in that case.
 */
export async function resolveAttachments(
    actorId: string,
    chatId: string,
    inputs: readonly SendAttachmentInput[]
): Promise<MessageAttachment[]> {
    if (inputs.length === 0) return [];
    if (inputs.length > MAX_ATTACHMENTS_PER_MESSAGE) {
        throw new ChatApiError(
            "TOO_MANY_ATTACHMENTS",
            `You can attach up to ${MAX_ATTACHMENTS_PER_MESSAGE} files to a message.`,
            400
        );
    }

    const { sdk, credentials } = getCloudinary();
    const prefix = chatUploadPrefix(chatId, actorId);

    // Cheap checks first: each one must be this sender's own upload for THIS chat, listed once.
    const seen = new Set<string>();
    const candidates = inputs.map((input) => {
        const label = sanitizeFileName(input.fileName);
        const idPart = input.publicId.startsWith(prefix) ? input.publicId.slice(prefix.length) : "";
        if (!UPLOAD_ID.test(idPart) || seen.has(input.publicId)) throw invalidAttachment(label);
        // Audio lives under Cloudinary's `video` kind; a "voice message" in any other kind is not one.
        if (input.kind === "voice" && input.resourceType !== CLOUDINARY_RESOURCE_TYPE.audio) throw invalidAttachment(label);
        seen.add(input.publicId);
        return { input, label, idPart };
    });

    const idsByType = new Map<CloudinaryResourceType, string[]>();
    for (const { input } of candidates) {
        idsByType.set(input.resourceType, [...(idsByType.get(input.resourceType) ?? []), input.publicId]);
    }
    const lookups = await Promise.all(
        [...idsByType].map(([resourceType, ids]) => lookupAssets(sdk, resourceType, ids))
    );
    const remote: Lookup = new Map(lookups.flatMap((lookup) => [...lookup]));

    const resolved: MessageAttachment[] = [];
    for (const { input, label, idPart } of candidates) {
        const asset = remote.get(input.publicId); // undefined: not checked, null: doesn't exist
        if (asset === null) throw invalidAttachment(label);
        if (asset && (asset.type !== "upload" || (asset.resource_type ?? input.resourceType) !== input.resourceType)) {
            throw invalidAttachment(label);
        }

        // The type comes from what the file really is (Cloudinary's record when we have it), never from a claim.
        // A voice message is looked up in the audio allow-list, everything else in the regular one.
        const isVoice = input.kind === "voice";
        const extension = (
            input.resourceType === "raw" ? getFileExtension(idPart) : (asset?.format ?? input.format ?? "")
        ).toLowerCase();
        const format = isVoice ? lookupVoiceExtension(extension) : lookupExtension(extension);
        if (!format || CLOUDINARY_RESOURCE_TYPE[format.type] !== input.resourceType) {
            await discard(asset, input);
            throw new ChatApiError("UNSUPPORTED_FILE_TYPE", `"${label}": this file type isn't supported.`, 415);
        }

        const bytes = asset?.bytes ?? input.fileSize;
        if (bytes !== undefined && bytes > MAX_ATTACHMENT_BYTES[format.type]) {
            await discard(asset, input);
            throw new ChatApiError("FILE_TOO_LARGE", `"${label}" is too large to send.`, 413);
        }

        // The recorder stops at MAX_VOICE_SECONDS; a few seconds of slack cover timer rounding.
        if (isVoice && input.duration !== undefined && input.duration > MAX_VOICE_SECONDS + VOICE_LENGTH_SLACK_SECONDS) {
            await discard(asset, input);
            throw new ChatApiError(
                "VOICE_TOO_LONG",
                `Voice messages can be up to ${MAX_VOICE_SECONDS / 60} minutes long.`,
                400
            );
        }

        resolved.push(
            compact<MessageAttachment>({
                type: format.type,
                url: asset?.secure_url ?? deliveryUrl(credentials.cloudName, input, extension),
                publicId: input.publicId,
                resourceType: input.resourceType,
                fileName: label,
                fileSize: bytes,
                mimeType: format.mimeType,
                width: isVoice ? undefined : (asset?.width ?? input.width),
                height: isVoice ? undefined : (asset?.height ?? input.height),
                // Not part of Cloudinary's asset record; only used to label the player.
                duration: input.duration,
                // What the player draws. Re-sanitised here: it comes straight from the client.
                waveform: isVoice ? sanitizeWaveform(input.waveform) : undefined,
            })
        );
    }
    return resolved;
}

/** An upload we refuse is removed from Cloudinary too (only when Cloudinary itself confirmed it exists). */
async function discard(asset: RemoteAsset | null | undefined, input: SendAttachmentInput) {
    if (asset) await destroyUploadedAssets([{ publicId: input.publicId, resourceType: input.resourceType }]);
}

/** Canonical delivery URL, used only when Cloudinary couldn't be asked for its own. */
function deliveryUrl(cloudName: string, input: SendAttachmentInput, extension: string): string {
    const suffix = input.resourceType === "raw" || !extension ? "" : `.${extension}`;
    return `https://res.cloudinary.com/${cloudName}/${input.resourceType}/upload/v${input.version}/${input.publicId}${suffix}`;
}

/* -------------------------------------------------------------------------------------------------
 * 3. Clean-up
 * ---------------------------------------------------------------------------------------------- */

/**
 * Deletes files from Cloudinary (and purges the CDN copies). Best effort: it never throws, because
 * a failed clean-up must not fail the request that triggered it. Only files under our own chat
 * folder can be touched.
 */
export async function destroyUploadedAssets(
    assets: ReadonlyArray<{ publicId: string; resourceType: CloudinaryResourceType }>
): Promise<void> {
    const ours = assets.filter(({ publicId }) => publicId.startsWith(`${CHAT_UPLOAD_ROOT}/`));
    if (ours.length === 0) return;

    let sdk: typeof cloudinary;
    try {
        sdk = getCloudinary().sdk;
    } catch {
        return;
    }

    await Promise.all(
        ours.map(async ({ publicId, resourceType }) => {
            try {
                await sdk.uploader.destroy(publicId, { resource_type: resourceType, type: "upload", invalidate: true });
            } catch (error) {
                console.error(`[chat attachments] Couldn't delete ${publicId} from Cloudinary:`, error);
            }
        })
    );
}
