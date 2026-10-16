/**
 * Runs the real `sendGroupMessage` (./groupMessages.server.ts) and the real unread bookkeeping it uses against an
 * in-memory Firestore that behaves like the real one where it matters here: a transaction can't read after it has
 * written, `update()` understands field paths and increments, and a missing document can't be updated.
 */
import assert from "node:assert/strict";
import Module from "node:module";
import { beforeEach, before, describe, it } from "node:test";
import { getMessagePreview } from "./constants";

type Doc = Record<string, any>;

const store = new Map<string, Doc>();
let autoIds = 0;

class DocRef {
    constructor(readonly path: string) {}
    get id() {
        return this.path.split("/").at(-1) as string;
    }
    collection(name: string) {
        return new CollRef(`${this.path}/${name}`);
    }
}
class CollRef {
    constructor(readonly path: string) {}
    doc(id?: string) {
        return new DocRef(`${this.path}/${id ?? `auto${++autoIds}`}`);
    }
    where(field: string, op: string, value: unknown) {
        return new QueryRef(this.path, field, op, value);
    }
}
class QueryRef {
    constructor(
        readonly path: string,
        readonly field: string,
        readonly op: string,
        readonly value: unknown
    ) {}
}

const snapshot = (path: string) => {
    const data = store.get(path);
    return { exists: data !== undefined, id: path.split("/").at(-1), data: () => data, get: (field: string) => data?.[field] };
};

/** Applies `update(ref, field, value, ...)` pairs: plain names, FieldPath segments, and FieldValue.increment. */
function applyUpdate(doc: Doc, field: unknown, value: any) {
    const segments: string[] = typeof field === "string" ? [field] : (field as { segments: string[] }).segments;
    let target = doc;
    for (const segment of segments.slice(0, -1)) target = target[segment] ??= {};
    const last = segments.at(-1) as string;
    target[last] = value && typeof value === "object" && "operand" in value ? (Number(target[last]) || 0) + value.operand : value;
}

class FakeTransaction {
    private wrote = false;

    async get(target: DocRef | QueryRef) {
        if (this.wrote) throw new Error("Firestore transactions require all reads to be executed before all writes.");
        if (target instanceof DocRef) return snapshot(target.path);
        const depth = target.path.split("/").length + 1;
        const docs = [...store.keys()]
            .filter((key) => key.startsWith(`${target.path}/`) && key.split("/").length === depth)
            .filter((key) => ((store.get(key)?.[target.field] as unknown[] | undefined) ?? []).includes(target.value))
            .map(snapshot);
        return { docs };
    }
    set(ref: DocRef, data: Doc) {
        this.wrote = true;
        store.set(ref.path, structuredCloneLoose(data));
    }
    update(ref: DocRef, ...args: unknown[]) {
        this.wrote = true;
        const doc = store.get(ref.path);
        if (!doc) throw new Error(`No document to update: ${ref.path}`);
        for (let index = 0; index < args.length; index += 2) applyUpdate(doc, args[index], args[index + 1]);
    }
}

/** A copy that keeps sentinel class instances (serverTimestamp) as they are. */
function structuredCloneLoose(data: Doc): Doc {
    return { ...data };
}

class FakeChatApiError extends Error {
    constructor(
        readonly code: string,
        message: string,
        readonly status: number
    ) {
        super(message);
    }
}

const stubs: Record<string, unknown> = {
    "@/lib/config/firebase-admin": {
        firebaseAdminDB: {
            collection: (name: string) => new CollRef(name),
            runTransaction: async <T>(work: (tx: FakeTransaction) => Promise<T>) => work(new FakeTransaction()),
        },
    },
    "./messageOperations.server": { ChatApiError: FakeChatApiError },
};
const moduleInternals = Module as unknown as { _load: (request: string, ...rest: unknown[]) => unknown };
const originalLoad = moduleInternals._load;
moduleInternals._load = function (request: string, ...rest: unknown[]) {
    return request in stubs ? stubs[request] : originalLoad.call(this, request, ...rest);
};

const GROUP = "grp-AbCdEfGhIjKlMnOpQrStU";
const groupDoc = (over: Doc = {}): Doc => ({
    category: "group",
    name: "Math parents",
    participants: ["me", "sara", "omar"],
    unreadCount: { me: 0, sara: 0, omar: 0 },
    isRead: true,
    lastMessage: "",
    ...over,
});

type Messages = typeof import("./groupMessages.server");
let messages: Messages;
before(async () => {
    messages = await import("./groupMessages.server");
});
beforeEach(() => {
    store.clear();
    autoIds = 0;
    store.set(`chats/${GROUP}`, groupDoc());
});

const sent = () => [...store.entries()].filter(([path]) => path.startsWith(`chats/${GROUP}/messages/`));
const chat = () => store.get(`chats/${GROUP}`) as Doc;

