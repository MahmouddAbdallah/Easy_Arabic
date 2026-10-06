import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import Highlight from "@tiptap/extension-highlight";
import { Placeholder } from "@tiptap/extensions";
import StarterKit from "@tiptap/starter-kit";
import { lowlight } from "@/components/blog/lib/highlight";
import { AutoDirection } from "./nodes/AutoDirection";
import { BlogImage } from "./nodes/BlogImage";
import { Callout } from "./nodes/Callout";
import { Embed } from "./nodes/Embed";
import { Video } from "./nodes/Video";

/**
 * Everything the editor can produce. It must stay in step with the whitelist in
 * components/blog/lib/types.ts (BLOG_NODE_TYPES / BLOG_MARK_TYPES): the server rejects any node or mark
 * outside it, and the public renderer draws exactly those.
 *
 * To add a content type: add the node here, add it to the whitelist and the sanitizer
 * (lib/content.ts), then teach BlogContent how to draw it.
 */
export const BLOG_EDITOR_EXTENSIONS = [
    StarterKit.configure({
        // h1 is the post title; the body uses h2-h4.
        heading: { levels: [2, 3, 4] },
        // Replaced by the syntax-highlighting version below.
        codeBlock: false,
        link: { openOnClick: false, autolink: true, defaultProtocol: "https" },
    }),
    CodeBlockLowlight.configure({ lowlight }),
    Highlight,
    BlogImage.configure({ inline: false, allowBase64: false }),
    Video,
    Embed,
    Callout,
    AutoDirection,
    Placeholder.configure({ placeholder: "Start writing. Use the toolbar for headings, images, video, code, callouts and more." }),
];
