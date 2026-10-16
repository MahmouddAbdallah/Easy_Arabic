import { z } from "zod";
import {
    GROUP_DESCRIPTION_TOO_LONG,
    GROUP_ID_PATTERN,
    GROUP_MAX_ADDED_MEMBERS,
    GROUP_NAME_REQUIRED,
    GROUP_NAME_TOO_LONG,
    GROUP_NEEDS_MEMBERS,
    GROUP_TOO_MANY_MEMBERS,
    GROUP_DESCRIPTION_MAX_LENGTH,
    GROUP_NAME_MAX_LENGTH,
    normalizeGroupText,
    type GroupCandidate,
    type GroupSummary,
} from "./groups";
import { MAX_ATTACHMENTS_PER_MESSAGE } from "./attachments";
import { SendAttachmentSchema, UploadFileSchema, firestoreId } from "./schemas";

/**
 * Request schemas of the /api/chat/groups endpoints. The browser only needs the inferred types (`import type`),
 * so zod never reaches the client bundle. Unknown keys are rejected, so a typo fails loudly.
 *
 * Nothing here names the acting user: the creator is always the signed-in user.
 */

const groupId = z.string().regex(GROUP_ID_PATTERN, "Invalid group");

/** The same words for the browser's form and the server's refusal. Counted in characters, not UTF-16 units. */
const groupName = z
    .string({ error: GROUP_NAME_REQUIRED })
    .transform(normalizeGroupText)
    .pipe(
        z
            .string()
            .min(1, GROUP_NAME_REQUIRED)
            .refine((name) => Array.from(name).length <= GROUP_NAME_MAX_LENGTH, GROUP_NAME_TOO_LONG)
    );

const groupDescription = z
    .string()
    .transform(normalizeGroupText)
    .pipe(z.string().refine((value) => Array.from(value).length <= GROUP_DESCRIPTION_MAX_LENGTH, GROUP_DESCRIPTION_TOO_LONG));

/** POST /api/chat/groups */
export const CreateGroupRequestSchema = z.strictObject({
    /**
     * Chosen by the browser once per "New group" session. Sending the same request twice (a double click, a retry after
     * a dropped connection) therefore creates the group once: the second one finds it and answers with it.
     */
    groupId,
    name: groupName,
    description: groupDescription.optional(),
    /** Everybody except the creator, who is always part of the group. */
    memberIds: z.array(firestoreId).min(1, GROUP_NEEDS_MEMBERS).max(GROUP_MAX_ADDED_MEMBERS, GROUP_TOO_MANY_MEMBERS),
    /** The group photo: a file the creator already uploaded (see POST /api/chat/groups/uploads), checked again here. */
    photo: SendAttachmentSchema.refine(
        (photo) => photo.resourceType === "image" && photo.kind === undefined,
        "The group photo must be a picture."
    ).optional(),
});

/** GET /api/chat/groups/candidates?keyword=… */
export const GroupCandidatesQuerySchema = z.object({
    keyword: z
        .string()
        .transform(normalizeGroupText)
        .pipe(z.string().max(100, "That search is too long."))
        .optional(),
});

/**
 * POST /api/chat/groups/uploads: "sign my uploads for this group". `photo` is the picture of a group that is about to
 * be created (the group doesn't exist yet, so only its id is known); `message` is for files and voice messages sent
 * to a group the user is already in.
 */
export const GroupUploadRequestSchema = z.discriminatedUnion("purpose", [
    z.strictObject({ purpose: z.literal("photo"), groupId, file: UploadFileSchema }),
    z.strictObject({
        purpose: z.literal("message"),
        groupId,
        files: z
            .array(UploadFileSchema)
            .min(1, "Choose at least one file")
            .max(MAX_ATTACHMENTS_PER_MESSAGE, `You can attach up to ${MAX_ATTACHMENTS_PER_MESSAGE} files at a time`),
    }),
]);

export type CreateGroupRequest = z.output<typeof CreateGroupRequestSchema>;
export type CreateGroupRequestInput = z.input<typeof CreateGroupRequestSchema>;
export type GroupCandidatesQuery = z.output<typeof GroupCandidatesQuerySchema>;
export type GroupUploadRequest = z.output<typeof GroupUploadRequestSchema>;

/** Body of a successful POST /api/chat/groups. */
export interface CreateGroupResponse {
    success: true;
    /** false when this request repeated one that had already created the group. */
    created: boolean;
    group: GroupSummary;
}

/** Body of a successful GET /api/chat/groups/candidates. */
export interface GroupCandidatesResponse {
    success: true;
    people: GroupCandidate[];
    /** There are more people than were listed: searching narrows it down. */
    hasMore: boolean;
}
