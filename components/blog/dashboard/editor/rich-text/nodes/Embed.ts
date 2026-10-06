import { Node } from "@tiptap/core";
import type { DOMOutputSpec } from "@tiptap/pm/model";
import { EMBED_PROVIDERS, type EmbedProvider } from "@/components/blog/lib/types";
import { embedLabel, embedThumbnail, isValidVideoId } from "@/components/blog/lib/url";

/**
 * A YouTube or Vimeo video. Only the provider and the video id are stored, never a URL: the public
 * page rebuilds the player address from them, so no arbitrary address can end up in an iframe.
 * In the editor it shows as a thumbnail card instead of a live player (iframes inside editable
 * content are unreliable, and a thumbnail is lighter while writing).
 */
export const Embed = Node.create({
    name: "embed",
    group: "block",
    atom: true,
    draggable: true,

    addAttributes() {
        return {
            provider: {
                default: "youtube",
                rendered: false,
                parseHTML: (element: HTMLElement) => {
                    const value = element.getAttribute("data-provider") ?? "";
                    return (EMBED_PROVIDERS as readonly string[]).includes(value) ? value : "youtube";
                },
            },
            videoId: { default: null, rendered: false, parseHTML: (element: HTMLElement) => element.getAttribute("data-video-id") },
            caption: { default: null, rendered: false },
        };
    },

    parseHTML() {
        return [{ tag: 'figure[data-type="embed"]' }];
    },

    renderHTML({ node }) {
        const provider = (node.attrs.provider as EmbedProvider) ?? "youtube";
        const videoId = typeof node.attrs.videoId === "string" ? node.attrs.videoId : "";
        const thumbnail = isValidVideoId(provider, videoId) ? embedThumbnail(provider, videoId) : null;
        const caption = typeof node.attrs.caption === "string" ? node.attrs.caption : "";
        const figure = { class: "blog-figure", "data-type": "embed", "data-provider": provider, "data-video-id": videoId };

        const card: DOMOutputSpec = thumbnail
            ? ["div", { class: "blog-embed-card" }, ["img", { src: thumbnail, alt: "" }], ["span", {}, embedLabel(provider)]]
            : ["div", { class: "blog-embed-card" }, ["span", {}, embedLabel(provider)]];

        return caption ? ["figure", figure, card, ["figcaption", {}, caption]] : ["figure", figure, card];
    },
});
