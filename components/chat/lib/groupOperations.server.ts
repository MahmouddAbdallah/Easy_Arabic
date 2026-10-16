/**
 * SERVER ONLY — uses firebase-admin and the database. Never import this from a client component.
 *
 * Creating a group, and everything the creation depends on:
 *
 *   who can start a group      teachers and admins: the same two roles that can search for people to talk to.
 *   who can be added           an admin can add anybody with an active account; a teacher only the families assigned
 *                              to them (the same people the sidebar search shows them). Checked here, whatever the
 *                              browser's list said: the list is a convenience, this is the rule.
 *   where it is stored         chats/{groupId} in Firestore (see ./groups.ts for the document), so it shows up in the
 *                              sidebar of every member the moment it exists, and nothing else has to know about it.
 *   safe to repeat             the browser picks the id. `create()` fails when the document exists, so a repeated
 *                              request (double click, retry after a dropped connection) is answered with the group that
 *                              request already made instead of making a second one.
 */
import { FieldValue, type DocumentSnapshot } from "firebase-admin/firestore";
import { or } from "@prisma/orm-postgres/orm-client";
import { firebaseAdminDB } from "@/lib/config/firebase-admin";
import { db } from "@/prisma/db";
import type { userType } from "@/types/userTypes";
import { validateAttachmentFile } from "./attachments";
import { createUploadTickets, destroyUploadedAssets, resolveAttachments } from "./attachments.server";
import {
    GROUP_MAX_ADDED_MEMBERS,
    GROUP_PHOTO_MIME_TYPES,
    canCreateGroup,
    readGroup,
    type GroupCandidate,
    type GroupSummary,
} from "./groups";
import type { CreateGroupRequest, GroupUploadRequest } from "./groupSchemas";
import { ChatApiError } from "./messageOperations.server";
import { assertGroupMember } from "./groupMessages.server";
import type { UploadTicketResult } from "../types";

/** The signed-in user, as far as groups are concerned. */
export type GroupActor = Pick<userType, "id" | "name" | "role" | "imageUrl">;

/** How many people the member picker lists at once; searching narrows it down. */
export const CANDIDATE_LIMIT = 50;

/** Chosen people the rules don't allow. Carries who, so the browser can take exactly them off the list. */
export class InvalidGroupMembersError extends ChatApiError {
    constructor(public readonly memberIds: string[]) {
        super(
            "INVALID_MEMBERS",
            memberIds.length === 1
                ? "One of the people you chose can't be added to this group. Remove them and try again."
                : "Some of the people you chose can't be added to this group. Remove them and try again.",
            422
        );
        this.name = "InvalidGroupMembersError";
    }
}

export function assertCanCreateGroups(role: string | null | undefined): void {
    if (!canCreateGroup(role)) {
        throw new ChatApiError("FORBIDDEN", "Only teachers and admins can create groups.", 403);
    }
}

/* -------------------------------------------------------------------------------------------------
 * Who can be added
 * ---------------------------------------------------------------------------------------------- */

interface PersonRow {
    id: string;
    name: string;
    role: string;
    status: string;
    imageUrl: string | null;
}

/** A search term as it is compared: case-insensitive, and with the accents of the Latin letters ignored. */
const fold = (value: string) =>
    value
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLocaleLowerCase();

/** `%`, `_` and `\` are wildcards in LIKE; a name containing one must match itself, not everything. */
const escapeLike = (value: string) => value.replace(/[\\%_]/g, (character) => `\\${character}`);

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" });

const toCandidate = (row: Pick<PersonRow, "id" | "name" | "role" | "imageUrl">): GroupCandidate => ({
    id: row.id,
    name: row.name,
    role: row.role ?? null,
    imageUrl: row.imageUrl ?? null,
});

/** Admins: every active account but their own, by name, narrowed by what was typed (name, email or phone). */
async function searchEveryone(actorId: string, keyword: string): Promise<PersonRow[]> {
    const pattern = `%${escapeLike(keyword)}%`;
    const everyone = db.orm.public.User.where((u) => u.status.eq("active")).where((u) => u.id.neq(actorId));
    const matching = keyword
        ? everyone.where((u) => or(u.name.ilike(pattern), u.email.ilike(pattern), u.phone.ilike(pattern)))
        : everyone;

    return (await matching
        .select("id", "name", "role", "status", "imageUrl")
        .orderBy([(u) => u.name.asc()])
        .limit(CANDIDATE_LIMIT + 1)
        .all()) as unknown as PersonRow[];
}

