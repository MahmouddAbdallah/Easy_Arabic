import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
    ChatLoadError,
    MessageStore,
    compareKeys,
    type Listener,
    type MessageKey,
    type MessageSource,
    type MessageStoreOptions,
    type PageRequest,
    type SourceDoc,
    type Subscription,
} from "./messageStore";

/* ------------------------------------------------------------------------------------------------
 * An in-memory conversation that answers the way Firestore does: ordered by (time, id), cursors that
 * resume exactly after/at a message, a first answer that takes a while, and live listeners.
 * ---------------------------------------------------------------------------------------------- */

interface Stored extends MessageKey {
    text: string;
}

interface Msg {
    id: string;
    time: string;
    text: string;
}

class FakeSource implements MessageSource<string> {
    readonly docs = new Map<string, Stored>();
    latency = 2;
    /** The server never answers (a cache-only first event that nothing follows is the same thing to the caller). */
    hang = false;
    failWith: Error | null = null;
    visibleAfter: string | null = null;
    /** Documents handed out, to prove loads stay bounded. */
    served = 0;
    private readonly live = new Set<{ run: () => void; label: string }>();

    get liveCount(): number {
        return this.live.size;
    }

    add(doc: Stored): void {
        this.docs.set(doc.id, doc);
        this.notify();
    }

    update(id: string, text: string): void {
        const doc = this.docs.get(id);
        if (!doc) throw new Error("unknown message");
        this.docs.set(id, { ...doc, text });
        this.notify();
    }

    private notify(): void {
        for (const subscription of [...this.live]) subscription.run();
    }

    private sorted(): Stored[] {
        return [...this.docs.values()]
            .filter((doc) => this.visibleAfter === null || doc.time > this.visibleAfter)
            .sort(compareKeys);
    }

    private toDoc(doc: Stored): SourceDoc<string> {
        return { id: doc.id, time: doc.time, data: { text: doc.text }, handle: doc.id };
    }

    private select(request: PageRequest<string>): Stored[] {
        const all = this.sorted();
        const from = request.from;
        if (request.direction === "older") {
            let list = all.slice().reverse();
            if (from) list = list.filter((doc) => (from.inclusive ? compareKeys(doc, from.doc) <= 0 : compareKeys(doc, from.doc) < 0));
            return list.slice(0, request.limit).reverse();
        }
        let list = all;
        if (from) list = list.filter((doc) => (from.inclusive ? compareKeys(doc, from.doc) >= 0 : compareKeys(doc, from.doc) > 0));
        return list.slice(0, request.limit);
    }

    private later<T>(compute: () => T, label: string): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            if (this.hang) return; // never answers
            setTimeout(() => {
                if (this.failWith) return reject(this.failWith);
                const value = compute();
                if (Array.isArray(value)) this.served += value.length;
                resolve(value);
            }, this.latency);
            void label;
        });
    }

    newest(limit: number): Promise<SourceDoc<string>[]> {
        return this.later(() => this.sorted().slice(-limit).map((doc) => this.toDoc(doc)), "newest");
    }

    async get(id: string): Promise<SourceDoc<string> | null> {
        return this.later(() => {
            const doc = this.docs.get(id);
            if (!doc || (this.visibleAfter !== null && doc.time <= this.visibleAfter)) return null;
            return this.toDoc(doc);
        }, "get");
    }

    private listen(label: string, select: () => Stored[], listener: Listener<string>): Subscription<string> {
        let stopped = false;
        let answered = false;
        let last = "";
        const entry = {
            label,
            run: () => {
                if (stopped || !answered) return;
                const docs = select().map((doc) => this.toDoc(doc));
                const signature = JSON.stringify(docs.map((doc) => [doc.id, doc.data]));
                if (signature === last) return;
                last = signature;
                listener.onChange(docs);
            },
        };
        this.live.add(entry);
        const ready = this.later(() => {
            if (stopped) return [];
            const docs = select().map((doc) => this.toDoc(doc));
            last = JSON.stringify(docs.map((doc) => [doc.id, doc.data]));
            answered = true;
            return docs;
        }, label);
        ready.catch(() => undefined);
        return {
            ready,
            stop: () => {
                stopped = true;
                this.live.delete(entry);
            },
        };
    }

    page(request: PageRequest<string>, listener: Listener<string>): Subscription<string> {
        return this.listen(`page:${request.direction}`, () => this.select(request), listener);
    }

    tail(from: SourceDoc<string> | null, listener: Listener<string>): Subscription<string> {
        return this.listen("tail", () => this.sorted().filter((doc) => !from || compareKeys(doc, from) >= 0), listener);
    }
}

