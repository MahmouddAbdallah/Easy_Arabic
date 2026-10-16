/**
 * Group chats: the rules and the shapes shared by the browser and the server. Pure helpers only (no
 * firebase-admin, no zod), so importing this never pulls server code into the client bundle.
 *
 * A group lives in the same collection as a direct chat, chats/{groupId}, so everything that already follows a
 * chat keeps working for it: the sidebar's query on `participants`, the per-user unread counters, the messages in
 * chats/{groupId}/messages, and edit / delete / react / mark-read (they only need the chat id and the participants).
 *
 *   category      "group"                     what tells it apart from a direct chat
 *   name          1..GROUP_NAME_MAX_LENGTH characters
 *   description?  up to GROUP_DESCRIPTION_MAX_LENGTH characters
 *   imageUrl?     the group photo (Cloudinary); imagePublicId is the handle to delete it
 *   participants  [userId, ...]               everybody in the group, the creator first (the field a direct chat has too)
 *   createdBy     userId
 *   admins        [userId, ...]               the creator, for now
 *   members       { [userId]: { name, role, imageUrl? } }   what the screen needs to draw a member without a lookup
 *   time          ISO time of the newest activity (the field a direct chat orders its history by)
 *   lastMessage, lastSenderId?, unreadCount, isRead, createdAt, updatedAt   exactly as in a direct chat
 *
 * Group ids start with "grp-" and have no underscore, while a direct chat's id always joins two user ids with
 * one (see chatId.ts), so the two kinds of id can never be the same string.
 */

/* -------------------------------------------------------------------------------------------------
 * Rules
 * ---------------------------------------------------------------------------------------------- */

export const GROUP_NAME_MAX_LENGTH = 60;
export const GROUP_DESCRIPTION_MAX_LENGTH = 200;

/** Everybody in a group, the person who creates it included. */
export const GROUP_MAX_PARTICIPANTS = 50;
/** Everybody except the creator. */
export const GROUP_MAX_ADDED_MEMBERS = GROUP_MAX_PARTICIPANTS - 1;

/** The roles that can start conversations (the same ones that can search for people), so the same ones that can start a group. */
export const GROUP_CREATOR_ROLES = ["admin", "teacher"] as const;

export function canCreateGroup(role: string | null | undefined): boolean {
    return GROUP_CREATOR_ROLES.some((allowed) => allowed === role);
}

export const GROUP_NAME_REQUIRED = "Give the group a name.";
export const GROUP_NAME_TOO_LONG = `Group names can be up to ${GROUP_NAME_MAX_LENGTH} characters.`;
export const GROUP_DESCRIPTION_TOO_LONG = `Descriptions can be up to ${GROUP_DESCRIPTION_MAX_LENGTH} characters.`;
export const GROUP_NEEDS_MEMBERS = "Add at least one person to the group.";
export const GROUP_TOO_MANY_MEMBERS = `A group can have up to ${GROUP_MAX_PARTICIPANTS} people, including you.`;

/* -------------------------------------------------------------------------------------------------
 * Ids
 * ---------------------------------------------------------------------------------------------- */

export const GROUP_ID_PREFIX = "grp-";
const GROUP_ID_RANDOM_LENGTH = 21;
export const GROUP_ID_PATTERN = /^grp-[A-Za-z0-9]{21}$/;

const ID_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

/**
 * A new group id (about 125 random bits). The browser makes it once per "New group" session and sends it with the
 * request, which is what makes creating a group safe to repeat: the same id is the same group, never a second one.
 */
export function newGroupId(): string {
    let random = "";
    while (random.length < GROUP_ID_RANDOM_LENGTH) {
        for (const byte of crypto.getRandomValues(new Uint8Array(32))) {
            // 248 = 4 * 62: larger values are skipped, so every character is equally likely.
            if (byte < 248 && random.length < GROUP_ID_RANDOM_LENGTH) random += ID_ALPHABET[byte % ID_ALPHABET.length];
        }
    }
    return GROUP_ID_PREFIX + random;
}

