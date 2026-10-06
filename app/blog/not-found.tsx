import Link from "next/link";
import { displayFont } from "@/lib/fonts";
import { BLOG_BASE_PATH } from "@/components/blog/lib/constants";

export default function BlogNotFound() {
    return (
        <div className={`${displayFont.variable} mx-auto flex min-h-[50vh] w-full max-w-xl flex-col items-center justify-center px-5 py-24 text-center`}>
            <p className="font-display text-5xl font-bold tracking-tight text-foreground">That post isn&apos;t here</p>
            <p className="mt-4 text-muted-foreground">It may have been moved, unpublished, or the link may be mistyped.</p>
            <Link href={BLOG_BASE_PATH} className="mt-8 inline-flex h-11 items-center rounded-lg bg-brand px-6 text-sm font-medium text-brand-foreground transition-opacity hover:opacity-90">
                Browse all posts
            </Link>
        </div>
    );
}
