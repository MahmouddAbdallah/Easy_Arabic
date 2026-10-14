import { chatFont } from "./chatFont";

/**
 * The chat's visual identity, kept inside the chat: every colour, shadow and animation below is a `--chat-*`
 * variable defined on `.chat-theme`, so nothing here leaks into the rest of the application and nothing of the
 * application's palette leaks in. Surfaces that are rendered in a portal (sheets, dialogs, menus) carry the
 * same class and therefore look the same.
 *
 * The identity: a deep iris for what you say, quiet slate-tinted neutrals for everything else, and amber for
 * the one thing that must be found at a glance (the message a search result points at).
 */
export const CHAT_ROOT_CLASS = `chat-theme ${chatFont.variable}`;

export const CHAT_THEME_CSS = `
.chat-theme {
    --chat-canvas: #eceef7;
    --chat-canvas-edge: #e3e6f3;
    --chat-surface: #ffffff;
    --chat-surface-2: #f4f5fb;
    --chat-surface-3: #eaecf6;
    --chat-ink: #14172b;
    --chat-ink-2: #4f5572;
    --chat-ink-3: #7b829f;
    --chat-line: #e2e5f1;
    --chat-line-strong: #d0d5e8;

    --chat-accent: #5b4fe5;
    --chat-accent-hover: #4b3fd2;
    --chat-accent-ink: #ffffff;
    --chat-accent-text: #4a3ed1;
    --chat-accent-soft: #edebfd;
    --chat-accent-ring: rgba(91, 79, 229, 0.38);

    --chat-out: #5b4fe5;
    --chat-out-edge: #4f43d9;
    --chat-out-ink: #ffffff;
    --chat-out-meta: rgba(255, 255, 255, 0.76);
    --chat-out-soft: rgba(255, 255, 255, 0.18);
    --chat-in: #ffffff;
    --chat-in-ink: #14172b;
    --chat-in-meta: #7b829f;
    --chat-in-edge: #e2e5f1;

    --chat-online: #1fbf75;
    --chat-read: #a6f6d8;
    --chat-danger: #e0383e;
    --chat-danger-soft: #fdecee;

    --chat-mark: #ffd84d;
    --chat-mark-ink: #2b2300;
    --chat-flash: rgba(255, 190, 0, 0.30);

    --chat-shadow-sm: 0 1px 2px rgba(20, 23, 43, 0.07);
    --chat-shadow-md: 0 1px 3px rgba(20, 23, 43, 0.06), 0 8px 24px rgba(20, 23, 43, 0.09);
    --chat-shadow-lg: 0 2px 8px rgba(20, 23, 43, 0.10), 0 16px 40px rgba(20, 23, 43, 0.18);

    /* The same names the shared UI components use, pointed at the chat's palette inside the chat only. */
    --background: var(--chat-surface);
    --foreground: var(--chat-ink);
    --card: var(--chat-surface);
    --card-foreground: var(--chat-ink);
    --popover: var(--chat-surface);
    --popover-foreground: var(--chat-ink);
    --primary: var(--chat-accent);
    --primary-foreground: var(--chat-accent-ink);
    --secondary: var(--chat-surface-2);
    --secondary-foreground: var(--chat-ink);
    --muted: var(--chat-surface-2);
    --muted-foreground: var(--chat-ink-2);
    --accent: var(--chat-surface-3);
    --accent-foreground: var(--chat-ink);
    --destructive: var(--chat-danger);
    --border: var(--chat-line);
    --input: var(--chat-line-strong);
    --ring: var(--chat-accent);

    color: var(--chat-ink);
    font-family: var(--chat-font-face), "Segoe UI Variable Text", "Segoe UI", system-ui, -apple-system, "Noto Sans Arabic", "Helvetica Neue", Arial, sans-serif;
    font-synthesis-weight: none;
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
}

.dark .chat-theme {
    --chat-canvas: #0c0e1c;
    --chat-canvas-edge: #0a0c18;
    --chat-surface: #14172b;
    --chat-surface-2: #1b1f3a;
    --chat-surface-3: #242949;
    --chat-ink: #eceefa;
    --chat-ink-2: #aab0cd;
    --chat-ink-3: #7880a6;
    --chat-line: rgba(255, 255, 255, 0.08);
    --chat-line-strong: rgba(255, 255, 255, 0.15);

    --chat-accent: #6a5df2;
    --chat-accent-hover: #7c70f6;
    --chat-accent-ink: #ffffff;
    --chat-accent-text: #a79fff;
    --chat-accent-soft: rgba(138, 126, 255, 0.16);
    --chat-accent-ring: rgba(138, 126, 255, 0.5);

    --chat-out: #5b4fe5;
    --chat-out-edge: #6a5df2;
    --chat-in: #1e2242;
    --chat-in-ink: #eceefa;
    --chat-in-meta: #8a92b8;
    --chat-in-edge: rgba(255, 255, 255, 0.06);

    --chat-online: #34d38a;
    --chat-danger: #ff6b70;
    --chat-danger-soft: rgba(255, 107, 112, 0.14);

    --chat-flash: rgba(255, 196, 0, 0.22);

    --chat-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.4);
    --chat-shadow-md: 0 1px 3px rgba(0, 0, 0, 0.4), 0 8px 24px rgba(0, 0, 0, 0.45);
    --chat-shadow-lg: 0 2px 8px rgba(0, 0, 0, 0.5), 0 16px 40px rgba(0, 0, 0, 0.6);
}

.chat-theme ::selection {
    background: color-mix(in srgb, var(--chat-accent) 32%, transparent);
}

/* Scrollers: thin, quiet, and they never pass the scroll on to the page behind. */
.chat-scroll {
    overscroll-behavior: contain;
    scrollbar-width: thin;
    scrollbar-color: color-mix(in srgb, var(--chat-ink) 24%, transparent) transparent;
}
.chat-scroll::-webkit-scrollbar { width: 8px; height: 8px; }
.chat-scroll::-webkit-scrollbar-track { background: transparent; }
.chat-scroll::-webkit-scrollbar-thumb {
    background: color-mix(in srgb, var(--chat-ink) 20%, transparent);
    border-radius: 999px;
    border: 2px solid transparent;
    background-clip: content-box;
}
.chat-scroll::-webkit-scrollbar-thumb:hover { background-color: color-mix(in srgb, var(--chat-ink) 34%, transparent); background-clip: content-box; }

/* The message a search result points at: a band across its whole row fades out, its bubble gives a small pulse and
   wears a ring that fades with the band. The band is the row's own background plus a shadow clipped to the row's
   height, so it reaches both sides of the list without making it scroll sideways. */
@keyframes chat-row-flash {
    0%, 40% { background-color: var(--chat-flash); box-shadow: 0 0 0 100vmax var(--chat-flash); }
    100% { background-color: transparent; box-shadow: 0 0 0 100vmax transparent; }
}
@keyframes chat-bubble-pulse {
    0% { transform: scale(1); }
    14% { transform: scale(1.03); }
    34% { transform: scale(1); }
}
@keyframes chat-ring {
    0%, 55% { outline-color: var(--chat-mark); }
    100% { outline-color: transparent; }
}
.chat-flash-row { animation: chat-row-flash 2.6s ease-out both; clip-path: inset(-5px -100vmax); }
.chat-flash-bubble {
    outline: 2px solid transparent;
    outline-offset: 2px;
    animation: chat-bubble-pulse 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) both, chat-ring 2.6s ease-out both;
}

@keyframes chat-dot {
    0%, 60%, 100% { transform: translateY(0); opacity: 0.45; }
    30% { transform: translateY(-3px); opacity: 1; }
}
@keyframes chat-shimmer {
    0% { background-position: 100% 50%; }
    100% { background-position: 0 50%; }
}
.chat-skeleton {
    background: linear-gradient(90deg, var(--chat-surface-3) 25%, var(--chat-surface-2) 37%, var(--chat-surface-3) 63%);
    background-size: 400% 100%;
    animation: chat-shimmer 1.5s ease infinite;
}
/* Placeholder bubbles on the conversation canvas: they take the colour of the bubbles they stand in for. */
.chat-skeleton-in {
    background: linear-gradient(90deg, var(--chat-in) 25%, color-mix(in srgb, var(--chat-in) 45%, var(--chat-canvas)) 37%, var(--chat-in) 63%);
    background-size: 400% 100%;
    animation: chat-shimmer 1.5s ease infinite;
    border: 1px solid var(--chat-in-edge);
}
.chat-skeleton-out {
    background: linear-gradient(90deg, color-mix(in srgb, var(--chat-accent) 26%, var(--chat-canvas)) 25%, color-mix(in srgb, var(--chat-accent) 14%, var(--chat-canvas)) 37%, color-mix(in srgb, var(--chat-accent) 26%, var(--chat-canvas)) 63%);
    background-size: 400% 100%;
    animation: chat-shimmer 1.5s ease infinite;
}
@keyframes chat-rise {
    from { opacity: 0; transform: translateY(6px) scale(0.98); }
    to { opacity: 1; transform: none; }
}
.chat-rise { animation: chat-rise 0.16s ease-out both; }

@media (prefers-reduced-motion: reduce) {
    .chat-flash-bubble { animation: chat-ring 2.6s ease-out both; }
    .chat-skeleton, .chat-skeleton-in, .chat-skeleton-out { animation: none; }
    .chat-rise { animation: none; }
    .chat-flash-row { animation-duration: 2.6s; }
}
`;

