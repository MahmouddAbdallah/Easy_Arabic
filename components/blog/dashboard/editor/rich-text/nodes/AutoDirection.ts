import { Extension } from "@tiptap/core";
import { textDirection } from "@/components/blog/lib/direction";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

/** Blocks whose text direction should follow their own content. */
const DIRECTIONAL_BLOCKS = new Set(["paragraph", "heading", "blockquote", "bulletList", "orderedList", "listItem", "callout"]);

function decorate(doc: ProseMirrorNode): DecorationSet {
    const decorations: Decoration[] = [];
    doc.descendants((node, position) => {
        if (!DIRECTIONAL_BLOCKS.has(node.type.name)) return;
        // A list reads in the direction of its first item, like the public page.
        const source = node.type.name === "bulletList" || node.type.name === "orderedList" ? node.firstChild : node;
        const dir = source ? textDirection(source.textContent) : null;
        if (dir) decorations.push(Decoration.node(position, position + node.nodeSize, { dir }));
    });
    return DecorationSet.create(doc, decorations);
}

/**
 * Sets an explicit `dir` on every text block *in the editor's DOM only*, so an Arabic paragraph is laid
 * out right-to-left while the English one next to it stays left-to-right (as on the public page; both
 * use `textDirection`). Done with decorations, not an attribute, so it never appears in the saved
 * content. See lib/direction.ts for why this isn't left to `dir="auto"`.
 */
export const AutoDirection = Extension.create({
    name: "autoDirection",

    addProseMirrorPlugins() {
        return [
            new Plugin<DecorationSet>({
                key: new PluginKey("autoDirection"),
                state: {
                    init: (_config, state) => decorate(state.doc),
                    apply: (transaction, previous) => (transaction.docChanged ? decorate(transaction.doc) : previous),
                },
                props: {
                    decorations(state) {
                        return this.getState(state);
                    },
                },
            }),
        ];
    },
});
