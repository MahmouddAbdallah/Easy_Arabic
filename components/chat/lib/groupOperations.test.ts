/**
 * Runs the real server code of "Create Group" (./groupOperations.server.ts, ./groupMessages.server.ts) against an
 * in-memory stand-in for the three things it talks to: the database (users and teacher/family links), Firestore
 * (chats/{id}: get, create) and Cloudinary (checking and deleting uploads). Nothing else is faked: the rules about
 * who may start a group and who may be added are the production ones.
 */
import assert from "node:assert/strict";
import Module from "node:module";
import { beforeEach, before, describe, it } from "node:test";

/* -------------------------------------------------------------------------------------------------
 * The fakes
 * ---------------------------------------------------------------------------------------------- */

// A type alias, not an interface: it has to be usable as a plain record of columns.
type UserRow = {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    role: "admin" | "teacher" | "family";
    status: "active" | "suspended" | "banned";
    imageUrl: string | null;
};

type Row = Record<string, unknown>;
type Predicate = (row: Row) => boolean;

const world = {
    users: [] as UserRow[],
    links: [] as { teacherId: string; familyId: string }[],
    chats: new Map<string, Record<string, unknown>>(),
    destroyed: [] as { publicId: string; resourceType: string }[],
    /** What Cloudinary says about the uploaded photo (null = behave like an unconfigured Cloudinary). */
    photo: { type: "image", mimeType: "image/jpeg" } as { type: string; mimeType: string } | null,
    /** Runs between "is there a document?" and "create it": lets a test play the second of two racing requests. */
    beforeCreate: null as null | (() => void),
    failCreateWith: null as unknown,
};