/** Teachers: the active families assigned to them. */
async function searchTeacherFamilies(teacherId: string, keyword: string): Promise<PersonRow[]> {
    const links = (await db.orm.public.TeacherFamily.where({ teacherId })
        .select("familyId")
        .include("family", (family) => family.select("id", "name", "email", "phone", "role", "status", "imageUrl"))
        .all()) as unknown as { family: (PersonRow & { email: string; phone: string | null }) | null }[];

    const wanted = fold(keyword);
    return links
        .map((link) => link.family)
        .filter((family): family is NonNullable<typeof family> => !!family && family.role === "family" && family.status === "active")
        .filter((family) => !wanted || [family.name, family.email, family.phone ?? ""].some((value) => fold(value).includes(wanted)))
        .sort(byName);
}

/** The people the member picker lists for `actor`, matching `keyword` (everybody they may add when it is empty). */
export async function listGroupCandidates(
    actor: GroupActor,
    keyword: string
): Promise<{ people: GroupCandidate[]; hasMore: boolean }> {
    assertCanCreateGroups(actor.role);

    const rows = actor.role === "admin" ? await searchEveryone(actor.id, keyword) : await searchTeacherFamilies(actor.id, keyword);
    return { people: rows.slice(0, CANDIDATE_LIMIT).map(toCandidate), hasMore: rows.length > CANDIDATE_LIMIT };
}

/**
 * The people with these ids, if every one of them may be added by `actor`; throws InvalidGroupMembersError naming
 * the ones that may not (unknown id, account that isn't active, and for a teacher anybody who isn't their family).
 * The result keeps the order of `ids`.
 */
export async function resolveGroupMembers(actor: GroupActor, ids: readonly string[]): Promise<PersonRow[]> {
    const wanted = [...ids];
    const [users, links] = await Promise.all([
        db.orm.public.User.where((u) => u.id.in(wanted)).select("id", "name", "role", "status", "imageUrl").all() as unknown as Promise<PersonRow[]>,
        actor.role === "teacher"
            ? (db.orm.public.TeacherFamily.where({ teacherId: actor.id })
                  .where((link) => link.familyId.in(wanted))
                  .select("familyId")
                  .all() as unknown as Promise<{ familyId: string }[]>)
            : Promise.resolve(null),
    ]);

    const assigned = links ? new Set(links.map((link) => link.familyId)) : null;
    const byId = new Map(users.map((user) => [user.id, user]));

    const members: PersonRow[] = [];
    const rejected: string[] = [];
    for (const id of wanted) {
        const user = byId.get(id);
        const allowed = !!user && user.status === "active" && (!assigned || (assigned.has(id) && user.role === "family"));
        if (allowed) members.push(user);
        else rejected.push(id);
    }

    if (rejected.length > 0) throw new InvalidGroupMembersError(rejected);
    return members;
}

/** Each id once, in the order they came, without `creatorId` (who is always in the group anyway). */
export function normalizeMemberIds(ids: readonly string[], creatorId: string): string[] {
    return [...new Set(ids)].filter((id) => id !== creatorId);
}

/* -------------------------------------------------------------------------------------------------
 * Creating the group
 * ---------------------------------------------------------------------------------------------- */

const summaryOf = (id: string, snap: DocumentSnapshot): GroupSummary => {
    const group = readGroup(id, snap.data());
    return {
        id,
        name: group?.name ?? "Group",
        description: group?.description ?? "",
        imageUrl: group?.imageUrl ?? null,
        memberCount: group?.members.length ?? 0,
    };
};

/** The uploaded photo, checked against Cloudinary, or a ChatApiError. Only a picture a browser can draw is accepted. */
async function resolvePhoto(actorId: string, groupId: string, photo: NonNullable<CreateGroupRequest["photo"]>) {
    let resolved;
    try {
        [resolved] = await resolveAttachments(actorId, groupId, [photo]);
    } catch (error) {
        if (error instanceof ChatApiError && error.code === "ATTACHMENTS_UNAVAILABLE") {
            throw new ChatApiError(
                "PHOTO_UNAVAILABLE",
                "Group photos aren't available right now. Create the group without one, or try again later.",
                503
            );
        }
        throw error;
    }

    if (!resolved || resolved.type !== "image" || !(GROUP_PHOTO_MIME_TYPES as readonly string[]).includes(resolved.mimeType ?? "")) {
        await destroyUploadedAssets([{ publicId: photo.publicId, resourceType: photo.resourceType }]);
        throw new ChatApiError("INVALID_PHOTO", "The group photo must be a JPG, PNG or WebP picture.", 400);
    }
    return resolved;
}

export interface CreatedGroup {
    group: GroupSummary;
    /** false when this request repeated one that had already created the group. */
    created: boolean;
    /** Whom to tell about it (everybody but the creator); null for a repeat, which has nothing new to announce. */
    announce: { groupName: string; memberIds: string[] } | null;
}

/** The mapping of a repeated request: the creator gets their group back, anybody else's id is simply taken. */
function replay(groupId: string, snap: DocumentSnapshot, actorId: string): CreatedGroup {
    if (snap.get("createdBy") !== actorId || snap.get("category") !== "group") {
        throw new ChatApiError("GROUP_ID_TAKEN", "Couldn't create the group. Please try again.", 409);
    }
    return { group: summaryOf(groupId, snap), created: false, announce: null };
}

