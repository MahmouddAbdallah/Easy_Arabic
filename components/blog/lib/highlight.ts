import { createElement, type ReactNode } from "react";
import { common, createLowlight } from "lowlight";

/**
 * Syntax highlighting, shared by the editor (live colours while writing) and the public renderer
 * (server-side, so visitors get coloured code without any highlighting JavaScript).
 */
export const lowlight = createLowlight(common);

/** Offered in the editor. Every value is registered in lowlight's `common` set. */
export const CODE_LANGUAGES: ReadonlyArray<{ value: string; label: string }> = [
    { value: "", label: "Plain text" },
    { value: "javascript", label: "JavaScript" },
    { value: "typescript", label: "TypeScript" },
    { value: "html", label: "HTML" },
    { value: "css", label: "CSS" },
    { value: "json", label: "JSON" },
    { value: "bash", label: "Bash" },
    { value: "python", label: "Python" },
    { value: "sql", label: "SQL" },
    { value: "java", label: "Java" },
    { value: "csharp", label: "C#" },
    { value: "cpp", label: "C++" },
    { value: "c", label: "C" },
    { value: "php", label: "PHP" },
    { value: "go", label: "Go" },
    { value: "rust", label: "Rust" },
    { value: "kotlin", label: "Kotlin" },
    { value: "swift", label: "Swift" },
    { value: "ruby", label: "Ruby" },
    { value: "yaml", label: "YAML" },
    { value: "markdown", label: "Markdown" },
    { value: "diff", label: "Diff" },
];

export const languageLabel = (language: string | null | undefined) =>
    CODE_LANGUAGES.find((entry) => entry.value === (language ?? ""))?.label ?? (language ? language : "Code");

/** The minimal slice of lowlight's (hast) output we walk: text, and elements with a class list. */
interface HastNode {
    type: string;
    value?: string;
    properties?: { className?: string | string[] };
    children?: HastNode[];
}

function toReact(nodes: HastNode[] | undefined): ReactNode[] {
    return (nodes ?? []).map((node, index) => {
        if (node.type === "text") return node.value ?? "";
        if (node.type !== "element") return null;
        const className = Array.isArray(node.properties?.className)
            ? node.properties.className.join(" ")
            : node.properties?.className;
        // Highlighting only ever produces <span>s, so that is all we emit, whatever the tree says.
        return createElement("span", { key: index, className }, ...toReact(node.children));
    });
}

/** Highlighted React nodes for `code`, or the plain text if the language is unknown or highlighting fails. */
export function highlightCode(code: string, language: string | null | undefined): ReactNode {
    if (!language || !lowlight.registered(language)) return code;
    try {
        const tree = lowlight.highlight(language, code) as unknown as HastNode;
        return toReact(tree.children);
    } catch {
        return code;
    }
}

export const isKnownLanguage = (language: string | null | undefined): language is string =>
    !!language && lowlight.registered(language);