export function isGroupId(value: unknown): value is string {
    return typeof value === "string" && GROUP_ID_PATTERN.test(value);
}

/* -------------------------------------------------------------------------------------------------
 * Text
 * ---------------------------------------------------------------------------------------------- */

// Characters with no business in a name: zero-width space, word joiner, BOM, and the bidirectional overrides,
// embeddings and isolates that can make text read as something it isn't. (LRM, RLM and the joiners that Arabic and
// Persian text legitimately use are kept.)
const INVISIBLE_CHARACTERS = /[\u200b\u2060\ufeff\u202a-\u202e\u2066-\u2069]/g;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/g;

/** A single clean line: control and look-alike characters removed, whitespace collapsed and trimmed. Idempotent. */
export function normalizeGroupText(value: string): string {
    return value
        .normalize("NFC")
        .replace(INVISIBLE_CHARACTERS, "")
        .replace(CONTROL_CHARACTERS, " ")
        .replace(/\s+/g, " ")
        .trim();
}

/** What is wrong with a group name as typed, in words for the person; null when it is fine. */
export function validateGroupName(raw: string): string | null {
    const name = normalizeGroupText(raw);
    if (name.length === 0) return GROUP_NAME_REQUIRED;
    if (Array.from(name).length > GROUP_NAME_MAX_LENGTH) return GROUP_NAME_TOO_LONG;
    return null;
}

export function validateGroupDescription(raw: string): string | null {
    return Array.from(normalizeGroupText(raw)).length > GROUP_DESCRIPTION_MAX_LENGTH ? GROUP_DESCRIPTION_TOO_LONG : null;
}

/** "Sara Ali" -> "Sara". */
export function firstNameOf(name: string | null | undefined): string {
    return (name ?? "").trim().split(/\s+/)[0] ?? "";
}

export function formatMemberCount(count: number): string {
    return `${count} ${count === 1 ? "member" : "members"}`;
}

/* -------------------------------------------------------------------------------------------------
 * The group photo
 * ---------------------------------------------------------------------------------------------- */

/** What a browser can draw in an <img> everywhere: no HEIC, no AVIF, no animated GIF as a profile picture. */
export const GROUP_PHOTO_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

/** Value for the `accept` attribute of the photo picker. */
export const GROUP_PHOTO_ACCEPT = GROUP_PHOTO_MIME_TYPES.join(",");

const CLOUDINARY_IMAGE_URL = /^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.+)$/;

/**
 * The group photo cropped to a square of `size` px around the subject, in the best format the browser supports (the
 * same on-the-fly transformation the message thumbnails use), so a list of groups doesn't download full-size
 * originals. Anything that isn't a Cloudinary delivery URL is returned as it is.
 */
export function getGroupPhotoUrl(url: string | null | undefined, size: number): string | undefined {
    if (!url) return undefined;
    const match = CLOUDINARY_IMAGE_URL.exec(url);
    if (!match) return url;
    const publicPath = match[2].replace(/\.[A-Za-z0-9]{1,8}$/, "");
    return `${match[1]}c_fill,g_auto,w_${size},h_${size}/f_auto/q_auto/${publicPath}`;
}

/* -------------------------------------------------------------------------------------------------
 * Shapes
 * ---------------------------------------------------------------------------------------------- */

/** A person who can be added to a group (what the member picker lists). Never an email or a phone number. */
export interface GroupCandidate {
    id: string;
    name: string;
    role: string | null;
    imageUrl: string | null;
}

export interface GroupMember {
    id: string;
    name: string;
    role: string | null;
    imageUrl: string | null;
}

/** A group as the screen needs it. */
export interface GroupInfo {
    id: string;
    name: string;
    description: string;
    imageUrl: string | null;
    createdBy: string;
    createdAt: Date | null;
    admins: string[];
    /** Everybody in the group, the creator first. */
    members: GroupMember[];
}

/** A group in the lists of the response of the API. */
export interface GroupSummary {
    id: string;
    name: string;
    description: string;
    imageUrl: string | null;
    memberCount: number;
}