const ALREADY_EXISTS = 6; // gRPC status of Firestore's create() on an existing document

export async function createGroup({ actor, request }: { actor: GroupActor; request: CreateGroupRequest }): Promise<CreatedGroup> {
    assertCanCreateGroups(actor.role);

    const memberIds = normalizeMemberIds(request.memberIds, actor.id);
    if (memberIds.length === 0) throw new ChatApiError("NO_MEMBERS", "Add at least one person to the group.", 400);
    if (memberIds.length > GROUP_MAX_ADDED_MEMBERS) {
        throw new ChatApiError("TOO_MANY_MEMBERS", "This group has too many people.", 400);
    }

    const chatRef = firebaseAdminDB.collection("chats").doc(request.groupId);

    // A repeat of a request that already worked: answer with that group, whatever the people look like now.
    const existing = await chatRef.get();
    if (existing.exists) return replay(request.groupId, existing, actor.id);

    const members = await resolveGroupMembers(actor, memberIds);
    const photo = request.photo ? await resolvePhoto(actor.id, request.groupId, request.photo) : null;

    const participants = [actor.id, ...members.map((member) => member.id)];

    // What the screen needs to draw each member without another lookup. (Firestore refuses `undefined`, so a
    // person without a picture simply has no `imageUrl`.)
    const profile = (person: { name: string; role: string; imageUrl: string | null }) => ({
        name: person.name,
        role: person.role,
        ...(person.imageUrl ? { imageUrl: person.imageUrl } : {}),
    });
    const memberProfiles: Record<string, ReturnType<typeof profile>> = {
        [actor.id]: profile({ name: actor.name, role: actor.role, imageUrl: actor.imageUrl ?? null }),
    };
    for (const member of members) memberProfiles[member.id] = profile(member);

    try {
        await chatRef.create({
            id: request.groupId,
            category: "group",
            name: request.name,
            ...(request.description ? { description: request.description } : {}),
            ...(photo ? { imageUrl: photo.url, imagePublicId: photo.publicId } : {}),
            participants,
            createdBy: actor.id,
            admins: [actor.id],
            members: memberProfiles,
            // The sidebar lists chats by `updatedAt`, and the history by `time`: both must exist for the group to appear.
            time: new Date().toISOString(),
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
            lastMessage: "",
            isRead: true,
            unreadCount: Object.fromEntries(participants.map((id) => [id, 0])),
        });
    } catch (error) {
        if ((error as { code?: unknown } | null)?.code === ALREADY_EXISTS) {
            // Two identical requests raced: one of them created it, and this one is its repeat.
            return replay(request.groupId, await chatRef.get(), actor.id);
        }
        // The group wasn't made, so the picture that was uploaded for it is of no use to anybody.
        if (request.photo) {
            await destroyUploadedAssets([{ publicId: request.photo.publicId, resourceType: request.photo.resourceType }]);
        }
        throw error;
    }

    return {
        group: {
            id: request.groupId,
            name: request.name,
            description: request.description ?? "",
            imageUrl: photo?.url ?? null,
            memberCount: participants.length,
        },
        created: true,
        announce: { groupName: request.name, memberIds: members.map((member) => member.id) },
    };
}

/* -------------------------------------------------------------------------------------------------
 * Upload tickets
 * ---------------------------------------------------------------------------------------------- */

/**
 * Signed uploads for a group. The files go straight to Cloudinary and are checked again when they are used (the
 * group photo when the group is created, a file when the message is sent), exactly like the attachments of a
 * direct chat: they live in the uploader's own folder for this chat id and nowhere else.
 *
 *   photo     the picture of a group that doesn't exist yet. Needs the right to create groups, one file, JPG/PNG/WebP.
 *   message   files and voice messages for a group the user is in.
 */
export async function createGroupUploadTickets(actor: GroupActor, request: GroupUploadRequest): Promise<UploadTicketResult[]> {
    if (request.purpose === "photo") {
        assertCanCreateGroups(actor.role);

        const check = validateAttachmentFile({ name: request.file.name, size: request.file.size, type: request.file.mimeType });
        if (!check.ok) return [{ ok: false, code: check.code, message: check.message }];
        if (check.type !== "image" || !(GROUP_PHOTO_MIME_TYPES as readonly string[]).includes(check.mimeType)) {
            return [{ ok: false, code: "UNSUPPORTED_TYPE", message: "Choose a JPG, PNG or WebP picture." }];
        }
        return createUploadTickets(actor.id, request.groupId, [{ ...request.file, kind: undefined }]);
    }

    const snap = await firebaseAdminDB.collection("chats").doc(request.groupId).get();
    assertGroupMember(snap, actor.id);
    return createUploadTickets(actor.id, request.groupId, request.files);
}
