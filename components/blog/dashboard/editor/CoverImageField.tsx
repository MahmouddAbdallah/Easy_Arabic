"use client";

import { useRef, type ChangeEvent } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BLOG_LIMITS, MEDIA_RULES } from "@/components/blog/lib/constants";
import type { BlogImage } from "@/components/blog/lib/types";
import { cloudinaryImageVariant } from "@/components/blog/lib/url";
import { useMediaUpload } from "../hooks/useMediaUpload";

interface CoverImageFieldProps {
    blogId: string;
    value: BlogImage | null;
    onChange: (value: BlogImage | null) => void;
    error?: string;
}

/** The post's cover: shown on cards, at the top of the article, and as the social-sharing image. */
export function CoverImageField({ blogId, value, onChange, error }: CoverImageFieldProps) {
    const { upload, isUploading, progress } = useMediaUpload(blogId);
    const input = useRef<HTMLInputElement>(null);

    const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;

        const media = await upload(file, "image");
        if (!media) return;
        // Replacing keeps the description the author already wrote.
        onChange({ url: media.url, alt: value?.alt ?? "", publicId: media.publicId, width: media.width, height: media.height });
    };

    return (
        <div className="grid gap-3">
            {value ? (
                <div className="group relative aspect-video overflow-hidden rounded-lg border border-border bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={cloudinaryImageVariant(value.url, 640)} alt={value.alt} className="size-full object-cover" />
                    {isUploading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-background/70 text-sm">
                            <Loader2 className="me-2 size-4 animate-spin" aria-hidden />
                            Uploading{progress !== null ? ` ${progress}%` : "…"}
                        </div>
                    )}
                </div>
            ) : (
                <button
                    type="button"
                    onClick={() => input.current?.click()}
                    disabled={isUploading}
                    className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 text-sm text-muted-foreground transition-colors hover:border-brand/50 hover:bg-brand-soft/50 hover:text-foreground focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:outline-none disabled:opacity-60"
                >
                    {isUploading ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <ImagePlus className="size-5" aria-hidden />}
                    {isUploading ? `Uploading${progress !== null ? ` ${progress}%` : "…"}` : "Add a cover image"}
                    <span className="text-xs">16:9 works best</span>
                </button>
            )}

            {value && (
                <>
                    <div className="grid gap-1.5">
                        <Label htmlFor="blog-cover-alt">Image description</Label>
                        <Input
                            id="blog-cover-alt"
                            value={value.alt}
                            maxLength={BLOG_LIMITS.alt}
                            onChange={(event) => onChange({ ...value, alt: event.target.value })}
                            placeholder="Describe the picture for screen readers"
                        />
                    </div>
                    <div className="flex gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => input.current?.click()} disabled={isUploading}>
                            Replace
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)} disabled={isUploading}>
                            <Trash2 aria-hidden />
                            Remove
                        </Button>
                    </div>
                </>
            )}

            {error && (
                <p role="alert" className="text-xs text-destructive">
                    {error}
                </p>
            )}
            <input ref={input} type="file" accept={MEDIA_RULES.image.mimeTypes.join(",")} hidden onChange={handleFile} />
        </div>
    );
}
