/**
 * The messages of ONE conversation: which ones are loaded, how more are loaded, and how a message far back
 * in the history is brought on screen.
 *
 * Pure logic: no React, no Firebase. The database sits behind `MessageSource` (see messageSource.ts for the
 * Firestore one), which is also what lets the rules below be tested against an in-memory fake.
 *
 * ## The model
 *
 * The conversation is read in ranges that never overlap, each with its own live listener, so an edit,
 * a deletion or a reaction on ANY loaded message reaches both people in real time:
 *
 *  - the TAIL: everything from the newest page's oldest message onwards, with no upper limit. New messages
 *    arrive in it and it never "slides" the way a `limit(n)` window would. It is always listening, even
 *    when it is not what is on screen.
 *  - SEGMENTS: pages of history, each a fixed number of messages, loaded on demand. They are chained
 *    toward the past (`loadOlder`) and, after a jump, toward the present (`loadNewer`).
 *
 * What is on screen is the chain of segments, followed by the tail when the chain reaches it ("attached").
 * After a jump into the distant past the chain does NOT reach the tail: the view is "detached" and shows
 * only the window around the message that was asked for. That is what keeps a jump to a message 20,000
 * messages back as cheap as a jump to one 20 messages back: it never reads, renders or keeps listening to
 * the thousands of messages in between. Scrolling down loads newer pages until the chain meets the tail,
 * and `returnToLatest()` drops the window at once.
 *
 * ## Why loads cannot hang
 *
 * Every read is a promise that settles: it resolves with the server's answer, or rejects (database error,
 * timeout, or cancellation by a newer request). Nothing waits on a flag that "someone else" resets, so a
 * failed or abandoned load can never leave the conversation stuck in a "loading" state.
 */

export interface MessageKey {
    id: string;
    /** ISO time the message was sent: the conversation is ordered by (time, id). */
    time: string;
}

/** A stored message as the store sees it. `handle` is whatever the source needs to continue from exactly this message. */
export interface SourceDoc<H = unknown> extends MessageKey {
    data: Record<string, unknown>;
    handle: H;
}

export type Direction = "older" | "newer";

export interface PageRequest<H> {
    direction: Direction;
    /** Where to start: just after this message (exclusive), or at it (inclusive). null = the very newest message. */
    from: { doc: SourceDoc<H>; inclusive: boolean } | null;
    /** How many messages to return at most. */
    limit: number;
}

export interface Subscription<H> {
    /** The first answer that came from the server, oldest first. Rejects when the query fails. */
    ready: Promise<SourceDoc<H>[]>;
    stop(): void;
}

export interface Listener<H> {
    /** The complete, current answer (oldest first) after the first one. */
    onChange(docs: SourceDoc<H>[]): void;
    /** The listener broke after it had answered. */
    onError(error: unknown): void;
}

export interface MessageSource<H> {
    /** The newest messages, oldest first (one read, no listener). */
    newest(limit: number): Promise<SourceDoc<H>[]>;
    /** One message by id, or null when it doesn't exist or isn't visible to this user. */
    get(id: string): Promise<SourceDoc<H> | null>;
    /** A live page; `onChange` follows every later change of exactly this page. */
    page(request: PageRequest<H>, listener: Listener<H>): Subscription<H>;
    /** Everything from `from` (inclusive) to the end of the conversation, live. From the beginning when null. */
    tail(from: SourceDoc<H> | null, listener: Listener<H>): Subscription<H>;
}

export type LoadErrorCode = "timeout" | "failed" | "missing" | "cancelled";

export class ChatLoadError extends Error {
    constructor(
        readonly code: LoadErrorCode,
        cause?: unknown
    ) {
        super(`Chat load ${code}`, cause === undefined ? undefined : { cause });
        this.name = "ChatLoadError";
    }
}

export type RevealResult = "ready" | "missing" | "failed" | "cancelled";

