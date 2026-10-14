"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { CHAT_LOAD_ERROR_TOAST_ID } from "../lib/constants";
import type { MessageKey, RevealResult } from "../lib/messageStore";
import type { MessageType } from "../types";

/** Closer than this to the end of the conversation counts as "at the bottom": new messages keep it there. */
const NEAR_BOTTOM_PX = 96;
/** Farther than this from the bottom, the way back to the latest messages is offered. */
const FAR_FROM_BOTTOM_PX = 420;
/** After a jump, the message is kept in place this long while images and fonts finish loading around it. */
const ALIGN_LOCK_MS = 1600;
const FLASH_MS = 2600;
/** A jump that has produced no message on screen after this long is given up (it can't happen, but it must not hang). */
const PENDING_TIMEOUT_MS = 5000;
/** The "finding message" indicator only appears when a jump takes longer than this, so quick ones don't flicker. */
const SLOW_JUMP_MS = 160;

interface Params {
    chatId: string | null;
    messages: readonly MessageType[];
    loading: boolean;
    detached: boolean;
    latest: MessageType | null;
    hasOlder: boolean;
    hasNewer: boolean;
    loadingOlder: boolean;
    loadingNewer: boolean;
    loadOlder: () => Promise<boolean>;
    loadNewer: () => Promise<boolean>;
    reveal: (target: MessageKey) => Promise<RevealResult>;
    returnToLatest: () => void;
}

const prefersReducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Everything about where the conversation is scrolled to:
 *
 *  - it opens at the newest message and follows new ones while the reader is at the bottom (also when images
 *    load, or the composer grows, and the bottom moves);
 *  - older messages loaded above never move what the reader is looking at;
 *  - the top and the bottom of the list load more by themselves when they come near;
 *  - `jumpTo` brings ANY message on screen (loading it first when needed), scrolls to it, keeps it in place
 *    while the content around it settles, and flashes it.
 */
