"use client";

import { useCallback, useState } from "react";
import toast from "react-hot-toast";
import type { BlogMediaKind } from "@/components/blog/lib/constants";
import type { BlogUploadedMedia } from "@/components/blog/lib/types";
import { checkMediaFile, toApiFailure, uploadBlogMedia } from "../lib/blogApi";

/**
 * Uploads a file into the open post's media folder. Resolves to the stored file, or `null` after
 * showing the reason in a toast, so callers only handle the success path.
 */
export function useMediaUpload(blogId: string) {
    const [pending, setPending] = useState(0);
    const [progress, setProgress] = useState<number | null>(null);

    const upload = useCallback(
        async (file: File, kind: BlogMediaKind): Promise<BlogUploadedMedia | null> => {
            const problem = checkMediaFile(file, kind);
            if (problem) {
                toast.error(problem);
                return null;
            }

            setPending((count) => count + 1);
            setProgress(0);
            try {
                return await uploadBlogMedia(blogId, file, kind, setProgress);
            } catch (error) {
                toast.error(toApiFailure(error).message);
                return null;
            } finally {
                setPending((count) => count - 1);
                setProgress(null);
            }
        },
        [blogId]
    );

    return { upload, isUploading: pending > 0, progress };
}
