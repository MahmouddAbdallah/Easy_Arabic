import { v2 as cloudinary, ResourceApiResponse } from 'cloudinary';
import sharp from "sharp";

cloudinary.config({
    cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * `resourceType` defaults to "image", so every existing caller behaves exactly as before. Cloudinary
 * only finds a video under its own resource type, so callers deleting videos must pass "video".
 */
export async function handleDeleteCloudinary(url: string, resourceType: 'image' | 'video' | 'raw' = 'image') {
    try {
        const decodedUrl = decodeURIComponent(url);

        const publicId = decodedUrl
            ?.split("/upload/")[1]
            ?.replace(/^v\d+\//, "")
            ?.split(".")[0];

        const result = await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });

        return {
            success: true,
            result,
        };
    } catch (error) {
        console.error("Cloudinary delete error:", error);

        return {
            success: false,
            error,
        };
    }
}

export async function handleUploadUrlToCloudinary(url: string, folder?: string) {
    try {
        const result = await cloudinary.uploader.upload(url, {
            folder,
            use_filename: true,
            unique_filename: false,
            overwrite: true,
        });
        return { success: true, url: result.secure_url };
    } catch {
        return { success: false, url: '' }
    }
}

/**
 * `rootFolder` defaults to "ease_arabic" so existing callers behave exactly as before; the Admin
 * passes its own root so ease_arabic assets don't end up inside another project's folder.
 */
export async function handleUploadCloudinary(file: File, folder?: string, rootFolder: string = 'ease_arabic') {
    try {
        if (!(file instanceof File)) {
            return {
                success: false,
                message: "No file uploaded",
                result: undefined,
            }
        }

        // Convert File to Buffer
        const arrayBuffer = await file.arrayBuffer();
        let buffer: Buffer = Buffer.from(arrayBuffer as ArrayBuffer);

        const isImage = file.type.startsWith("image/");
        const maxSize = 10 * 1024 * 1024; // 10MB

        if (isImage) {

            buffer = await sharp(buffer)
                .resize({
                    width: 2000,
                    withoutEnlargement: true
                })
                .webp({ quality: 85 })
                .toBuffer();

            let quality = 80;

            while (buffer.length > maxSize && quality > 30) {
                buffer = await sharp(buffer)
                    .webp({ quality })
                    .toBuffer();

                quality -= 10;
            }
        }
        // Upload to Cloudinary using a stream
        const result = await new Promise((resolve, reject) => {
            cloudinary.uploader.upload_stream({
                folder: folder ? `${rootFolder}/${folder}` : `${rootFolder}/all`,
                resource_type: 'auto',
            }, (error, result) => {
                if (error) reject(error);
                resolve(result);
            }).end(buffer);
        });

        return {
            success: true,
            message: 'Successfully uploading.',
            result: result as Partial<ResourceApiResponse["resources"][0]>
        };
    } catch (error: any) {
        return {
            success: false,
            message: error?.message,
            result: undefined,
        }
    }
}

/**
 * Deletes everything stored under `${rootFolder}/${folder}/` (images and videos), then the folder itself.
 * For features that give each record its own folder, so removing the record removes all of its files,
 * including ones no longer referenced anywhere.
 *
 * The prefix always ends with "/", so "blog/abc" can never also match "blog/abc123".
 */
export async function handleDeleteCloudinaryFolder(folder: string, rootFolder: string = 'ease_arabic') {
    const path = `${rootFolder}/${folder}`.replace(/^\/+|\/+$/g, '');
    if (!folder.replace(/\//g, '').trim()) {
        // Never build a prefix that could match the whole root.
        return { success: false, error: new Error('A folder is required') };
    }

    try {
        for (const resourceType of ['image', 'video'] as const) {
            // Cloudinary deletes up to 1000 files per call and reports `partial` when there are more.
            let partial = true;
            while (partial) {
                const result = await cloudinary.api.delete_resources_by_prefix(`${path}/`, { resource_type: resourceType });
                partial = Boolean(result?.partial);
            }
        }
        // Only removes an empty folder; if that fails the files are already gone, which is what matters.
        await cloudinary.api.delete_folder(path).catch(() => undefined);

        return { success: true };
    } catch (error) {
        console.error("Cloudinary folder delete error:", error);
        return { success: false, error };
    }
}