export interface MessagesSnapshot<M> {
    /** Oldest first, no duplicates. */
    messages: readonly M[];
    /** The first page is on its way. */
    loading: boolean;
    /** The conversation could not be opened; `reload()` tries again. */
    failed: boolean;
    /** Something older than the oldest message on screen exists. */
    hasOlder: boolean;
    /** Something newer than the newest message on screen exists (only ever while `detached`). */
    hasNewer: boolean;
    loadingOlder: boolean;
    loadingNewer: boolean;
    /** A jump to a message is being prepared. */
    revealing: boolean;
    /** The view shows a window of the past, not the live end of the conversation. */
    detached: boolean;
    /** The newest message of the conversation as far as this browser knows, whether it is on screen or not. */
    latest: M | null;
}

export interface MessageStoreOptions<H, M extends { id: string }> {
    source: MessageSource<H>;
    toMessage: (doc: SourceDoc<H>) => M;
    /** Messages per page. */
    pageSize?: number;
    /**
     * A jump to a message that is at most this many messages beyond what is loaded extends the loaded history
     * in one read. Further away, it opens a window around the message instead.
     */
    gapCap?: number;
    /** Messages shown before (the target included) and after the target when a window is opened. */
    windowBefore?: number;
    windowAfter?: number;
    /** How long a read may take before it counts as failed. */
    loadTimeoutMs?: number;
    /** A read failed (never called for a cancelled one). */
    onError?: (error: ChatLoadError) => void;
}

/** Messages are ordered by (time, id), exactly the order the database returns them in. */
export function compareKeys(a: MessageKey, b: MessageKey): number {
    if (a.time !== b.time) return a.time < b.time ? -1 : 1;
    if (a.id !== b.id) return a.id < b.id ? -1 : 1;
    return 0;
}

/** The part of a page that is shown: the extra message every query asks for (the "probe") is cut off. */
function shown<H>(docs: SourceDoc<H>[], direction: Direction, limit: number): SourceDoc<H>[] {
    if (docs.length <= limit) return docs;
    return direction === "older" ? docs.slice(docs.length - limit) : docs.slice(0, limit);
}

/** The probe: the message just beyond the page, when there is one. */
function probeOf<H>(docs: SourceDoc<H>[], direction: Direction, limit: number): SourceDoc<H> | null {
    if (docs.length <= limit) return null;
    return direction === "older" ? docs[0] : docs[docs.length - 1];
}

interface Segment<H, M> {
    direction: Direction;
    /** How many messages it shows; its query asks for one more. */
    limit: number;
    docs: SourceDoc<H>[];
    messages: M[];
    sub: Subscription<H> | null;
    stopped: boolean;
    /** The newest answer that arrived before the segment was put on screen (it replaces the first one). */
    pending: SourceDoc<H>[] | null;
}

type Waiter = (error: ChatLoadError) => void;

export class MessageStore<H, M extends { id: string }> {
    private readonly source: MessageSource<H>;
    private readonly toMessage: (doc: SourceDoc<H>) => M;
    private readonly pageSize: number;
    private readonly gapCap: number;
    private readonly windowBefore: number;
    private readonly windowAfter: number;
    private readonly loadTimeoutMs: number;
    private readonly onError?: (error: ChatLoadError) => void;

    private readonly listeners = new Set<(snapshot: MessagesSnapshot<M>) => void>();
    private snapshot: MessagesSnapshot<M>;
    private disposed = false;
    private started = false;

    // What is on screen: the chain of segments (oldest first), then the tail when `attached`.
    private segments: Segment<H, M>[] = [];
    private oldest: SourceDoc<H> | null = null;
    private newest: SourceDoc<H> | null = null;
    private hasOlder = false;
    private hasNewer = false;
    private attached = true;
    private loading = true;
    private failed = false;

    // The live end of the conversation: always listening.
    private tailStart: SourceDoc<H> | null = null;
    private tailMessages: M[] = [];
    private tailSub: Subscription<H> | null = null;
    /** Whether anything is older than the tail's first message (history older than that never grows). */
    private historyBeforeTail = false;

    private messages: readonly M[] = [];
    private dirty = true;

