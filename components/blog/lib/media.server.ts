/**
 * SERVER ONLY. Blog media uploads and clean-up, built on the project's existing Cloudinary utilities
 * (lib/handleFiles.ts): this file adds the Blog's rules (what may be uploaded, where it goes, what may
 * be deleted) and nothing else.
 */
import { handleDeleteCloudinary, handleDeleteCloudinaryFolder, handleUploadCloudinary } from "@/lib/handleFiles";
import { CLOUDINARY_ROOT_FOLDER, MEDIA_RULES, blogMediaFolder, type BlogMediaKind } from "./constants";
import { BlogApiError } from "./http.server";
import type { BlogUploadedMedia } from "./types";
import { cloudinaryVideoPoster } from "./url";

/** The parts of Cloudinary's upload response the Blog reads. */
interface CloudinaryUpload {
    secure_url?: string;
    public_id?: string;
    resource_type?: string;
    width?: number;
    height?: number;
    bytes?: number;
    format?: string;
}

const megabytes = (bytes: number) => Math.round(bytes / (1024 * 1024));

/** Checks the file against the Blog's rules before anything is uploaded. */
export function validateMediaFile(file: unknown, kind: BlogMediaKind): asserts file is File {
    if (!(file instanceof File) || file.size === 0) {
        throw new BlogApiError("NO_FILE", "Choose a file to upload.", 400);
    }
    const rules = MEDIA_RULES[kind];
    if (!(rules.mimeTypes as readonly string[]).includes(file.type)) {
        throw new BlogApiError(
            "UNSUPPORTED_FILE",
            kind === "image"
                ? "Images must be JPG, PNG, WebP, GIF or AVIF."
                : "Videos must be MP4, WebM or MOV.",
            415
        );
    }
    if (file.size > rules.maxBytes) {
        throw new BlogApiError("FILE_TOO_LARGE", `That file is larger than the ${megabytes(rules.maxBytes)} MB limit for ${kind}s.`, 413);
    }
}

/**
 * Uploads one image or video into the post's own Cloudinary folder through `handleUploadCloudinary`
 * (which also resizes and re-encodes images to WebP). The file's real type is checked against what
 * Cloudinary reports, so a mislabelled file is removed again instead of kept.
 */
export async function uploadBlogMedia(file: unknown, blogId: string, kind: BlogMediaKind): Promise<BlogUploadedMedia> {
    validateMediaFile(file, kind);

    const upload = await handleUploadCloudinary(file, blogMediaFolder(blogId), CLOUDINARY_ROOT_FOLDER);
    if (!upload.success || !upload.result) {
        console.error(`Blog ${blogId}: ${kind} upload failed:`, upload.message);
        throw new BlogApiError("UPLOAD_FAILED", "The file could not be uploaded. Please try again.", 502);
    }

    const result = upload.result as unknown as CloudinaryUpload;
    if (!result.secure_url || !result.public_id) {
        throw new BlogApiError("UPLOAD_FAILED", "The file could not be uploaded. Please try again.", 502);
    }

    if (result.resource_type !== kind) {
        // Declared as one thing, detected as another (e.g. a document labelled video/mp4): don't keep it.
        await handleDeleteCloudinary(result.secure_url, (result.resource_type as "image" | "video" | "raw") ?? "raw");
        throw new BlogApiError("UNSUPPORTED_FILE", `That file isn't a valid ${kind}.`, 415);
    }

    return {
        url: result.secure_url,
        publicId: result.public_id,
        resourceType: kind,
        width: result.width,
        height: result.height,
        bytes: result.bytes,
        format: result.format,
        ...(kind === "video" ? { poster: cloudinaryVideoPoster(result.secure_url) ?? undefined } : {}),
    };
}

/**
 * Deletes every file the post ever uploaded: its whole Cloudinary folder, including files that were
 * later removed from the text or replaced as the cover. Safe by construction: the folder is derived
 * from the post's own id, and the prefix ends with "/" so it cannot reach another post's folder.
 * Best effort: a failure is logged, never thrown, because the post itself is already gone.
 */
export async function deleteBlogMedia(blogId: string): Promise<void> {
    const result = await handleDeleteCloudinaryFolder(blogMediaFolder(blogId), CLOUDINARY_ROOT_FOLDER);
    if (!result.success) console.error(`Blog ${blogId}: could not delete its media folder.`);
}
