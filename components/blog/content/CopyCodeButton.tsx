"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";

/** The only client-side code on a published post: a "Copy" button for code blocks. */
export function CopyCodeButton({ code }: { code: string }) {
    const [copied, setCopied] = useState(false);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => () => {
        if (timer.current) clearTimeout(timer.current);
    }, []);

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            if (timer.current) clearTimeout(timer.current);
            timer.current = setTimeout(() => setCopied(false), 1800);
        } catch {
            // Clipboard blocked (insecure context, permissions): nothing useful to do.
        }
    };

    return (
        <button type="button" onClick={copy} className="blog-code-copy" aria-label={copied ? "Copied" : "Copy code"}>
            {copied ? <Check aria-hidden size={14} /> : <Copy aria-hidden size={14} />}
            <span aria-live="polite">{copied ? "Copied" : "Copy"}</span>
        </button>
    );
}
