import { Node, mergeAttributes } from "@tiptap/core";
import { CALLOUT_VARIANTS } from "@/components/blog/lib/types";

/**
 * A highlighted box around other blocks: note, tip, warning, or "recommended".
 * Stored as `{ type: "callout", attrs: { variant } }` with block children, and drawn with the same
 * `.blog-callout` rule the public page uses.
 */
export const Callout = Node.create({
    name: "callout",
    group: "block",
    content: "block+",
    defining: true,

    addAttributes() {
        return {
            variant: {
                default: "info",
                parseHTML: (element: HTMLElement) => {
                    const value = element.getAttribute("data-variant") ?? "";
                    return (CALLOUT_VARIANTS as readonly string[]).includes(value) ? value : "info";
                },
                renderHTML: (attributes: Record<string, unknown>) => ({ "data-variant": attributes.variant }),
            },
        };
    },

    parseHTML() {
        return [{ tag: 'div[data-type="callout"]' }];
    },

    renderHTML({ HTMLAttributes }) {
        return ["div", mergeAttributes(HTMLAttributes, { "data-type": "callout", class: "blog-callout" }), 0];
    },
});
