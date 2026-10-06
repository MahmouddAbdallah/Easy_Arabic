import { highlightCode, isKnownLanguage, languageLabel } from "../lib/highlight";
import { CopyCodeButton } from "./CopyCodeButton";

/** A code block as visitors see it: label, copy button, and server-side highlighted code. */
export function CodeBlock({ code, language }: { code: string; language?: string | null }) {
    const known = isKnownLanguage(language) ? language : null;

    return (
        // Code reads left to right whatever language the post is written in.
        <div className="blog-code" dir="ltr">
            <div className="blog-code-bar">
                <span className="blog-code-lang">{languageLabel(known)}</span>
                <CopyCodeButton code={code} />
            </div>
            {/* tabIndex lets keyboard users scroll long lines. */}
            <pre tabIndex={0}>
                <code className={known ? `hljs language-${known}` : "hljs"}>{highlightCode(code, known)}</code>
            </pre>
        </div>
    );
}
