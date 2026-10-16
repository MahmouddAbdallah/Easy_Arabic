import axios from "axios";
import { GROUPS_API_URL, GROUP_CANDIDATES_API_URL } from "./constants";
import type { CreateGroupRequestInput, CreateGroupResponse, GroupCandidatesResponse } from "./groupSchemas";
import type { GroupCandidate } from "./groups";

/**
 * Browser side of the group endpoints (/api/chat/groups/*). The server decides everything; these only carry the
 * request and turn a failure into a message that is safe to show and a hint about whether trying again can help.
 */

/** A failed "create group", with words for the person. */
export class CreateGroupError extends Error {
    constructor(
        message: string,
        readonly code: string,
        /** Trying again can help: the connection dropped, the server hiccuped, or the limit will lift. */
        readonly retryable: boolean,
        /** The people the server refused to add (code INVALID_MEMBERS): the form takes exactly them off the list. */
        readonly memberIds: readonly string[] = []
    ) {
        super(message);
        this.name = "CreateGroupError";
    }
}

type ErrorBody = { error?: { code?: unknown; message?: unknown; details?: { memberIds?: unknown } } };

export function toCreateGroupError(error: unknown): CreateGroupError {
    if (!axios.isAxiosError(error)) return new CreateGroupError("Something went wrong. Please try again.", "UNKNOWN", true);
    if (!error.response) {
        return new CreateGroupError("Can't reach the server. Check your connection and try again.", "NETWORK", true);
    }

    const { status, data } = error.response as { status: number; data?: ErrorBody };
    const body = data?.error;
    const code = typeof body?.code === "string" ? body.code : "UNKNOWN";
    const serverMessage = typeof body?.message === "string" && body.message ? body.message : null;
    const memberIds = Array.isArray(body?.details?.memberIds)
        ? body.details.memberIds.filter((id): id is string => typeof id === "string")
        : [];

    if (status === 401) return new CreateGroupError("Your session expired. Please sign in again.", code, false);
    return new CreateGroupError(
        serverMessage ?? "Couldn't create the group. Please try again.",
        code,
        status >= 500 || status === 429 || status === 408,
        memberIds
    );
}

/** The people the signed-in user can add to a group, matching `keyword` (everybody when it is empty). */
export async function fetchGroupCandidates(
    keyword: string,
    signal?: AbortSignal
): Promise<{ people: GroupCandidate[]; hasMore: boolean }> {
    const { data } = await axios.get<GroupCandidatesResponse>(GROUP_CANDIDATES_API_URL, {
        params: keyword ? { keyword } : undefined,
        signal,
    });
    return { people: data.people, hasMore: data.hasMore };
}

/** Long enough for a slow connection, short enough that a request that never answers doesn't trap the person. */
const CREATE_TIMEOUT_MS = 30_000;

/**
 * Creates the group (or, for a repeat of the same request, returns the one it already made). A timeout is reported as
 * "can't reach the server", and trying again is safe: the same request can never make a second group.
 */
export async function createGroupRequest(body: CreateGroupRequestInput, signal?: AbortSignal): Promise<CreateGroupResponse> {
    try {
        const { data } = await axios.post<CreateGroupResponse>(GROUPS_API_URL, body, { signal, timeout: CREATE_TIMEOUT_MS });
        return data;
    } catch (error) {
        if (axios.isCancel(error)) throw new DOMException("Aborted", "AbortError");
        throw toCreateGroupError(error);
    }
}