    // Work in flight. A request that starts after a newer one (a jump, "back to latest") makes the older ones
    // stale: they are cancelled and whatever they still deliver is thrown away.
    private epoch = 0;
    private seq = 0;
    private busy = { older: 0, newer: 0, reveal: 0 };
    private readonly waiters = new Set<Waiter>();

    constructor(options: MessageStoreOptions<H, M>) {
        this.source = options.source;
        this.toMessage = options.toMessage;
        this.pageSize = options.pageSize ?? 15;
        this.gapCap = options.gapCap ?? 60;
        this.windowBefore = options.windowBefore ?? 20;
        this.windowAfter = options.windowAfter ?? 20;
        this.loadTimeoutMs = options.loadTimeoutMs ?? 15_000;
        this.onError = options.onError;
        this.snapshot = this.buildSnapshot();
    }

    /* ---------------------------------------------------------------------------------------------
     * Public API
     * ------------------------------------------------------------------------------------------ */

    getSnapshot(): MessagesSnapshot<M> {
        return this.snapshot;
    }

    /** Calls `listener` now and after every change. Returns the way to stop. */
    subscribe(listener: (snapshot: MessagesSnapshot<M>) => void): () => void {
        this.listeners.add(listener);
        listener(this.snapshot);
        return () => {
            this.listeners.delete(listener);
        };
    }

    /** Reads the newest page and starts following the end of the conversation. */
    async start(): Promise<void> {
        if (this.started || this.disposed) return;
        this.started = true;
        this.loading = true;
        this.failed = false;
        this.emit();

        const epoch = this.epoch;
        try {
            // One extra message tells whether anything is older, without a second read.
            const docs = await this.within(this.source.newest(this.pageSize + 1));
            if (this.disposed || epoch !== this.epoch) return;

            const page = shown(docs, "older", this.pageSize);
            this.historyBeforeTail = docs.length > this.pageSize;
            this.tailStart = page[0] ?? null;
            this.tailMessages = page.map(this.toMessage);
            this.oldest = this.tailStart;
            this.hasOlder = this.historyBeforeTail;
            this.attached = true;
            this.loading = false;
            this.dirty = true;
            this.emit();

            this.followTail();
        } catch (error) {
            if (this.disposed) return;
            this.started = false;
            this.loading = false;
            this.failed = true;
            this.emit();
            this.report(error);
        }
    }

    /** Opens the conversation again after it failed to open. */
    async reload(): Promise<void> {
        if (this.disposed || this.loading) return;
        this.bump();
        this.stopSegments();
        this.tailSub?.stop();
        this.tailSub = null;
        this.segments = [];
        this.tailMessages = [];
        this.tailStart = null;
        this.oldest = null;
        this.newest = null;
        this.hasOlder = this.hasNewer = false;
        this.attached = true;
        this.busy = { older: 0, newer: 0, reveal: 0 };
        this.started = false;
        this.dirty = true;
        await this.start();
    }

    /** The page before the oldest message on screen. Resolves to whether one was added. */
    loadOlder(): Promise<boolean> {
        return this.loadMore("older");
    }

    /** The page after the newest message on screen (only while detached). Resolves to whether one was added. */
    loadNewer(): Promise<boolean> {
        return this.loadMore("newer");
    }

    /**
     * Makes sure the message is on screen, however far back it is. When it is within `gapCap` messages of what is
     * loaded, the history is extended to it; further away a window around it replaces what is on screen.
     * Resolves once the message is part of `messages` (the snapshot has been published by then).
     */
    async reveal(target: MessageKey): Promise<RevealResult> {
        if (this.disposed || this.loading) return "failed";
        if (this.isDisplayed(target.id)) {
            // Asking for something already on screen also withdraws an earlier request that is still being prepared.
            if (this.busy.reveal !== 0) {
                this.bump();
                this.busy = { ...this.busy, reveal: 0 };
                this.emit();
            }
            return "ready";
        }

        this.bump();
        const epoch = this.epoch;
        const token = ++this.seq;
        this.busy = { older: 0, newer: 0, reveal: token };
        this.emit();

        try {
            const relation = this.relation(target);
            if (relation !== "unknown" && (await this.extendTo(target, relation, epoch))) return "ready";
            return await this.openWindow(target, epoch);
        } catch (error) {
            if (error instanceof ChatLoadError && error.code === "cancelled") return "cancelled";
            if (error instanceof ChatLoadError && error.code === "missing") return "missing";
            this.report(error);
            return "failed";
        } finally {
            if (this.busy.reveal === token) {
                this.busy = { ...this.busy, reveal: 0 };
                this.emit();
            }
        }
    }

