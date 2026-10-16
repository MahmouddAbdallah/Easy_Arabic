import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FieldPath } from "firebase-admin/firestore";
import {
    GROUP_MAX_ADDED_MEMBERS,
    GROUP_NAME_MAX_LENGTH,
    canCreateGroup,
    colorIndexOf,
    describeMembers,
    getGroupPhotoUrl,
    getGroupPreview,
    isGroupId,
    newGroupId,
    normalizeGroupText,
    readGroup,
    validateGroupDescription,
    validateGroupName,
    type GroupMember,
} from "./groups";
import { CreateGroupRequestSchema, GroupCandidatesQuerySchema, GroupUploadRequestSchema } from "./groupSchemas";
import { groupUnreadUpdates } from "./groupUnread.server";
import { MessageRequestSchema } from "./schemas";
import { getChatId } from "./chatId";

const GROUP_ID = "grp-AbCdEfGhIjKlMnOpQrStU";
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

describe("normalizeGroupText", () => {
    it("trims and collapses whitespace, tabs and line breaks into single spaces", () => {
        assert.equal(normalizeGroupText("  Math \t  parents \n group  "), "Math parents group");
    });

    it("removes characters that can disguise a name (bidi overrides, zero-width space, BOM) and control characters", () => {
        assert.equal(normalizeGroupText("Ad\u202Emin\u200B\uFEFF"), "Admin");
        assert.equal(normalizeGroupText("a\u0007b"), "a b");
    });

    it("keeps what Arabic and Persian text legitimately uses (RLM, ZWNJ)", () => {
        assert.equal(normalizeGroupText("مجموعة\u200F الأسرة"), "مجموعة\u200F الأسرة");
        assert.equal(normalizeGroupText("می\u200Cخواهم"), "می\u200Cخواهم");
    });

    it("is idempotent", () => {
        const once = normalizeGroupText("  A \u202E b  ");
        assert.equal(normalizeGroupText(once), once);
    });
});

describe("validateGroupName / validateGroupDescription", () => {
    it("needs something besides spaces", () => {
        assert.ok(validateGroupName(""));
        assert.ok(validateGroupName("   \n\t "));
        assert.ok(validateGroupName("\u200B\u200B"));
        assert.equal(validateGroupName("Class 5"), null);
    });

    it("counts characters, not UTF-16 units: emoji and Arabic letters count once", () => {
        assert.equal(validateGroupName("x".repeat(GROUP_NAME_MAX_LENGTH)), null);
        assert.ok(validateGroupName("x".repeat(GROUP_NAME_MAX_LENGTH + 1)));
        assert.equal(validateGroupName("😀".repeat(GROUP_NAME_MAX_LENGTH)), null);
        assert.ok(validateGroupName("😀".repeat(GROUP_NAME_MAX_LENGTH + 1)));
    });

    it("lets a description be empty and caps it", () => {
        assert.equal(validateGroupDescription(""), null);
        assert.equal(validateGroupDescription("x".repeat(200)), null);
        assert.ok(validateGroupDescription("x".repeat(201)));
    });
});

describe("group ids", () => {
    it("are shaped as grp- plus 21 letters or digits, and never repeat", () => {
        const ids = new Set(Array.from({ length: 2000 }, () => newGroupId()));
        assert.equal(ids.size, 2000);
        for (const id of ids) assert.match(id, /^grp-[A-Za-z0-9]{21}$/);
    });

    it("can never be the id of a direct chat (those always join two ids with an underscore)", () => {
        assert.ok(!newGroupId().includes("_"));
        assert.equal(isGroupId(newGroupId()), true);
        assert.equal(isGroupId(getChatId(uuid(1), uuid(2))), false);
        assert.equal(isGroupId("grp-short"), false);
        assert.equal(isGroupId(`${GROUP_ID}x`), false);
        assert.equal(isGroupId(null), false);
        assert.equal(isGroupId(42), false);
    });
});

describe("canCreateGroup", () => {
    it("is for teachers and admins only", () => {
        assert.equal(canCreateGroup("admin"), true);
        assert.equal(canCreateGroup("teacher"), true);
        assert.equal(canCreateGroup("family"), false);
        assert.equal(canCreateGroup(undefined), false);
        assert.equal(canCreateGroup(null), false);
        assert.equal(canCreateGroup("ADMIN"), false);
    });
});