describe("sendGroupMessage", () => {
    it("stores the message like a direct one and moves the group up for everybody", async () => {
        const result = await messages.sendGroupMessage({ actorId: "me", groupId: GROUP, text: "hello", attachments: [] });

        assert.deepEqual(result, { groupName: "Math parents", recipientIds: ["sara", "omar"] });

        const [[path, message]] = sent();
        assert.equal(message.id, path.split("/").at(-1));
        assert.equal(message.senderId, "me");
        assert.equal(message.text, "hello");
        assert.equal(message.status, "sent");
        assert.ok(!Number.isNaN(Date.parse(message.time)));
        assert.ok(message.createdAt);
        assert.ok(!("receiverId" in message), "a group message has no single receiver");
        assert.ok(!("attachments" in message));

        assert.equal(chat().lastMessage, "hello");
        assert.equal(chat().lastSenderId, "me");
        assert.equal(chat().time, message.time);
        assert.ok(chat().updatedAt, "the sidebar orders by updatedAt");
    });

    it("counts the message as unread for every member but the sender, in the chat and in their totals", async () => {
        store.set("unreadMessageCount/sara", { count: 5 });
        // Omar has no total yet: it is built from his chats (here: 2 unread elsewhere), then this message is added.
        store.set("chats/elsewhere", { participants: ["omar", "x"], unreadCount: { omar: 2, x: 0 } });

        await messages.sendGroupMessage({ actorId: "me", groupId: GROUP, text: "hello", attachments: [] });

        assert.deepEqual(chat().unreadCount, { me: 0, sara: 1, omar: 1 });
        assert.equal(chat().isRead, false);
        assert.deepEqual(store.get("unreadMessageCount/sara"), { count: 6 });
        assert.deepEqual(store.get("unreadMessageCount/omar"), { count: 3 });
        assert.equal(store.has("unreadMessageCount/me"), false, "the sender has nothing new to read");
    });

    it("adds to what is already unread instead of overwriting it, so two senders never cancel each other out", async () => {
        store.set(`chats/${GROUP}`, groupDoc({ unreadCount: { me: 0, sara: 3, omar: 0 } }));
        await messages.sendGroupMessage({ actorId: "me", groupId: GROUP, text: "one", attachments: [] });
        await messages.sendGroupMessage({ actorId: "omar", groupId: GROUP, text: "two", attachments: [] });
        // sara: 3 + 1 + 1, omar: 0 + 1 (from me) + 0 (his own), me: 0 + 1 (from omar)
        assert.deepEqual(chat().unreadCount, { me: 1, sara: 5, omar: 1 });
        assert.equal(chat().lastSenderId, "omar");
    });

    it("previews attachments like a direct chat does", async () => {
        const attachments = [{ type: "image", url: "https://x/y.jpg", name: "y.jpg", size: 1, mimeType: "image/jpeg" }] as never;
        await messages.sendGroupMessage({ actorId: "sara", groupId: GROUP, text: "", attachments });
        assert.equal(chat().lastMessage, getMessagePreview("", attachments));
        assert.ok(chat().lastMessage.length > 0);
        assert.equal(sent()[0][1].attachments.length, 1);
        assert.equal(sent()[0][1].text, "");
    });

    it("replaces a counter that isn't the per-person map instead of trusting it", async () => {
        store.set(`chats/${GROUP}`, groupDoc({ unreadCount: 3 }));
        await messages.sendGroupMessage({ actorId: "me", groupId: GROUP, text: "hello", attachments: [] });
        assert.deepEqual(chat().unreadCount, { me: 0, sara: 1, omar: 1 });
    });

    it("is only for members: a stranger writes nothing anywhere", async () => {
        const before = JSON.stringify([...store.entries()]);
        await assert.rejects(messages.sendGroupMessage({ actorId: "stranger", groupId: GROUP, text: "hi", attachments: [] }), (error: unknown) => {
            assert.equal((error as FakeChatApiError).code, "NOT_A_MEMBER");
            assert.equal((error as FakeChatApiError).status, 403);
            return true;
        });
        assert.equal(JSON.stringify([...store.entries()]), before);
    });

    it("is only for groups: a missing chat and a direct chat are both 'no such group'", async () => {
        store.set("chats/me_sara", { participants: ["me", "sara"], unreadCount: { me: 0, sara: 0 } });
        for (const groupId of ["grp-DoesNotExistAtAll123", "me_sara"]) {
            await assert.rejects(messages.sendGroupMessage({ actorId: "me", groupId, text: "hi", attachments: [] }), (error: unknown) => {
                assert.equal((error as FakeChatApiError).code, "GROUP_NOT_FOUND");
                assert.equal((error as FakeChatApiError).status, 404);
                return true;
            });
        }
        assert.equal(sent().length, 0);
        assert.equal(store.get("chats/me_sara")?.lastMessage, undefined);
    });

    it("works for a group of two and for a large one", async () => {
        const ids = Array.from({ length: 50 }, (_, n) => `u${n}`);
        store.set(`chats/${GROUP}`, groupDoc({ participants: ids, unreadCount: Object.fromEntries(ids.map((id) => [id, 0])) }));
        const result = await messages.sendGroupMessage({ actorId: "u0", groupId: GROUP, text: "all hands", attachments: [] });
        assert.equal(result.recipientIds.length, 49);
        assert.equal(chat().unreadCount.u0, 0);
        assert.ok(ids.slice(1).every((id) => chat().unreadCount[id] === 1));
        assert.equal(ids.slice(1).filter((id) => (store.get(`unreadMessageCount/${id}`) as Doc).count === 1).length, 49);
    });
});

describe("assertGroupMember", () => {
    it("returns everybody in the group for a member", () => {
        const snap = snapshot(`chats/${GROUP}`) as never;
        assert.deepEqual(messages.assertGroupMember(snap, "sara"), ["me", "sara", "omar"]);
    });
});
