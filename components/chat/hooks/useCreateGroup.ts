"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
    AttachmentUploadError,
    discardUploadedAsset,
    isAbortError,
    requestGroupPhotoTicket,
    toAttachmentPayload,
    toUploadError,
    uploadToCloudinary,
} from "../lib/attachmentUpload";
import { CreateGroupError, createGroupRequest } from "../lib/groupApi";
import { newGroupId, type GroupSummary } from "../lib/groups";
import type { UploadedAsset } from "../types";

/** What making the group is doing: nothing, sending the picture to Cloudinary, or asking the server to create it. */
export type CreateGroupPhase = "idle" | "uploading" | "creating";

export interface CreateGroupInput {
    name: string;
    description: string;
    /** Everybody but the creator. */
    memberIds: string[];
    /** The group picture, already checked by the form. */
    photo: File | null;
}

export interface CreateGroupFailure {
    message: string;
    /** The people the server refused to add (so the form can take them off the list); empty for any other failure. */
    memberIds: readonly string[];
}

/** How an attempt ended. `failure: null` means it was stopped (the person left) or was a second press during one. */
export type CreateGroupResult = { ok: true; group: GroupSummary } | { ok: false; failure: CreateGroupFailure | null };

const STOPPED: CreateGroupResult = { ok: false, failure: null };

/**
 * Creates a group: sends the picture (when there is one) straight to Cloudinary, then asks the server to create the
 * group, which checks everything again. Built so that the person can press the button as often as they like:
 *
 *   - the id of the group is chosen once, here, and travels with the request, so a second press (or a retry after a
 *     dropped connection that had in fact worked) is answered with the same group instead of making another;
 *   - while one attempt runs, another press does nothing;
 *   - a picture that already reached Cloudinary isn't uploaded again on a retry, and is deleted if the person leaves
 *     without creating the group (but never while the outcome of the request is unknown: the group may own it).
 */
export function useCreateGroup() {
    const [phase, setPhase] = useState<CreateGroupPhase>("idle");
    const [progress, setProgress] = useState(0);
    const [failure, setFailure] = useState<CreateGroupFailure | null>(null);

    const groupIdRef = useRef(newGroupId());
    const busyRef = useRef(false);
    const phaseRef = useRef<CreateGroupPhase>("idle");
    const createdRef = useRef(false);
    const abortRef = useRef<AbortController | null>(null);
    const uploadedRef = useRef<{ file: File; asset: UploadedAsset } | null>(null);

    const enter = useCallback((next: CreateGroupPhase) => {
        phaseRef.current = next;
        setPhase(next);
    }, []);

    const discardUpload = useCallback(() => {
        if (uploadedRef.current) discardUploadedAsset(uploadedRef.current.asset);
        uploadedRef.current = null;
    }, []);

    const submit = useCallback(
        async ({ name, description, memberIds, photo }: CreateGroupInput): Promise<CreateGroupResult> => {
            if (busyRef.current || createdRef.current) return STOPPED;
            busyRef.current = true;
            setFailure(null);

            const controller = new AbortController();
            abortRef.current = controller;

            try {
                let photoPayload;
                if (photo) {
                    // Only a different picture than the one already uploaded needs a new upload.
                    if (uploadedRef.current && uploadedRef.current.file !== photo) discardUpload();

                    if (!uploadedRef.current) {
                        enter("uploading");
                        setProgress(0);
                        const ticket = await requestGroupPhotoTicket(groupIdRef.current, photo, controller.signal);
                        if (!ticket.ok) throw new AttachmentUploadError(ticket.message, false);

                        const asset = await uploadToCloudinary(photo, ticket.ticket, {
                            signal: controller.signal,
                            onProgress: setProgress,
                        });
                        uploadedRef.current = { file: photo, asset };
                        if (controller.signal.aborted) return STOPPED;
                    }
                    photoPayload = toAttachmentPayload(photo.name, uploadedRef.current.asset);
                } else {
                    discardUpload(); // the picture was taken off after an earlier attempt
                }

                enter("creating");
                const response = await createGroupRequest(
                    {
                        groupId: groupIdRef.current,
                        name,
                        ...(description ? { description } : {}),
                        memberIds,
                        ...(photoPayload ? { photo: photoPayload } : {}),
                    },
                    controller.signal
                );

                createdRef.current = true;
                uploadedRef.current = null; // the group owns the picture now
                return { ok: true, group: response.group };
            } catch (error) {
                if (isAbortError(error)) return STOPPED;

                let reason: CreateGroupFailure;
                if (error instanceof CreateGroupError) {
                    if (error.code === "GROUP_ID_TAKEN") {
                        // Astronomically unlikely, but then this id can never work: start over with a new one.
                        discardUpload();
                        groupIdRef.current = newGroupId();
                    }
                    reason = { message: error.message, memberIds: error.memberIds };
                } else {
                    // A refused picture is an ordinary outcome with words of its own; anything else is a bug worth a log.
                    if (!(error instanceof AttachmentUploadError)) console.error("Couldn't create the group:", error);
                    reason = { message: toUploadError(error).message, memberIds: [] };
                }
                setFailure(reason);
                return { ok: false, failure: reason };
            } finally {
                busyRef.current = false;
                abortRef.current = null;
                enter("idle");
            }
        },
        [discardUpload, enter]
    );

    /** Forget the last failure (the person changed something, so the message no longer applies). */
    const clearFailure = useCallback(() => setFailure(null), []);

    // Leaving without a group: stop what is running and delete a picture nobody is going to use. While the server is
    // being asked, nothing is deleted: the group may exist by now, and then the picture belongs to it.
    useEffect(
        () => () => {
            abortRef.current?.abort();
            if (!createdRef.current && phaseRef.current !== "creating") discardUpload();
        },
        [discardUpload]
    );

    return { submit, phase, progress, failure, clearFailure, busy: phase !== "idle", creating: phase === "creating" };
}
