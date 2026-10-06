import { Node, mergeAttributes } from "@tiptap/core";
import type { DOMOutputSpec } from "@tiptap/pm/model";

/** An uploaded video file (Cloudinary). For YouTube / Vimeo links see `Embed`. */
export const Video = Node.create({
    name: "video",
    group: "block",
    atom: true,
    draggable: true,

    addAttributes() {
        return {
            src: { default: null },
            poster: { default: null },
            width: { default: null },
            height: { default: null },
            // Shown below the video, so it is rendered by `renderHTML` below rather than as an attribute.
            caption: { default: null, rendered: false },
        };
    },

    parseHTML() {
        return [{ tag: "video[src]" }];
    },

    renderHTML({ node, HTMLAttributes }) {
        const caption = typeof node.attrs.caption === "string" ? node.attrs.caption : "";
        const video: DOMOutputSpec = ["video", mergeAttributes(HTMLAttributes, { controls: "true", preload: "metadata", playsinline: "true" })];
        return caption
            ? ["figure", { class: "blog-figure", "data-type": "video" }, video, ["figcaption", {}, caption]]
            : ["figure", { class: "blog-figure", "data-type": "video" }, video];
    },
});