    /** Back to the live end of the conversation. Instant: nothing is read. */
    returnToLatest(): void {
        if (this.disposed || this.loading || this.failed) return;
        if (this.attached && this.segments.length === 0 && this.busy.reveal === 0) return;

        this.bump();
        this.stopSegments();
        this.segments = [];
        this.oldest = this.tailStart;
        this.newest = null;
        this.hasOlder = this.historyBeforeTail;
        this.hasNewer = false;
        this.attached = true;
        this.busy = { older: 0, newer: 0, reveal: 0 };
        this.dirty = true;
        this.emit();
    }

    dispose(): void {
        if (this.disposed) return;
        this.disposed = true;
        this.bump();
        this.stopSegments();
        this.tailSub?.stop();
        this.tailSub = null;
        this.listeners.clear();
    }

    /* ---------------------------------------------------------------------------------------------
     * Loading more
     * ------------------------------------------------------------------------------------------ */

    private async loadMore(direction: Direction): Promise<boolean> {
        const older = direction === "older";
        const anchor = older ? this.oldest : this.newest;
        const available = older ? this.hasOlder : this.hasNewer && !this.attached;
        const slot = older ? "older" : "newer";
        if (this.disposed || this.loading || !anchor || !available) return false;
        if (this.busy[slot] !== 0 || this.busy.reveal !== 0) return false;

        const token = ++this.seq;
        this.busy = { ...this.busy, [slot]: token };
        this.emit();

        const epoch = this.epoch;
        const segment = this.newSegment(direction, this.pageSize);
        try {
            const docs = await this.fetchSegment(
                segment,
                { direction, from: { doc: anchor, inclusive: false }, limit: segment.limit + 1 },
                epoch
            );
            this.attach(segment, docs);
            return segment.docs.length > 0;
        } catch (error) {
            this.discard(segment);
            this.report(error);
            return false;
        } finally {
            if (this.busy[slot] === token) {
                this.busy = { ...this.busy, [slot]: 0 };
                this.emit();
            }
        }
    }

    /* ---------------------------------------------------------------------------------------------
     * Jumping
     * ------------------------------------------------------------------------------------------ */

    private relation(target: MessageKey): Direction | "unknown" {
        if (this.oldest && compareKeys(target, this.oldest) < 0) return "older";
        if (!this.attached && this.newest && compareKeys(target, this.newest) > 0) return "newer";
        return "unknown";
    }

    /** The target is just beyond the loaded history: one bounded read extends the history up to it. */
    private async extendTo(target: MessageKey, direction: Direction, epoch: number): Promise<boolean> {
        const anchor = direction === "older" ? this.oldest : this.newest;
        if (!anchor) return false;

        const segment = this.newSegment(direction, this.gapCap);
        try {
            const docs = await this.fetchSegment(
                segment,
                { direction, from: { doc: anchor, inclusive: false }, limit: segment.limit + 1 },
                epoch
            );
            if (!shown(docs, direction, segment.limit).some((doc) => doc.id === target.id)) {
                this.discard(segment);
                return false; // further away than the cap: a window is the way
            }
            this.attach(segment, docs);
            return true;
        } catch (error) {
            this.discard(segment);
            throw error;
        }
    }