/** SQL LIKE (with \ as the escape character) as a case-insensitive test. */
function like(value: string, pattern: string): boolean {
    let source = "";
    for (let i = 0; i < pattern.length; i++) {
        const character = pattern[i];
        if (character === "\\") source += (pattern[++i] ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        else if (character === "%") source += ".*";
        else if (character === "_") source += ".";
        else source += character.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
    return new RegExp(`^${source}$`, "is").test(value);
}

const column = (name: string) => ({
    eq: (value: unknown): Predicate => (row) => row[name] === value,
    neq: (value: unknown): Predicate => (row) => row[name] !== value,
    in: (values: unknown[]): Predicate => (row) => values.includes(row[name]),
    ilike: (pattern: string): Predicate => (row) => like(String(row[name] ?? ""), pattern),
    asc: () => ({ name, direction: 1 }),
});
const columns = new Proxy({}, { get: (_target, name: string) => column(name) }) as Record<string, ReturnType<typeof column>>;

function table(rows: () => Row[]) {
    const build = (filters: Predicate[], sorts: { name: string; direction: number }[], max: number, joinFamily: boolean) => ({
        where(condition: ((c: typeof columns) => Predicate) | Row) {
            const predicate: Predicate =
                typeof condition === "function"
                    ? condition(columns)
                    : (row) => Object.entries(condition).every(([key, value]) => row[key] === value);
            return build([...filters, predicate], sorts, max, joinFamily);
        },
        select: () => build(filters, sorts, max, joinFamily),
        include: () => build(filters, sorts, max, true),
        orderBy: (list: ((c: typeof columns) => { name: string; direction: number })[]) =>
            build(filters, list.map((sort) => sort(columns)), max, joinFamily),
        limit: (count: number) => build(filters, sorts, count, joinFamily),
        async all() {
            let found = rows().filter((row) => filters.every((filter) => filter(row)));
            for (const { name, direction } of [...sorts].reverse()) {
                found = [...found].sort((a, b) => String(a[name]).localeCompare(String(b[name])) * direction);
            }
            found = found.slice(0, max);
            return joinFamily ? found.map((row) => ({ ...row, family: world.users.find((user) => user.id === row.familyId) ?? null })) : found;
        },
    });
    return build([], [], Infinity, false);
}

class FakeChatApiError extends Error {
    constructor(
        readonly code: string,
        message: string,
        readonly status: number
    ) {
        super(message);
        this.name = "ChatApiError";
    }
}

const snapshotOf = (id: string, data: Record<string, unknown> | undefined) => ({
    id,
    exists: data !== undefined,
    data: () => data,
    get: (field: string) => data?.[field],
});

const stubs: Record<string, unknown> = {
    "@prisma/orm-postgres/orm-client": { or: (...predicates: Predicate[]): Predicate => (row) => predicates.some((p) => p(row)) },
    "@/prisma/db": { db: { orm: { public: { User: table(() => world.users), TeacherFamily: table(() => world.links) } } } },
    "@/lib/config/firebase-admin": {
        firebaseAdminDB: {
            collection: () => ({
                doc: (id: string) => ({
                    get: async () => snapshotOf(id, world.chats.get(id)),
                    create: async (data: Record<string, unknown>) => {
                        world.beforeCreate?.();
                        if (world.failCreateWith) throw world.failCreateWith;
                        if (world.chats.has(id)) throw Object.assign(new Error("already exists"), { code: 6 });
                        world.chats.set(id, data);
                    },
                }),
            }),
        },
    },
    "./messageOperations.server": { ChatApiError: FakeChatApiError },
    "./attachments.server": {
        createUploadTickets: async (_actor: string, chatId: string, files: unknown[]) =>
            files.map((_file, index) => ({ ok: true, ticket: { publicId: `easy-arabic/chat/${chatId}/u/${index}` } })),
        destroyUploadedAssets: async (assets: { publicId: string; resourceType: string }[]) => {
            world.destroyed.push(...assets);
        },
        resolveAttachments: async (_actor: string, _chatId: string, attachments: { publicId: string }[]) => {
            if (!world.photo) throw new FakeChatApiError("ATTACHMENTS_UNAVAILABLE", "Sending files isn't available right now.", 503);
            return attachments.map((attachment) => ({
                ...world.photo,
                publicId: attachment.publicId,
                url: `https://res.cloudinary.com/demo/image/upload/v1/${attachment.publicId}.jpg`,
            }));
        },
    },
};

// The code under test is loaded as CommonJS by tsx, so a request for one of the stubbed modules can be answered here.
const moduleInternals = Module as unknown as { _load: (request: string, ...rest: unknown[]) => unknown };
const originalLoad = moduleInternals._load;
moduleInternals._load = function (request: string, ...rest: unknown[]) {
    return request in stubs ? stubs[request] : originalLoad.call(this, request, ...rest);
};

/* -------------------------------------------------------------------------------------------------
 * The cast
 * ---------------------------------------------------------------------------------------------- */

const user = (id: string, name: string, role: UserRow["role"], extra: Partial<UserRow> = {}): UserRow => ({
    id,
    name,
    email: `${name.toLowerCase().replace(/\s+/g, ".")}@example.com`,
    phone: null,
    role,
    status: "active",
    imageUrl: null,
    ...extra,
});

const ADMIN = user("admin-1", "Mahmoud Admin", "admin");
const TEACHER = user("teacher-1", "Hala Teacher", "teacher");
const OTHER_TEACHER = user("teacher-2", "Nour Teacher", "teacher");
const SARA = user("family-sara", "Sara Hassan", "family", { phone: "+201001112222", imageUrl: "https://img/sara.png" });
const OMAR = user("family-omar", "Omar Nabil", "family");
const LAYLA = user("family-layla", "Layla Samir", "family");
const BANNED = user("family-banned", "Banned Family", "family", { status: "banned" });
const SUSPENDED = user("family-suspended", "Suspended Family", "family", { status: "suspended" });

const GROUP_ID = "grp-AbCdEfGhIjKlMnOpQrStU";
const ANOTHER_GROUP_ID = "grp-ZyXwVuTsRqPoNmLkJiHgF";

const actorOf = (row: UserRow) => ({ id: row.id, name: row.name, role: row.role, imageUrl: row.imageUrl ?? undefined });

beforeEach(() => {
    world.users = [ADMIN, TEACHER, OTHER_TEACHER, SARA, OMAR, LAYLA, BANNED, SUSPENDED];
    world.links = [SARA, OMAR, BANNED].map((family) => ({ teacherId: TEACHER.id, familyId: family.id }));
    world.chats = new Map();
    world.destroyed = [];
    world.photo = { type: "image", mimeType: "image/jpeg" };
    world.beforeCreate = null;
    world.failCreateWith = null;
});

type Operations = typeof import("./groupOperations.server");
let ops: Operations;
before(async () => {
    ops = await import("./groupOperations.server");
});

const request = (overrides: Record<string, unknown> = {}) =>
    ({ groupId: GROUP_ID, name: "Parents", memberIds: [SARA.id, OMAR.id], ...overrides }) as Parameters<Operations["createGroup"]>[0]["request"];

const photoRequest = { publicId: `easy-arabic/chat/${GROUP_ID}/admin-1/abc`, resourceType: "image" as const, version: 1700000000, fileName: "photo.jpg" };

const rejects = async (promise: Promise<unknown>, expected: { code: string; status?: number }) => {
    await assert.rejects(promise, (error: unknown) => {
        const e = error as { code?: string; status?: number };
        assert.equal(e.code, expected.code);
        if (expected.status) assert.equal(e.status, expected.status);
        return true;
    });
};

/* -------------------------------------------------------------------------------------------------
 * Creating a group
 * ---------------------------------------------------------------------------------------------- */

describe("createGroup", () => {
    it("stores the group where the sidebar and the chat machinery already look: chats/{id} with participants", async () => {
        const result = await ops.createGroup({ actor: actorOf(ADMIN), request: request() });

        assert.equal(result.created, true);
        assert.deepEqual(result.group, { id: GROUP_ID, name: "Parents", description: "", imageUrl: null, memberCount: 3 });
        assert.deepEqual(result.announce, { groupName: "Parents", memberIds: [SARA.id, OMAR.id] });

        const stored = world.chats.get(GROUP_ID);
        assert.ok(stored);
        assert.equal(stored.category, "group");
        assert.equal(stored.id, GROUP_ID);
        assert.deepEqual(stored.participants, [ADMIN.id, SARA.id, OMAR.id]); // the creator first
        assert.equal(stored.createdBy, ADMIN.id);
        assert.deepEqual(stored.admins, [ADMIN.id]);
        assert.deepEqual(stored.unreadCount, { [ADMIN.id]: 0, [SARA.id]: 0, [OMAR.id]: 0 });
        assert.equal(stored.lastMessage, "");
        assert.equal(stored.isRead, true);
        // The sidebar orders by `updatedAt` and the history by `time`: without both the group would never show up.
        assert.ok(stored.updatedAt && stored.createdAt);
        assert.equal(typeof stored.time, "string");
        assert.ok(!Number.isNaN(Date.parse(stored.time as string)));
        // What the screen needs to draw a member, and nothing private (no email, no phone).
        assert.deepEqual(stored.members, {
            [ADMIN.id]: { name: ADMIN.name, role: "admin" },
            [SARA.id]: { name: SARA.name, role: "family", imageUrl: "https://img/sara.png" },
            [OMAR.id]: { name: OMAR.name, role: "family" },
        });
        assert.ok(!JSON.stringify(stored).includes("example.com"));
        assert.ok(!JSON.stringify(stored).includes("+2010"));
    });

    it("is safe to repeat: the same request answers with the group it already made, and makes no second one", async () => {
        const first = await ops.createGroup({ actor: actorOf(ADMIN), request: request() });
        const second = await ops.createGroup({ actor: actorOf(ADMIN), request: request() });

        assert.equal(first.created, true);
        assert.equal(second.created, false);
        assert.equal(second.announce, null); // nobody is told twice
        assert.deepEqual(second.group, first.group);
        assert.equal(world.chats.size, 1);
    });

    it("survives two identical requests racing: the one that loses the create() is answered as a repeat", async () => {
        world.beforeCreate = () => {
            // The other request got there between our check and our create.
            world.chats.set(GROUP_ID, { category: "group", createdBy: ADMIN.id, name: "Parents", participants: [ADMIN.id, SARA.id, OMAR.id] });
            world.beforeCreate = null;
        };
        const result = await ops.createGroup({ actor: actorOf(ADMIN), request: request() });
        assert.equal(result.created, false);
        assert.equal(result.group.name, "Parents");
        assert.equal(world.chats.size, 1);
    });

    it("never hands somebody else's group to a request that happens to use its id", async () => {
        await ops.createGroup({ actor: actorOf(ADMIN), request: request() });
        await rejects(ops.createGroup({ actor: actorOf(TEACHER), request: request({ memberIds: [SARA.id] }) }), { code: "GROUP_ID_TAKEN", status: 409 });
        assert.equal(world.chats.get(GROUP_ID)?.createdBy, ADMIN.id);
    });

    it("puts each person in once, and the creator is never added to their own list", async () => {
        const result = await ops.createGroup({
            actor: actorOf(ADMIN),
            request: request({ memberIds: [SARA.id, ADMIN.id, SARA.id, OMAR.id, OMAR.id] }),
        });
        assert.deepEqual(world.chats.get(GROUP_ID)?.participants, [ADMIN.id, SARA.id, OMAR.id]);
        assert.equal(result.group.memberCount, 3);
    });

    it("needs somebody besides the creator", async () => {
        await rejects(ops.createGroup({ actor: actorOf(ADMIN), request: request({ memberIds: [ADMIN.id] }) }), { code: "NO_MEMBERS", status: 400 });
        assert.equal(world.chats.size, 0);
    });

    it("refuses people who don't exist, naming exactly them, and creates nothing", async () => {
        await assert.rejects(
            ops.createGroup({ actor: actorOf(ADMIN), request: request({ memberIds: [SARA.id, "ghost", "phantom"] }) }),
            (error: unknown) => {
                assert.ok(error instanceof ops.InvalidGroupMembersError);
                assert.equal(error.code, "INVALID_MEMBERS");
                assert.equal(error.status, 422);
                assert.deepEqual(error.memberIds, ["ghost", "phantom"]);
                return true;
            }
        );
        assert.equal(world.chats.size, 0);
    });

    it("refuses accounts that aren't active, whoever asks", async () => {
        await assert.rejects(ops.createGroup({ actor: actorOf(ADMIN), request: request({ memberIds: [SARA.id, BANNED.id, SUSPENDED.id] }) }), (error: unknown) => {
            assert.ok(error instanceof ops.InvalidGroupMembersError);
            assert.deepEqual(error.memberIds, [BANNED.id, SUSPENDED.id]);
            return true;
        });
        await assert.rejects(ops.createGroup({ actor: actorOf(TEACHER), request: request({ memberIds: [BANNED.id] }) }), ops.InvalidGroupMembersError);
    });

    it("lets a teacher add their own families and nobody else", async () => {
        const ok = await ops.createGroup({ actor: actorOf(TEACHER), request: request({ memberIds: [SARA.id, OMAR.id] }) });
        assert.equal(ok.created, true);

        // Layla is an active family, but not this teacher's; admins and other teachers are not their families either.
        await assert.rejects(
            ops.createGroup({ actor: actorOf(TEACHER), request: request({ groupId: ANOTHER_GROUP_ID, memberIds: [SARA.id, LAYLA.id, ADMIN.id, OTHER_TEACHER.id] }) }),
            (error: unknown) => {
                assert.ok(error instanceof ops.InvalidGroupMembersError);
                assert.deepEqual(error.memberIds, [LAYLA.id, ADMIN.id, OTHER_TEACHER.id]);
                return true;
            }
        );
        assert.equal(world.chats.has(ANOTHER_GROUP_ID), false);
    });

    it("lets an admin add anybody with an active account: families, teachers and other admins", async () => {
        const result = await ops.createGroup({ actor: actorOf(ADMIN), request: request({ memberIds: [LAYLA.id, OTHER_TEACHER.id, TEACHER.id] }) });
        assert.equal(result.group.memberCount, 4);
    });

    it("is not for families, whatever they send", async () => {
        await rejects(ops.createGroup({ actor: actorOf(SARA), request: request({ memberIds: [OMAR.id] }) }), { code: "FORBIDDEN", status: 403 });
        assert.equal(world.chats.size, 0);
    });

    it("keeps the description and the cleaned name", async () => {
        const result = await ops.createGroup({ actor: actorOf(ADMIN), request: request({ name: "Math", description: "Weekly news" }) });
        assert.equal(result.group.description, "Weekly news");
        assert.equal(world.chats.get(GROUP_ID)?.description, "Weekly news");
    });

    describe("the group photo", () => {
        it("is stored when Cloudinary confirms a picture the browser can draw", async () => {
            const result = await ops.createGroup({ actor: actorOf(ADMIN), request: request({ photo: photoRequest }) });
            assert.match(result.group.imageUrl ?? "", /^https:\/\/res\.cloudinary\.com\//);
            assert.equal(world.chats.get(GROUP_ID)?.imagePublicId, photoRequest.publicId);
            assert.equal(world.destroyed.length, 0);
        });

        it("is refused, and deleted from Cloudinary, when it isn't a JPG, PNG or WebP picture", async () => {
            world.photo = { type: "image", mimeType: "image/heic" };
            await rejects(ops.createGroup({ actor: actorOf(ADMIN), request: request({ photo: photoRequest }) }), { code: "INVALID_PHOTO", status: 400 });
            assert.deepEqual(world.destroyed, [{ publicId: photoRequest.publicId, resourceType: "image" }]);
            assert.equal(world.chats.size, 0);

            world.photo = { type: "video", mimeType: "video/mp4" };
            await rejects(ops.createGroup({ actor: actorOf(ADMIN), request: request({ photo: photoRequest }) }), { code: "INVALID_PHOTO" });
        });

        it("says so plainly when pictures can't be handled right now, and makes no group", async () => {
            world.photo = null;
            await rejects(ops.createGroup({ actor: actorOf(ADMIN), request: request({ photo: photoRequest }) }), { code: "PHOTO_UNAVAILABLE", status: 503 });
            assert.equal(world.chats.size, 0);
        });

        it("is deleted from Cloudinary when the group could not be stored after all", async () => {
            world.failCreateWith = new Error("firestore is down");
            await assert.rejects(ops.createGroup({ actor: actorOf(ADMIN), request: request({ photo: photoRequest }) }), /firestore is down/);
            assert.deepEqual(world.destroyed, [{ publicId: photoRequest.publicId, resourceType: "image" }]);
        });

        it("is left alone by a repeat of a request that already worked (the group owns it)", async () => {
            await ops.createGroup({ actor: actorOf(ADMIN), request: request({ photo: photoRequest }) });
            await ops.createGroup({ actor: actorOf(ADMIN), request: request({ photo: photoRequest }) });
            assert.equal(world.destroyed.length, 0);
            assert.equal(world.chats.size, 1);
        });
    });
});

/* -------------------------------------------------------------------------------------------------
 * The people the picker lists
 * ---------------------------------------------------------------------------------------------- */

describe("listGroupCandidates", () => {
    it("shows an admin everybody active but themselves, by name, with no contact details", async () => {
        const { people, hasMore } = await ops.listGroupCandidates(actorOf(ADMIN), "");
        assert.equal(hasMore, false);
        assert.deepEqual(
            people.map((person) => person.name),
            ["Hala Teacher", "Layla Samir", "Nour Teacher", "Omar Nabil", "Sara Hassan"]
        );
        assert.ok(!people.some((person) => [BANNED.id, SUSPENDED.id, ADMIN.id].includes(person.id)));
        assert.deepEqual(Object.keys(people[0]).sort(), ["id", "imageUrl", "name", "role"]);
    });

    it("narrows by name, email or phone, ignoring case, and treats % and _ as ordinary characters", async () => {
        assert.deepEqual((await ops.listGroupCandidates(actorOf(ADMIN), "SARA")).people.map((p) => p.id), [SARA.id]);
        assert.deepEqual((await ops.listGroupCandidates(actorOf(ADMIN), "omar.nabil@")).people.map((p) => p.id), [OMAR.id]);
        assert.deepEqual((await ops.listGroupCandidates(actorOf(ADMIN), "1112222")).people.map((p) => p.id), [SARA.id]);
        assert.equal((await ops.listGroupCandidates(actorOf(ADMIN), "%")).people.length, 0);
        assert.equal((await ops.listGroupCandidates(actorOf(ADMIN), "_")).people.length, 0);
        assert.equal((await ops.listGroupCandidates(actorOf(ADMIN), "zzz")).people.length, 0);
    });

    it("says there are more people than listed, instead of silently cutting the list", async () => {
        world.users = [ADMIN, ...Array.from({ length: ops.CANDIDATE_LIMIT + 5 }, (_, n) => user(`f-${n}`, `Family ${String(n).padStart(3, "0")}`, "family"))];
        const { people, hasMore } = await ops.listGroupCandidates(actorOf(ADMIN), "");
        assert.equal(people.length, ops.CANDIDATE_LIMIT);
        assert.equal(hasMore, true);
    });

    it("shows a teacher only their own active families, narrowed the same way", async () => {
        const all = await ops.listGroupCandidates(actorOf(TEACHER), "");
        assert.deepEqual(all.people.map((p) => p.id), [OMAR.id, SARA.id]); // by name; Banned is inactive, Layla is not theirs
        assert.deepEqual((await ops.listGroupCandidates(actorOf(TEACHER), "sar")).people.map((p) => p.id), [SARA.id]);
        assert.equal((await ops.listGroupCandidates(actorOf(TEACHER), "layla")).people.length, 0);
    });

    it("is not for families", async () => {
        await rejects(ops.listGroupCandidates(actorOf(SARA), ""), { code: "FORBIDDEN", status: 403 });
    });
});

/* -------------------------------------------------------------------------------------------------
 * Upload tickets
 * ---------------------------------------------------------------------------------------------- */

describe("createGroupUploadTickets", () => {
    const jpg = { name: "a.jpg", size: 1000, mimeType: "image/jpeg" };

    it("signs the picture of a group that is about to exist", async () => {
        const [result] = await ops.createGroupUploadTickets(actorOf(ADMIN), { purpose: "photo", groupId: GROUP_ID, file: jpg });
        assert.equal(result.ok, true);
    });

    it("refuses a photo that isn't a JPG, PNG or WebP picture, before signing anything", async () => {
        for (const file of [
            { name: "a.heic", size: 1000, mimeType: "image/heic" },
            { name: "a.gif", size: 1000, mimeType: "image/gif" },
            { name: "a.mp4", size: 1000, mimeType: "video/mp4" },
            { name: "a.pdf", size: 1000, mimeType: "application/pdf" },
            { name: "a.exe", size: 1000, mimeType: "application/x-msdownload" },
        ]) {
            const [result] = await ops.createGroupUploadTickets(actorOf(ADMIN), { purpose: "photo", groupId: GROUP_ID, file });
            assert.equal(result.ok, false, file.name);
        }
    });

    it("keeps group photos for the people who can create groups", async () => {
        await rejects(ops.createGroupUploadTickets(actorOf(SARA), { purpose: "photo", groupId: GROUP_ID, file: jpg }), { code: "FORBIDDEN", status: 403 });
    });

    it("signs files for a group only for its members", async () => {
        await ops.createGroup({ actor: actorOf(ADMIN), request: request() });
        const files = [jpg, { name: "b.pdf", size: 10, mimeType: "application/pdf" }];

        const results = await ops.createGroupUploadTickets(actorOf(SARA), { purpose: "message", groupId: GROUP_ID, files });
        assert.equal(results.length, 2);

        await rejects(ops.createGroupUploadTickets(actorOf(LAYLA), { purpose: "message", groupId: GROUP_ID, files }), { code: "NOT_A_MEMBER", status: 403 });
        await rejects(ops.createGroupUploadTickets(actorOf(ADMIN), { purpose: "message", groupId: ANOTHER_GROUP_ID, files }), { code: "GROUP_NOT_FOUND", status: 404 });
    });

    it("does not treat a direct chat as a group", async () => {
        const directId = "grp-DirectChatLooksLikeIt1";
        world.chats.set(directId, { participants: [ADMIN.id, SARA.id] }); // no `category: "group"`
        await rejects(ops.createGroupUploadTickets(actorOf(ADMIN), { purpose: "message", groupId: directId, files: [jpg] }), { code: "GROUP_NOT_FOUND" });
    });
});

describe("normalizeMemberIds", () => {
    it("drops duplicates and the creator, keeping the order", () => {
        assert.deepEqual(ops.normalizeMemberIds(["b", "a", "b", "me", "c", "a"], "me"), ["b", "a", "c"]);
    });
});