describe("readGroup", () => {
    const stored = {
        category: "group",
        name: "  Parents  ",
        description: "Weekly news",
        imageUrl: "https://res.cloudinary.com/demo/image/upload/v1/x/y.jpg",
        createdBy: uuid(1),
        admins: [uuid(1)],
        participants: [uuid(1), uuid(2), uuid(3)],
        members: { [uuid(1)]: { name: "Mahmoud", role: "admin" }, [uuid(2)]: { name: "Sara", role: "family", imageUrl: "https://x/y.png" } },
        createdAt: { toDate: () => new Date("2026-10-15T10:00:00Z") },
    };

    it("reads a group, members in participant order", () => {
        const group = readGroup("grp-1", stored);
        assert.ok(group);
        assert.equal(group.name, "Parents");
        assert.deepEqual(group.members.map((m) => m.id), [uuid(1), uuid(2), uuid(3)]);
        assert.equal(group.members[1].imageUrl, "https://x/y.png");
        assert.equal(group.createdAt?.toISOString(), "2026-10-15T10:00:00.000Z");
    });

    it("is not fooled by a direct chat, a missing document or junk", () => {
        assert.equal(readGroup("x", { participants: [uuid(1), uuid(2)] }), null);
        assert.equal(readGroup("x", undefined), null);
        assert.equal(readGroup("x", { category: "direct" }), null);
    });

    it("never trusts the shape: a member without a profile is still listed, and bad values are ignored", () => {
        const group = readGroup("g", { category: "group", name: 5, participants: [uuid(9), 7, ""], members: "nope", admins: "nope", createdAt: "yesterday" });
        assert.ok(group);
        assert.equal(group.name, "Group");
        assert.deepEqual(group.members, [{ id: uuid(9), name: "Member", role: null, imageUrl: null }]);
        assert.deepEqual(group.admins, []);
        assert.equal(group.createdAt, null);
    });
});

describe("getGroupPreview", () => {
    const members = { me: { name: "Mahmoud Ali" }, sara: { name: "Sara Hassan" } };

    it("puts who wrote the last message in front of it", () => {
        assert.equal(getGroupPreview({ lastMessage: "ok", lastSenderId: "me", members }, "me"), "You: ok");
        assert.equal(getGroupPreview({ lastMessage: "ok", lastSenderId: "sara", members }, "me"), "Sara: ok");
        assert.equal(getGroupPreview({ lastMessage: "ok" }, "me"), "ok");
        assert.equal(getGroupPreview({ lastMessage: "ok", lastSenderId: "gone", members }, "me"), "ok");
    });

    it("says who created the group while nothing has been written", () => {
        assert.equal(getGroupPreview({ lastMessage: "", createdBy: "me", members }, "me"), "You created this group");
        assert.equal(getGroupPreview({ lastMessage: "", createdBy: "sara", members }, "me"), "Sara created this group");
        assert.equal(getGroupPreview({ lastMessage: "" }, "me"), "Group created");
    });
});

describe("describeMembers", () => {
    const member = (id: string, name: string): GroupMember => ({ id, name, role: null, imageUrl: null });

    it("lists the current user first as You, then first names in the order they were added", () => {
        const members = [member("a", "Sara Hassan"), member("me", "Mahmoud Ali"), member("b", "Omar Nabil")];
        assert.equal(describeMembers(members, "me"), "You, Sara, Omar");
        assert.equal(describeMembers(members, "someone-else"), "Sara, Mahmoud, Omar");
    });
});

describe("getGroupPhotoUrl", () => {
    it("asks Cloudinary for a square crop in the best format", () => {
        assert.equal(
            getGroupPhotoUrl("https://res.cloudinary.com/demo/image/upload/v123/easy-arabic/chat/grp-x/u/abc.jpg", 96),
            "https://res.cloudinary.com/demo/image/upload/c_fill,g_auto,w_96,h_96/f_auto/q_auto/v123/easy-arabic/chat/grp-x/u/abc"
        );
    });

    it("leaves other URLs alone and handles no photo", () => {
        assert.equal(getGroupPhotoUrl("https://example.com/a.png", 96), "https://example.com/a.png");
        assert.equal(getGroupPhotoUrl(null, 96), undefined);
        assert.equal(getGroupPhotoUrl("", 96), undefined);
    });
});

describe("colorIndexOf", () => {
    it("is stable and within range", () => {
        for (let n = 0; n < 50; n++) {
            const index = colorIndexOf(uuid(n), 8);
            assert.ok(index >= 0 && index < 8);
            assert.equal(index, colorIndexOf(uuid(n), 8));
        }
    });
});