/* -------------------------------------------------------------------------------------------------
 * Reading what is stored (the document is never trusted blindly)
 * ---------------------------------------------------------------------------------------------- */

type Loose = Record<string, unknown>;

const isRecord = (value: unknown): value is Loose => typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown): string => (typeof value === "string" ? value : "");
const textList = (value: unknown): string[] =>
    Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.length > 0) : [];

function toDate(value: unknown): Date | null {
    if (value instanceof Date) return value;
    if (isRecord(value) && typeof value.toDate === "function") {
        const date = (value as { toDate: () => unknown }).toDate();
        return date instanceof Date && !Number.isNaN(date.getTime()) ? date : null;
    }
    return null;
}

/** Is this chat document a group? */
export function isGroupChat(data: { category?: unknown } | null | undefined): boolean {
    return !!data && data.category === "group";
}

/** One member's stored profile, or an empty one. */
function profileOf(members: unknown, userId: string): Loose {
    if (!isRecord(members)) return {};
    const profile = members[userId];
    return isRecord(profile) ? profile : {};
}

/** The group stored in `data` (chats/{id}), or null when that document isn't a group. */
export function readGroup(id: string, data: Loose | null | undefined): GroupInfo | null {
    if (!data || !isGroupChat(data)) return null;

    const members = textList(data.participants).map((memberId): GroupMember => {
        const profile = profileOf(data.members, memberId);
        return {
            id: memberId,
            name: text(profile.name).trim() || "Member",
            role: text(profile.role) || null,
            imageUrl: text(profile.imageUrl) || null,
        };
    });

    return {
        id,
        name: text(data.name).trim() || "Group",
        description: text(data.description),
        imageUrl: text(data.imageUrl) || null,
        createdBy: text(data.createdBy),
        createdAt: toDate(data.createdAt),
        admins: textList(data.admins),
        members,
    };
}

/** The stored name of a member (their `members` entry), or null. */
export function memberNameOf(members: unknown, userId: string | null | undefined): string | null {
    if (!userId) return null;
    return text(profileOf(members, userId).name).trim() || null;
}

/* -------------------------------------------------------------------------------------------------
 * Wording
 * ---------------------------------------------------------------------------------------------- */

/** The part of a chat document the list row needs (everything is optional: the document is read as it is). */
export interface GroupRowSource {
    lastMessage?: string;
    lastSenderId?: string;
    createdBy?: string;
    members?: unknown;
}

/**
 * The line under a group's name in the chat list: the newest message with whoever wrote it in front ("You: ok",
 * "Sara: ok"), or, while nobody has written anything, who created the group.
 */
export function getGroupPreview(chat: GroupRowSource, currentUserId: string | null | undefined): string {
    const writer = (id: string | undefined) =>
        !id ? "" : id === currentUserId ? "You" : firstNameOf(memberNameOf(chat.members, id));

    if (chat.lastMessage) {
        const who = writer(chat.lastSenderId);
        return who ? `${who}: ${chat.lastMessage}` : chat.lastMessage;
    }

    const creator = writer(chat.createdBy);
    return creator ? `${creator} created this group` : "Group created";
}

/**
 * Who is in the group, for the line under its name in the conversation header: "You, Sara, Omar". The current user
 * comes first; the rest keep the order they were added in.
 */
export function describeMembers(members: readonly GroupMember[], currentUserId: string | null | undefined): string {
    const me = members.find((member) => member.id === currentUserId);
    const others = members.filter((member) => member.id !== currentUserId).map((member) => firstNameOf(member.name) || member.name);
    return [...(me ? ["You"] : []), ...others].join(", ");
}

/** A stable number for a user id, used to give each sender in a group their own colour. */
export function colorIndexOf(userId: string, buckets: number): number {
    let hash = 0;
    for (let index = 0; index < userId.length; index++) hash = (hash * 31 + userId.charCodeAt(index)) >>> 0;
    return hash % buckets;
}