const pad = (n: number) => String(n).padStart(6, "0");
const timeOf = (n: number) => new Date(Date.UTC(2026, 0, 1) + n * 60_000).toISOString();

function conversation(count: number, options: { sameTime?: boolean } = {}): FakeSource {
    const source = new FakeSource();
    for (let i = 0; i < count; i += 1) {
        source.docs.set(`m${pad(i)}`, { id: `m${pad(i)}`, time: options.sameTime ? timeOf(0) : timeOf(i), text: `message ${i}` });
    }
    return source;
}

interface Harness {
    store: MessageStore<string, Msg>;
    source: FakeSource;
    errors: ChatLoadError[];
}

async function open(source: FakeSource, options: Partial<MessageStoreOptions<string, Msg>> = {}): Promise<Harness> {
    const errors: ChatLoadError[] = [];
    const store = new MessageStore<string, Msg>({
        source,
        toMessage: (doc) => ({ id: doc.id, time: doc.time, text: String(doc.data.text) }),
        loadTimeoutMs: 80,
        onError: (error) => errors.push(error),
        ...options,
    });
    await store.start();
    await sleep(8); // the live tail has had its first answer
    return { store, source, errors };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const ids = (store: MessageStore<string, Msg>) => store.getSnapshot().messages.map((message) => message.id);
const idx = (n: number) => `m${pad(n)}`;

/** The messages are exactly the numbers from..to, in order: nothing missing, nothing twice. */
function assertRun(store: MessageStore<string, Msg>, from: number, to: number): void {
    const expected: string[] = [];
    for (let i = from; i <= to; i += 1) expected.push(idx(i));
    assert.deepEqual(ids(store), expected);
}

describe("opening", () => {
    it("shows the newest page, oldest first, and knows there is more", async () => {
        const { store } = await open(conversation(100));
        const snapshot = store.getSnapshot();
        assert.equal(snapshot.loading, false);
        assert.equal(snapshot.hasOlder, true);
        assert.equal(snapshot.detached, false);
        assertRun(store, 85, 99);
        assert.equal(snapshot.latest?.id, idx(99));
        store.dispose();
    });

    it("handles an empty conversation, an exact page and one message more than a page", async () => {
        const empty = await open(conversation(0));
        assert.deepEqual(ids(empty.store), []);
        assert.equal(empty.store.getSnapshot().hasOlder, false);
        assert.equal(empty.store.getSnapshot().loading, false);

        const exact = await open(conversation(15));
        assert.equal(exact.store.getSnapshot().hasOlder, false);
        assertRun(exact.store, 0, 14);

        const over = await open(conversation(16));
        assert.equal(over.store.getSnapshot().hasOlder, true);
        assertRun(over.store, 1, 15);
        assert.equal(await over.store.loadOlder(), true);
        assertRun(over.store, 0, 15);
        assert.equal(over.store.getSnapshot().hasOlder, false);
        for (const harness of [empty, exact, over]) harness.store.dispose();
    });

    it("reports a conversation that cannot be opened, and opens it on reload", async () => {
        const source = conversation(30);
        source.failWith = new Error("offline");
        const { store, errors } = await open(source);
        assert.equal(store.getSnapshot().failed, true);
        assert.equal(store.getSnapshot().loading, false);
        assert.equal(errors[0]?.code, "failed");

        source.failWith = null;
        await store.reload();
        assert.equal(store.getSnapshot().failed, false);
        assertRun(store, 15, 29);
        store.dispose();
    });

    it("gives up on a server that never answers instead of waiting forever", async () => {
        const source = conversation(30);
        source.hang = true;
        const { store, errors } = await open(source);
        assert.equal(store.getSnapshot().loading, false);
        assert.equal(store.getSnapshot().failed, true);
        assert.equal(errors[0]?.code, "timeout");
        store.dispose();
    });
});

describe("loading older messages", () => {
    it("pages back to the very first message without gaps or repeats", async () => {
        const { store } = await open(conversation(100));
        let guard = 0;
        while (store.getSnapshot().hasOlder && guard++ < 20) assert.equal(await store.loadOlder(), true);
        assertRun(store, 0, 99);
        assert.equal(store.getSnapshot().hasOlder, false);
        assert.equal(await store.loadOlder(), false);
        store.dispose();
    });

    it("does not skip or repeat messages that share the same time", async () => {
        const { store } = await open(conversation(50, { sameTime: true }));
        while (store.getSnapshot().hasOlder) await store.loadOlder();
        assert.equal(store.getSnapshot().messages.length, 50);
        assert.equal(new Set(ids(store)).size, 50);
        assert.deepEqual(ids(store), [...ids(store)].sort());
        store.dispose();
    });

    it("ignores a second request while one is running", async () => {
        const { store } = await open(conversation(100));
        const first = store.loadOlder();
        assert.equal(store.getSnapshot().loadingOlder, true);
        assert.equal(await store.loadOlder(), false);
        assert.equal(await first, true);
        assert.equal(store.getSnapshot().loadingOlder, false);
        assertRun(store, 70, 99);
        store.dispose();
    });

    it("never stays in the loading state when the server does not answer", async () => {
        const { store, source, errors } = await open(conversation(100));
        source.hang = true;
        assert.equal(await store.loadOlder(), false);
        assert.equal(store.getSnapshot().loadingOlder, false);
        assert.equal(errors.at(-1)?.code, "timeout");
        assertRun(store, 85, 99);

        source.hang = false;
        assert.equal(await store.loadOlder(), true);
        assertRun(store, 70, 99);
        store.dispose();
    });

    it("respects what the user cleared", async () => {
        const source = conversation(100);
        source.visibleAfter = timeOf(89);
        const { store } = await open(source);
        while (store.getSnapshot().hasOlder) await store.loadOlder();
        assertRun(store, 90, 99);
        store.dispose();
    });
});

describe("jumping to a message", () => {
    it("does nothing when the message is already on screen", async () => {
        const { store, source } = await open(conversation(100));
        const before = source.served;
        assert.equal(await store.reveal({ id: idx(90), time: timeOf(90) }), "ready");
        assert.equal(source.served, before);
        assertRun(store, 85, 99);
        store.dispose();
    });

    it("extends the history in one read when the message is just beyond what is loaded", async () => {
        const { store, source } = await open(conversation(1000));
        const before = source.served;
        assert.equal(await store.reveal({ id: idx(950), time: timeOf(950) }), "ready");
        const snapshot = store.getSnapshot();
        assert.equal(snapshot.detached, false);
        assert.equal(snapshot.hasOlder, true);
        assert.ok(ids(store).includes(idx(950)));
        assert.equal(ids(store).at(-1), idx(999));
        assert.ok(source.served - before <= 70, `read ${source.served - before} messages`);
        // contiguous from the oldest shown to the newest
        const first = Number(ids(store)[0].slice(1));
        assertRun(store, first, 999);
        store.dispose();
    });

    it("opens a window around a message far back and never reads the history in between", async () => {
        const { store, source } = await open(conversation(20_000));
        const before = source.served;
        assert.equal(await store.reveal({ id: idx(100), time: timeOf(100) }), "ready");
        const snapshot = store.getSnapshot();
        assert.equal(snapshot.detached, true);
        assert.equal(snapshot.hasOlder, true);
        assert.equal(snapshot.hasNewer, true);
        assert.ok(ids(store).includes(idx(100)));
        assert.ok(snapshot.messages.length <= 40);
        assert.ok(source.served - before <= 120, `read ${source.served - before} messages`);
        const first = Number(ids(store)[0].slice(1));
        assertRun(store, first, first + snapshot.messages.length - 1);
        assert.equal(snapshot.latest?.id, idx(19_999), "the live end is still followed");
        store.dispose();
    });

    it("handles the very first message of the conversation", async () => {
        const { store } = await open(conversation(5000));
        assert.equal(await store.reveal({ id: idx(0), time: timeOf(0) }), "ready");
        const snapshot = store.getSnapshot();
        assert.equal(snapshot.hasOlder, false);
        assert.equal(ids(store)[0], idx(0));
        assert.equal(snapshot.detached, true);
        assert.equal(await store.loadOlder(), false);
        store.dispose();
    });

    it("joins the live end when the window reaches it", async () => {
        const { store } = await open(conversation(5000), { gapCap: 5 });
        // 15 loaded (4985..4999); the target is 15 beyond, more than the cap, so a window opens. Its newer half
        // (20 messages) reaches the live end.
        assert.equal(await store.reveal({ id: idx(4970), time: timeOf(4970) }), "ready");
        const snapshot = store.getSnapshot();
        assert.equal(snapshot.detached, false);
        assert.equal(snapshot.hasNewer, false);
        assert.equal(ids(store).at(-1), idx(4999));
        const first = Number(ids(store)[0].slice(1));
        assertRun(store, first, 4999);
        store.dispose();
    });

    it("loads newer pages from a window until it meets the live end", async () => {
        const { store } = await open(conversation(2000));
        await store.reveal({ id: idx(1500), time: timeOf(1500) });
        assert.equal(store.getSnapshot().detached, true);

        let guard = 0;
        while (store.getSnapshot().hasNewer && guard++ < 100) assert.equal(await store.loadNewer(), true);
        const snapshot = store.getSnapshot();
        assert.equal(snapshot.detached, false);
        assert.equal(snapshot.hasNewer, false);
        const first = Number(ids(store)[0].slice(1));
        assertRun(store, first, 1999);
        assert.equal(await store.loadNewer(), false);
        store.dispose();
    });

    it("can keep going back from a window", async () => {
        const { store } = await open(conversation(3000));
        await store.reveal({ id: idx(200), time: timeOf(200) });
        const first = Number(ids(store)[0].slice(1));
        assert.equal(await store.loadOlder(), true);
        const next = Number(ids(store)[0].slice(1));
        assert.equal(next, first - 15);
        assertRun(store, next, next + store.getSnapshot().messages.length - 1);
        store.dispose();
    });

    it("jumps from one window to another message further back", async () => {
        const { store } = await open(conversation(9000));
        await store.reveal({ id: idx(5000), time: timeOf(5000) });
        assert.equal(await store.reveal({ id: idx(10), time: timeOf(10) }), "ready");
        assert.ok(ids(store).includes(idx(10)));
        assert.ok(!ids(store).includes(idx(5000)));
        store.dispose();
    });

    it("jumps forward again inside a window", async () => {
        const { store } = await open(conversation(9000));
        await store.reveal({ id: idx(1000), time: timeOf(1000) });
        assert.equal(await store.reveal({ id: idx(1030), time: timeOf(1030) }), "ready");
        assert.ok(ids(store).includes(idx(1030)));
        const first = Number(ids(store)[0].slice(1));
        assertRun(store, first, first + store.getSnapshot().messages.length - 1);
        store.dispose();
    });

    it("works when many messages share one time", async () => {
        const { store } = await open(conversation(300, { sameTime: true }));
        assert.equal(await store.reveal({ id: idx(10), time: timeOf(0) }), "ready");
        assert.ok(ids(store).includes(idx(10)));
        assert.equal(new Set(ids(store)).size, store.getSnapshot().messages.length);
        store.dispose();
    });

    it("returns 'missing' for a message that does not exist", async () => {
        const { store } = await open(conversation(5000));
        assert.equal(await store.reveal({ id: "nope", time: timeOf(10) }), "missing");
        assert.equal(store.getSnapshot().revealing, false);
        assertRun(store, 4985, 4999);
        store.dispose();
    });

    it("does not treat a cleared message as reachable", async () => {
        const source = conversation(500);
        source.visibleAfter = timeOf(300);
        const { store } = await open(source);
        assert.equal(await store.reveal({ id: idx(100), time: timeOf(100) }), "missing");
        store.dispose();
    });

    it("fails cleanly, and quickly, when the server does not answer", async () => {
        const { store, source, errors } = await open(conversation(5000));
        source.hang = true;
        assert.equal(await store.reveal({ id: idx(100), time: timeOf(100) }), "failed");
        assert.equal(store.getSnapshot().revealing, false);
        assert.equal(errors.at(-1)?.code, "timeout");
        assertRun(store, 4985, 4999); // the screen was not touched

        source.hang = false;
        assert.equal(await store.reveal({ id: idx(100), time: timeOf(100) }), "ready");
        store.dispose();
    });

    it("fails cleanly when the window cannot be read half way", async () => {
        const { store, source } = await open(conversation(5000));
        const originalGet = source.get.bind(source);
        source.get = async (id: string) => {
            const doc = await originalGet(id);
            source.hang = true; // the pages that follow never arrive
            return doc;
        };
        assert.equal(await store.reveal({ id: idx(100), time: timeOf(100) }), "failed");
        assertRun(store, 4985, 4999);
        assert.equal(source.liveCount, 1, "only the live tail is still listening");
        store.dispose();
    });
});

describe("overlapping work", () => {
    it("drops a page that was loading when a jump started", async () => {
        const { store, source } = await open(conversation(5000));
        source.latency = 15;
        const loading = store.loadOlder();
        const jump = store.reveal({ id: idx(100), time: timeOf(100) });
        assert.equal(await loading, false);
        assert.equal(await jump, "ready");
        const snapshot = store.getSnapshot();
        assert.equal(snapshot.loadingOlder, false);
        assert.equal(snapshot.revealing, false);
        assert.ok(ids(store).includes(idx(100)));
        assert.ok(!ids(store).includes(idx(4985)), "the stale page did not leak into the window");
        store.dispose();
    });

    it("lets the newest jump win", async () => {
        const { store, source } = await open(conversation(9000));
        source.latency = 10;
        const first = store.reveal({ id: idx(100), time: timeOf(100) });
        const second = store.reveal({ id: idx(5000), time: timeOf(5000) });
        assert.equal(await first, "cancelled");
        assert.equal(await second, "ready");
        assert.ok(ids(store).includes(idx(5000)));
        assert.ok(!ids(store).includes(idx(100)));
        assert.equal(source.liveCount, 3, "tail plus the two halves of the window, nothing leaked");
        store.dispose();
    });

    it("cancels a pending jump when the store is disposed", async () => {
        const { store, source } = await open(conversation(5000));
        source.latency = 30;
        const jump = store.reveal({ id: idx(100), time: timeOf(100) });
        store.dispose();
        assert.equal(await jump, "cancelled");
        await sleep(60);
        assert.equal(source.liveCount, 0);
    });

    it("withdraws a jump in progress when the next request is for a message already on screen", async () => {
        const { store, source } = await open(conversation(5000));
        source.latency = 15;
        const far = store.reveal({ id: idx(100), time: timeOf(100) });
        assert.equal(await store.reveal({ id: idx(4990), time: timeOf(4990) }), "ready");
        assert.equal(await far, "cancelled");
        assertRun(store, 4985, 4999);
        assert.equal(store.getSnapshot().revealing, false);
        store.dispose();
    });

    it("does not start loading more while a jump is running", async () => {
        const { store, source } = await open(conversation(5000));
        source.latency = 15;
        const jump = store.reveal({ id: idx(100), time: timeOf(100) });
        assert.equal(await store.loadOlder(), false);
        assert.equal(await jump, "ready");
        store.dispose();
    });
});

describe("going back to the latest", () => {
    it("drops the window at once and stops listening to it", async () => {
        const { store, source } = await open(conversation(5000));
        await store.reveal({ id: idx(100), time: timeOf(100) });
        assert.equal(source.liveCount, 3);
        store.returnToLatest();
        const snapshot = store.getSnapshot();
        assert.equal(snapshot.detached, false);
        assert.equal(snapshot.hasOlder, true);
        assert.equal(snapshot.hasNewer, false);
        assertRun(store, 4985, 4999);
        assert.equal(source.liveCount, 1);
        // and history still pages normally from there
        assert.equal(await store.loadOlder(), true);
        assertRun(store, 4970, 4999);
        store.dispose();
    });

    it("cancels a jump that is still being prepared", async () => {
        const { store, source } = await open(conversation(5000));
        source.latency = 20;
        const jump = store.reveal({ id: idx(100), time: timeOf(100) });
        store.returnToLatest();
        assert.equal(await jump, "cancelled");
        assert.equal(store.getSnapshot().revealing, false);
        assertRun(store, 4985, 4999);
        await sleep(60);
        assert.equal(source.liveCount, 1);
        store.dispose();
    });
});

describe("staying live", () => {
    it("shows a new message at the live end", async () => {
        const { store, source } = await open(conversation(100));
        source.add({ id: idx(100), time: timeOf(100), text: "hello" });
        assert.equal(store.getSnapshot().latest?.id, idx(100));
        assert.equal(ids(store).at(-1), idx(100));
        store.dispose();
    });

    it("catches a message that arrived between the first read and the live tail's first answer", async () => {
        const source = conversation(100);
        const store = new MessageStore<string, Msg>({
            source,
            toMessage: (doc) => ({ id: doc.id, time: doc.time, text: String(doc.data.text) }),
            loadTimeoutMs: 80,
        });
        await store.start();
        source.add({ id: idx(100), time: timeOf(100), text: "early" });
        await sleep(10);
        assert.equal(store.getSnapshot().latest?.id, idx(100));
        assert.equal(ids(store).at(-1), idx(100));
        store.dispose();
    });

    it("keeps the live end out of a window until the window meets it, but still knows about it", async () => {
        const { store, source } = await open(conversation(5000));
        await store.reveal({ id: idx(100), time: timeOf(100) });
        source.add({ id: idx(5000), time: timeOf(5000), text: "new" });
        assert.equal(store.getSnapshot().latest?.id, idx(5000));
        assert.ok(!ids(store).includes(idx(5000)));
        store.returnToLatest();
        assert.equal(ids(store).at(-1), idx(5000));
        store.dispose();
    });

    it("applies an edit to a message that is far back in a loaded window", async () => {
        const { store, source } = await open(conversation(5000));
        await store.reveal({ id: idx(100), time: timeOf(100) });
        source.update(idx(100), "edited");
        const message = store.getSnapshot().messages.find((m) => m.id === idx(100));
        assert.equal(message?.text, "edited");
        store.dispose();
    });

    it("applies an edit to an older page loaded the normal way", async () => {
        const { store, source } = await open(conversation(100));
        await store.loadOlder();
        source.update(idx(80), "edited");
        assert.equal(store.getSnapshot().messages.find((m) => m.id === idx(80))?.text, "edited");
        store.dispose();
    });

    it("publishes a fresh messages array only when something changed", async () => {
        const { store } = await open(conversation(100));
        const before = store.getSnapshot().messages;
        const loading = store.loadOlder();
        assert.equal(store.getSnapshot().messages, before, "starting a load does not touch the list");
        await loading;
        assert.notEqual(store.getSnapshot().messages, before);
        store.dispose();
    });
});