    /** Replaces what is on screen with the target and the messages around it. */
    private async openWindow(target: MessageKey, epoch: number): Promise<RevealResult> {
        const anchor = await this.within(this.source.get(target.id));
        this.assertCurrent(epoch);
        if (!anchor) throw new ChatLoadError("missing");

        const before = this.newSegment("older", this.windowBefore);
        const after = this.newSegment("newer", this.windowAfter);
        try {
            const [beforeDocs, afterDocs] = await Promise.all([
                // `inclusive`: the target itself is the newest message of the first part.
                this.fetchSegment(
                    before,
                    { direction: "older", from: { doc: anchor, inclusive: true }, limit: before.limit + 1 },
                    epoch
                ),
                this.fetchSegment(
                    after,
                    { direction: "newer", from: { doc: anchor, inclusive: false }, limit: after.limit + 1 },
                    epoch
                ),
            ]);
            this.assertCurrent(epoch);

            const beforeShown = shown(beforeDocs, "older", before.limit);
            if (!beforeShown.some((doc) => doc.id === anchor.id)) throw new ChatLoadError("missing");

            // Out with the old view, in with the window.
            this.stopSegments();
            this.segments = [];
            this.attach(before, beforeDocs, { replacing: true });
            if (shown(afterDocs, "newer", after.limit).length > 0) {
                this.attach(after, afterDocs, { replacing: true });
            } else {
                this.discard(after);
                this.newest = anchor;
                this.attached = true;
                this.hasNewer = false;
            }
            this.dirty = true;
            return "ready";
        } catch (error) {
            this.discard(before);
            this.discard(after);
            throw error;
        }
    }

    /* ---------------------------------------------------------------------------------------------
     * Segments
     * ------------------------------------------------------------------------------------------ */

    private newSegment(direction: Direction, limit: number): Segment<H, M> {
        return { direction, limit, docs: [], messages: [], sub: null, stopped: false, pending: null };
    }

    /** Subscribes to a page and waits for the server's first answer (never forever). */
    private async fetchSegment(segment: Segment<H, M>, request: PageRequest<H>, epoch: number): Promise<SourceDoc<H>[]> {
        const sub = this.source.page(request, {
            onChange: (docs) => this.onSegmentChange(segment, docs),
            onError: (error) => this.report(error),
        });
        segment.sub = sub;
        const docs = await this.within(sub.ready, () => this.discard(segment));
        this.assertCurrent(epoch);
        return docs;
    }

    /** Puts a loaded page on screen and moves the edges of what is on screen. */
    private attach(segment: Segment<H, M>, answer: SourceDoc<H>[], options: { replacing?: boolean } = {}): void {
        const docs = segment.pending ?? answer;
        segment.pending = null;
        const visible = shown(docs, segment.direction, segment.limit);
        const probe = probeOf(docs, segment.direction, segment.limit);

        if (visible.length === 0) {
            this.discard(segment);
            if (segment.direction === "older") this.hasOlder = false;
            else {
                this.hasNewer = false;
                this.attached = true;
            }
            this.dirty = true;
            return;
        }

        segment.docs = visible;
        segment.messages = visible.map(this.toMessage);

        if (segment.direction === "older") {
            this.segments.unshift(segment);
            this.oldest = visible[0];
            this.hasOlder = probe !== null;
            if (options.replacing && this.newest === null) this.newest = visible[visible.length - 1];
        } else {
            this.segments.push(segment);
            this.newest = visible[visible.length - 1];
            // Nothing beyond, or what lies beyond is already the tail's: the chain has met the live end.
            this.attached = probe === null || this.touchesTail(probe);
            this.hasNewer = !this.attached;
        }
        this.dirty = true;
    }

    private onSegmentChange(segment: Segment<H, M>, docs: SourceDoc<H>[]): void {
        if (this.disposed || segment.stopped) return;
        if (!this.segments.includes(segment)) {
            segment.pending = docs; // not on screen yet: it will be used when it gets there
            return;
        }
        segment.docs = shown(docs, segment.direction, segment.limit);
        segment.messages = segment.docs.map(this.toMessage);
        this.dirty = true;
        this.emit();
    }

    private discard(segment: Segment<H, M>): void {
        segment.stopped = true;
        segment.sub?.stop();
        segment.sub = null;
    }