export function useChatScroll({
    chatId,
    messages,
    loading,
    detached,
    latest,
    hasOlder,
    hasNewer,
    loadingOlder,
    loadingNewer,
    loadOlder,
    loadNewer,
    reveal,
    returnToLatest,
}: Params) {
    const scrollerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const topSentinelRef = useRef<HTMLDivElement>(null);
    const bottomSentinelRef = useRef<HTMLDivElement>(null);

    // Mutable bookkeeping that never drives rendering: only read and written from effects, observers and handlers.
    const memoryRef = useRef({
        initialised: false,
        /** The reader is at the bottom, so whatever grows the content keeps the view there. */
        stick: true,
        /** scrollHeight - scrollTop as of the last commit or scroll: what to restore after content is added above. */
        fromBottom: 0,
        firstId: null as string | null,
        latestId: null as string | null,
        lock: null as { id: string; until: number } | null,
        jumpKey: 0,
        wantBottom: false,
    });

    // The newest values for code that outlives a render (observers, timers, promises). Declared before every other
    // effect, so it is up to date when they run.
    const live = useRef({ detached, reveal, returnToLatest, loadOlder, loadNewer });
    useLayoutEffect(() => {
        live.current = { detached, reveal, returnToLatest, loadOlder, loadNewer };
    });

    const [jumping, setJumping] = useState(false);
    const [pending, setPending] = useState<{ id: string; key: number; smooth: boolean } | null>(null);
    const [flash, setFlash] = useState<{ id: string; key: number } | null>(null);
    const [farFromBottom, setFarFromBottom] = useState(false);

    const findRow = useCallback((id: string): HTMLElement | null => {
        return contentRef.current?.querySelector<HTMLElement>(`[data-message-id="${CSS.escape(id)}"]`) ?? null;
    }, []);

    /** Puts the row in the middle of the screen (a row taller than the screen starts a little below the top). */
    const alignRow = useCallback((row: HTMLElement, behavior: ScrollBehavior) => {
        const scroller = scrollerRef.current;
        if (!scroller) return;
        const rowBox = row.getBoundingClientRect();
        const scrollerBox = scroller.getBoundingClientRect();
        const rowTop = scroller.scrollTop + (rowBox.top - scrollerBox.top);
        const free = scroller.clientHeight - rowBox.height;
        const top = free >= 0 ? rowTop - free / 2 : rowTop - 56;
        scroller.scrollTo({ top: Math.max(0, top), behavior });
    }, []);

    /* ------------------------------------------ a different conversation ------------------------------------------ */

    useLayoutEffect(() => {
        const memory = memoryRef.current;
        memory.initialised = false;
        memory.stick = true;
        memory.firstId = null;
        memory.latestId = null;
        memory.lock = null;
        memory.wantBottom = false;
        memory.jumpKey += 1;
        setJumping(false);
        setPending(null);
        setFlash(null);
        setFarFromBottom(false);
    }, [chatId]);

    /* ------------------------------------------------ every commit ------------------------------------------------ */

    useLayoutEffect(() => {
        const scroller = scrollerRef.current;
        if (!scroller) return;
        const memory = memoryRef.current;
        const remember = () => {
            memory.fromBottom = scroller.scrollHeight - scroller.scrollTop;
        };

        // 1. Opening: start at the newest message.
        if (!memory.initialised) {
            if (loading) return;
            memory.initialised = true;
            memory.stick = true;
            memory.firstId = messages[0]?.id ?? null;
            memory.latestId = latest?.id ?? null;
            scroller.scrollTop = scroller.scrollHeight;
            remember();
            return;
        }

        // 2. Back to the live end after a window: start at the newest message again.
        if (memory.wantBottom && !detached) {
            memory.wantBottom = false;
            memory.stick = true;
            memory.firstId = messages[0]?.id ?? null;
            memory.latestId = latest?.id ?? null;
            scroller.scrollTop = scroller.scrollHeight;
            remember();
            return;
        }

        // 3. Older messages were added above: what the reader was looking at must not move. An absolute position,
        //    so it also holds in browsers that adjust the scroll position by themselves.
        const firstId = messages[0]?.id ?? null;
        if (firstId !== memory.firstId && memory.firstId !== null && messages.some((message) => message.id === memory.firstId)) {
            scroller.scrollTop = scroller.scrollHeight - memory.fromBottom;
        }
        memory.firstId = firstId;

        // 4. A new message at the live end: follow it when the reader is at the bottom, or when it is their own.
        const latestId = latest?.id ?? null;
        if (latestId !== memory.latestId) {
            const hadOne = memory.latestId !== null;
            memory.latestId = latestId;
            if (hadOne && latest) {
                if (latest.isMe && live.current.detached) {
                    // Sending from inside a window of the past: show the conversation as it is now.
                    memory.wantBottom = true;
                    live.current.returnToLatest();
                } else if (latest.isMe || (memory.stick && !live.current.detached)) {
                    memory.stick = true;
                    scroller.scrollTop = scroller.scrollHeight;
                }
            }
        }

        remember();
    }, [messages, loading, detached, latest]);

    /* --------------------------------------- scrolling, resizing, interrupting --------------------------------------- */

    useEffect(() => {
        const scroller = scrollerRef.current;
        const content = contentRef.current;
        if (!scroller || !content) return;
        const memory = memoryRef.current;

        const onScroll = () => {
            memory.fromBottom = scroller.scrollHeight - scroller.scrollTop;
            const distance = memory.fromBottom - scroller.clientHeight;
            memory.stick = distance < NEAR_BOTTOM_PX;
            const far = distance > FAR_FROM_BOTTOM_PX;
            setFarFromBottom((was) => (was === far ? was : far));
        };

        // Whatever changes the size of the content (an image loads, a message is edited) or of the window (the
        // composer grows): keep the bottom in view if that is where the reader is, keep a jumped-to message in place.
        const observer = new ResizeObserver(() => {
            const lock = memory.lock;
            if (lock) {
                if (performance.now() > lock.until) {
                    memory.lock = null;
                } else {
                    const row = findRow(lock.id);
                    if (row) {
                        alignRow(row, "auto");
                        return;
                    }
                }
            }
            if (memory.stick && !live.current.detached) scroller.scrollTop = scroller.scrollHeight;
            memory.fromBottom = scroller.scrollHeight - scroller.scrollTop;
        });
        observer.observe(content);
        observer.observe(scroller);

        // The reader taking over ends any alignment still going on.
        const release = () => {
            memory.lock = null;
        };
        const onKey = (event: KeyboardEvent) => {
            if (["PageUp", "PageDown", "Home", "End", "ArrowUp", "ArrowDown", " "].includes(event.key)) release();
        };
        scroller.addEventListener("scroll", onScroll, { passive: true });
        scroller.addEventListener("wheel", release, { passive: true });
        scroller.addEventListener("touchstart", release, { passive: true });
        scroller.addEventListener("pointerdown", release, { passive: true });
        document.addEventListener("keydown", onKey);

        return () => {
            observer.disconnect();
            scroller.removeEventListener("scroll", onScroll);
            scroller.removeEventListener("wheel", release);
            scroller.removeEventListener("touchstart", release);
            scroller.removeEventListener("pointerdown", release);
            document.removeEventListener("keydown", onKey);
        };
    }, [alignRow, findRow]);

    /* ------------------------------------------- loading by scrolling ------------------------------------------- */

    // The sentinels sit at the two ends of the list. One that is (or comes) within reach asks for the next page;
    // observing again after every page makes it ask again if that page was not enough to push it out of reach.
    useEffect(() => {
        const root = scrollerRef.current;
        const target = topSentinelRef.current;
        if (!root || !target || loading || !hasOlder || loadingOlder) return;
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries.some((entry) => entry.isIntersecting)) void live.current.loadOlder();
            },
            { root, rootMargin: "360px 0px 0px 0px" }
        );
        observer.observe(target);
        return () => observer.disconnect();
    }, [loading, hasOlder, loadingOlder, messages.length]);

    useEffect(() => {
        const root = scrollerRef.current;
        const target = bottomSentinelRef.current;
        if (!root || !target || loading || !detached || !hasNewer || loadingNewer) return;
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries.some((entry) => entry.isIntersecting)) void live.current.loadNewer();
            },
            { root, rootMargin: "0px 0px 360px 0px" }
        );
        observer.observe(target);
        return () => observer.disconnect();
    }, [loading, detached, hasNewer, loadingNewer, messages.length]);

    /* ------------------------------------------------- jumping ------------------------------------------------- */

    const jumpTo = useCallback(
        async (target: MessageKey) => {
            const memory = memoryRef.current;
            const key = ++memory.jumpKey;
            setFlash(null); // so the flash starts over even when it is the same message again
            const slow = window.setTimeout(() => {
                if (key === memory.jumpKey) setJumping(true);
            }, SLOW_JUMP_MS);

            const alreadyOnScreen = findRow(target.id) !== null;
            const result = await live.current.reveal(target);
            window.clearTimeout(slow);
            if (key !== memory.jumpKey) return; // a newer jump took over
            setJumping(false);

            if (result === "ready") {
                setPending({ id: target.id, key, smooth: alreadyOnScreen });
            } else if (result === "missing") {
                toast("That message is no longer available.", { id: CHAT_LOAD_ERROR_TOAST_ID });
            } else if (result === "failed") {
                toast.error("Couldn't open that message. Please try again.", { id: CHAT_LOAD_ERROR_TOAST_ID });
            }
        },
        [findRow]
    );

    // The message is part of the list: scroll to it and flash it. Runs again when the list changes, which covers
    // the case where the list reaches the screen a moment after the request does.
    useLayoutEffect(() => {
        if (!pending) return;
        const scroller = scrollerRef.current;
        const row = findRow(pending.id);
        if (!scroller || !row) return;
        const memory = memoryRef.current;

        const rowBox = row.getBoundingClientRect();
        const scrollerBox = scroller.getBoundingClientRect();
        const distance = Math.abs(rowBox.top - (scrollerBox.top + scroller.clientHeight / 2));
        const smooth = pending.smooth && distance < scroller.clientHeight * 1.5 && !prefersReducedMotion();

        memory.stick = false;
        memory.lock = smooth ? null : { id: pending.id, until: performance.now() + ALIGN_LOCK_MS };
        alignRow(row, smooth ? "smooth" : "auto");

        setFlash({ id: pending.id, key: pending.key });
        setPending(null);
    }, [pending, messages, findRow, alignRow]);

    useEffect(() => {
        if (!pending) return;
        const timer = window.setTimeout(() => {
            setPending(null);
            toast.error("Couldn't open that message. Please try again.", { id: CHAT_LOAD_ERROR_TOAST_ID });
        }, PENDING_TIMEOUT_MS);
        return () => window.clearTimeout(timer);
    }, [pending]);

    useEffect(() => {
        if (!flash) return;
        const timer = window.setTimeout(() => setFlash(null), FLASH_MS);
        return () => window.clearTimeout(timer);
    }, [flash]);

    /* ------------------------------------------------ way back down ------------------------------------------------ */

    const goToLatest = useCallback(() => {
        const memory = memoryRef.current;
        memory.jumpKey += 1;
        memory.lock = null;
        setJumping(false);
        setPending(null);
        setFlash(null);

        if (live.current.detached) {
            memory.wantBottom = true;
            live.current.returnToLatest();
            return;
        }
        memory.stick = true;
        const scroller = scrollerRef.current;
        scroller?.scrollTo({ top: scroller.scrollHeight, behavior: prefersReducedMotion() ? "auto" : "smooth" });
    }, []);

    return {
        scrollerRef,
        contentRef,
        topSentinelRef,
        bottomSentinelRef,
        jumpTo,
        goToLatest,
        jumping,
        flashId: flash?.id ?? null,
        showLatest: detached || farFromBottom,
    };
}
