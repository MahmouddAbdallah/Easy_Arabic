import Image from "@tiptap/extension-image";

/** The standard image node plus a `caption`, shown under the picture on the public page. */
export const BlogImage = Image.extend({
    addAttributes() {
        return {
            ...this.parent?.(),
            caption: { default: null, rendered: false },
        };
    },
});