describe("CreateGroupRequestSchema", () => {
    const valid = { groupId: GROUP_ID, name: "Parents", memberIds: [uuid(2), uuid(3)] };

    it("accepts a request and cleans the name and description", () => {
        const parsed = CreateGroupRequestSchema.parse({ ...valid, name: "  Math \u202E parents ", description: "  hello \n world " });
        assert.equal(parsed.name, "Math parents");
        assert.equal(parsed.description, "hello world");
    });

    it("refuses what the form would have refused, with the same words", () => {
        const refused = (input: unknown) => {
            const result = CreateGroupRequestSchema.safeParse(input);
            assert.equal(result.success, false);
            return result.success ? "" : result.error.issues[0].message;
        };
        assert.equal(refused({ ...valid, name: "   " }), "Give the group a name.");
        assert.equal(refused({ ...valid, name: undefined }), "Give the group a name.");
        assert.match(refused({ ...valid, name: "x".repeat(61) }), /up to 60 characters/);
        assert.match(refused({ ...valid, memberIds: [] }), /at least one person/i);
        assert.match(refused({ ...valid, memberIds: Array.from({ length: GROUP_MAX_ADDED_MEMBERS + 1 }, (_, n) => uuid(n)) }), /up to 50 people/);
        assert.match(refused({ ...valid, description: "x".repeat(201) }), /up to 200 characters/);
    });

    it("refuses a bad group id, member ids that aren't ids, unknown keys and a photo that isn't a picture", () => {
        assert.equal(CreateGroupRequestSchema.safeParse({ ...valid, groupId: "abc" }).success, false);
        assert.equal(CreateGroupRequestSchema.safeParse({ ...valid, groupId: getChatId(uuid(1), uuid(2)) }).success, false);
        assert.equal(CreateGroupRequestSchema.safeParse({ ...valid, memberIds: ["../../x"] }).success, false);
        assert.equal(CreateGroupRequestSchema.safeParse({ ...valid, createdBy: "someone" }).success, false);

        const photo = { publicId: "easy-arabic/chat/g/u/abc", version: 1700000000, fileName: "a.jpg", resourceType: "image" as const };
        assert.equal(CreateGroupRequestSchema.safeParse({ ...valid, photo }).success, true);
        assert.equal(CreateGroupRequestSchema.safeParse({ ...valid, photo: { ...photo, resourceType: "video" } }).success, false);
        assert.equal(CreateGroupRequestSchema.safeParse({ ...valid, photo: { ...photo, kind: "voice" } }).success, false);
    });
});

describe("GroupCandidatesQuerySchema / GroupUploadRequestSchema", () => {
    it("cleans the search term and caps it", () => {
        assert.equal(GroupCandidatesQuerySchema.parse({ keyword: "  sa\u202Era " }).keyword, "sara");
        assert.equal(GroupCandidatesQuerySchema.parse({}).keyword, undefined);
        assert.equal(GroupCandidatesQuerySchema.safeParse({ keyword: "x".repeat(101) }).success, false);
    });

    it("tells a group photo from files for a message", () => {
        const file = { name: "a.jpg", size: 10, mimeType: "image/jpeg" };
        assert.equal(GroupUploadRequestSchema.safeParse({ purpose: "photo", groupId: GROUP_ID, file }).success, true);
        assert.equal(GroupUploadRequestSchema.safeParse({ purpose: "message", groupId: GROUP_ID, files: [file] }).success, true);
        assert.equal(GroupUploadRequestSchema.safeParse({ purpose: "message", groupId: GROUP_ID, files: [] }).success, false);
        assert.equal(GroupUploadRequestSchema.safeParse({ purpose: "photo", groupId: GROUP_ID, files: [file] }).success, false);
        assert.equal(GroupUploadRequestSchema.safeParse({ purpose: "other", groupId: GROUP_ID, file }).success, false);
    });
});

describe("the messages request", () => {
    it("still reads a direct message exactly as before", () => {
        const parsed = MessageRequestSchema.parse({ receiverId: uuid(2), text: "hi" });
        assert.equal(parsed.action, "send");
    });

    it("reads a group message by its own action, trims it and needs a valid group id", () => {
        const parsed = MessageRequestSchema.parse({ action: "sendGroup", groupId: GROUP_ID, text: "  hello  " });
        assert.equal(parsed.action, "sendGroup");
        assert.equal(parsed.action === "sendGroup" && parsed.text, "hello");
        assert.equal(MessageRequestSchema.safeParse({ action: "sendGroup", groupId: uuid(1), text: "x" }).success, false);
        assert.equal(MessageRequestSchema.safeParse({ action: "sendGroup", text: "x" }).success, false);
    });
});

describe("groupUnreadUpdates", () => {
    it("adds one to each recipient's own counter and marks the chat unread once", () => {
        const updates = groupUnreadUpdates({ a: 0, b: 2, c: 0 }, ["a", "b", "c"], ["b", "c"]);
        assert.equal(updates.length, 3);
        assert.ok(updates[0][0] instanceof FieldPath && updates[1][0] instanceof FieldPath);
        assert.deepEqual(updates[2], ["isRead", false]);
        assert.equal(updates.filter(([field]) => field === "isRead").length, 1);
    });

    it("replaces anything that isn't the per-user map instead of trusting it", () => {
        const updates = groupUnreadUpdates(3, ["a", "b", "c"], ["b", "c"]);
        assert.deepEqual(updates, [["unreadCount", { a: 0, b: 1, c: 1 }], ["isRead", false]]);
        assert.deepEqual(groupUnreadUpdates(undefined, ["a", "b"], ["b"])[0], ["unreadCount", { a: 0, b: 1 }]);
    });
});