/** Shared class names, so the same control looks and behaves the same everywhere in the chat. */
export const ui = {
    focus: "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--chat-accent-ring)",
    /** Round, quiet icon button (header, toolbars). */
    iconButton:
        "inline-flex size-10 shrink-0 items-center justify-center rounded-full text-(--chat-ink-2) outline-none transition-colors hover:bg-(--chat-surface-3) hover:text-(--chat-ink) active:bg-(--chat-line) focus-visible:ring-2 focus-visible:ring-(--chat-accent-ring) disabled:pointer-events-none disabled:opacity-40 aria-pressed:bg-(--chat-accent-soft) aria-pressed:text-(--chat-accent-text) [&_svg]:size-5 [&_svg]:shrink-0",
    /** Capsule text field. */
    field:
        "h-11 w-full rounded-full border border-transparent bg-(--chat-surface-2) px-4 text-[15px] text-(--chat-ink) outline-none transition-[background-color,border-color,box-shadow] placeholder:text-(--chat-ink-3) hover:bg-(--chat-surface-3) focus:border-(--chat-accent-ring) focus:bg-(--chat-surface) focus:shadow-[0_0_0_3px_var(--chat-accent-soft)]",
    primaryButton:
        "inline-flex h-10 items-center justify-center gap-2 rounded-full bg-(--chat-accent) px-5 text-sm font-medium text-(--chat-accent-ink) outline-none transition-colors hover:bg-(--chat-accent-hover) focus-visible:ring-2 focus-visible:ring-(--chat-accent-ring) disabled:pointer-events-none disabled:opacity-50",
    ghostButton:
        "inline-flex h-10 items-center justify-center gap-2 rounded-full px-4 text-sm font-medium text-(--chat-ink) outline-none transition-colors hover:bg-(--chat-surface-3) focus-visible:ring-2 focus-visible:ring-(--chat-accent-ring) disabled:pointer-events-none disabled:opacity-50",
    /** Popovers, menus and dialogs rendered in a portal. */
    layer: `${CHAT_ROOT_CLASS} border border-(--chat-line) bg-(--chat-surface) text-(--chat-ink) shadow-(--chat-shadow-lg)`,
} as const;