    private stopSegments(): void {
        for (const segment of this.segments) this.discard(segment);
    }

    private touchesTail(doc: SourceDoc<H>): boolean {
        return this.tailStart === null || compareKeys(doc, this.tailStart) >= 0;
    }

    /* ---------------------------------------------------------------------------------------------
     * The tail
     * ------------------------------------------------------------------------------------------ */

    private followTail(): void {
        const apply = (docs: SourceDoc<H>[]) => {
            if (this.disposed) return;
            this.tailMessages = docs.map(this.toMessage);
            this.dirty = true;
            this.emit();
        };

        const sub = this.source.tail(this.tailStart, {
            onChange: apply,
            onError: (error) => this.report(error),
        });
        this.tailSub = sub;
        // The first server answer can already differ from the page read a moment ago (a message arrived in between).
        sub.ready.then(
            (docs) => {
                if (this.tailSub === sub) apply(docs);
            },
            (error) => {
                if (this.tailSub === sub) this.report(error);
            }
        );
    }

    /* ---------------------------------------------------------------------------------------------
     * Plumbing
     * ------------------------------------------------------------------------------------------ */

    private isDisplayed(id: string): boolean {
        return this.current().some((message) => message.id === id);
    }

    /** What is on screen: the segments, then the tail when attached, without duplicates. */
    private current(): readonly M[] {
        if (!this.dirty) return this.messages;

        if (this.segments.length === 0 && this.attached) {
            this.messages = this.tailMessages;
        } else {
            const seen = new Set<string>();
            const out: M[] = [];
            const add = (list: readonly M[]) => {
                for (const message of list) {
                    if (seen.has(message.id)) continue;
                    seen.add(message.id);
                    out.push(message);
                }
            };
            for (const segment of this.segments) add(segment.messages);
            if (this.attached) add(this.tailMessages);
            this.messages = out;
        }
        this.dirty = false;
        return this.messages;
    }

    private buildSnapshot(): MessagesSnapshot<M> {
        return {
            messages: this.current(),
            loading: this.loading,
            failed: this.failed,
            hasOlder: this.hasOlder,
            hasNewer: this.hasNewer && !this.attached,
            loadingOlder: this.busy.older !== 0,
            loadingNewer: this.busy.newer !== 0,
            revealing: this.busy.reveal !== 0,
            detached: !this.attached,
            latest: this.tailMessages[this.tailMessages.length - 1] ?? null,
        };
    }

    private emit(): void {
        if (this.disposed) return;
        this.snapshot = this.buildSnapshot();
        for (const listener of [...this.listeners]) listener(this.snapshot);
    }

    /** Everything started before now is stale: its promises reject with "cancelled" and its results are dropped. */
    private bump(): void {
        this.epoch += 1;
        for (const waiter of [...this.waiters]) waiter(new ChatLoadError("cancelled"));
    }

    private assertCurrent(epoch: number): void {
        if (this.disposed || epoch !== this.epoch) throw new ChatLoadError("cancelled");
    }

    /** `promise`, but it also settles when the work is cancelled or takes too long. */
    private within<T>(promise: Promise<T>, abort?: () => void): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            const waiter: Waiter = (error) => {
                clearTimeout(timer);
                this.waiters.delete(waiter);
                abort?.();
                reject(error);
            };
            const timer = setTimeout(() => waiter(new ChatLoadError("timeout")), this.loadTimeoutMs);
            this.waiters.add(waiter);

            promise.then(
                (value) => {
                    if (!this.waiters.delete(waiter)) return;
                    clearTimeout(timer);
                    resolve(value);
                },
                (error: unknown) => {
                    if (!this.waiters.delete(waiter)) return;
                    clearTimeout(timer);
                    reject(error instanceof ChatLoadError ? error : new ChatLoadError("failed", error));
                }
            );
        });
    }

    private report(error: unknown): void {
        if (this.disposed) return;
        const failure = error instanceof ChatLoadError ? error : new ChatLoadError("failed", error);
        if (failure.code === "cancelled") return;
        this.onError?.(failure);
    }
}
