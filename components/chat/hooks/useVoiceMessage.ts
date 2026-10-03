"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { COMPOSER_TOAST_POSITION, MESSAGES_API_URL } from "../lib/constants";
import {
    AttachmentUploadError,
    discardUploadedAsset,
    isAbortError,
    requestUploadTickets,
    toUploadError,
    toVoicePayload,
    uploadToCloudinary,
} from "../lib/attachmentUpload";
import { getErrorMessage } from "../lib/getErrorMessage";
import { MAX_VOICE_SECONDS } from "../lib/attachments";
import type { UploadedAsset } from "../types";
import { useVoiceRecorder } from "./useVoiceRecorder";

/** What the composer is doing about voice: nothing, or one of the steps of making a voice message. */
export type VoicePhase = "idle" | "requesting" | "recording" | "recorded" | "sending";

/** While sending: the file is going to Cloudinary, or the message is being created. */
export type VoiceSendStage = "uploading" | "delivering";

interface Options {
    /** A recording belongs to one chat (its upload lives in that chat's folder): leaving the chat drops it. */
    chatId: string | null;
    receiverId: string | null;
}

/**
 * Voice messages for the composer: record, listen back, send or throw away.
 *
 * Sending reuses the attachment pipeline end to end (upload ticket -> straight to Cloudinary ->
 * "send message" request that the server verifies), so a voice message gets the same security
 * checks and storage as a photo. If sending fails the recording stays: pressing send again retries,
 * and a file that already reached Cloudinary is not uploaded a second time.
 */
export function useVoiceMessage({ chatId, receiverId }: Options) {
    const recorder = useVoiceRecorder({
        onError: (message) => toast.error(message, { id: "chat-voice-error", position: COMPOSER_TOAST_POSITION }),
        onLimitReached: () =>
            toast(`Maximum length reached (${MAX_VOICE_SECONDS / 60} minutes). Your message is ready to send.`, {
                id: "chat-voice-limit",
                position: COMPOSER_TOAST_POSITION,
            }),
    });
    const { stop: stopRecording, cancel: cancelRecording } = recorder;

    const [sending, setSending] = useState<{ stage: VoiceSendStage; progress: number } | null>(null);
    const [sendError, setSendError] = useState<string | null>(null);

    // Two quick presses of "send" must produce one message: a state check alone would let both through.
    const sendingRef = useRef(false);
    const abortRef = useRef<AbortController | null>(null);
    /** True from the moment the "send message" request leaves until it answers: the file must not be deleted then. */
    const deliveringRef = useRef(false);
    /** The recording that already reached Cloudinary, so a retry only has to send the message. */
    const uploadedRef = useRef<{ recordingId: string; asset: UploadedAsset } | null>(null);

    const discardUpload = useCallback(() => {
        if (uploadedRef.current) discardUploadedAsset(uploadedRef.current.asset);
        uploadedRef.current = null;
    }, []);

    const send = useCallback(async () => {
        if (sendingRef.current || !receiverId || recorder.status === "requesting") return;
        sendingRef.current = true;
        setSendError(null);

        let stage: VoiceSendStage = "uploading";
        try {
            // Sending straight from the recording screen ends the recording first. Null: it was too short or
            // failed, and the recorder has already said so.
            const recording = await stopRecording();
            if (!recording) return;

            const controller = new AbortController();
            abortRef.current = controller;
            setSending({ stage, progress: 0 });

            let asset = uploadedRef.current?.recordingId === recording.id ? uploadedRef.current.asset : null;
            if (!asset) {
                const [ticket] = await requestUploadTickets(
                    receiverId,
                    [{ name: recording.file.name, size: recording.file.size, mimeType: recording.mimeType, kind: "voice" }],
                    controller.signal
                );
                if (!ticket || !ticket.ok) {
                    throw new AttachmentUploadError(ticket?.message ?? "Couldn't prepare the upload. Please try again.", false);
                }

                asset = await uploadToCloudinary(recording.file, ticket.ticket, {
                    signal: controller.signal,
                    onProgress: (progress) => setSending((current) => (current ? { ...current, progress } : current)),
                });
                if (controller.signal.aborted) {
                    discardUploadedAsset(asset); // cancelled in the last moment: don't leave it behind
                    return;
                }
                uploadedRef.current = { recordingId: recording.id, asset };
            }

            stage = "delivering";
            setSending({ stage, progress: 100 });
            deliveringRef.current = true;
            await axios.patch(MESSAGES_API_URL, {
                receiverId,
                text: "",
                attachments: [toVoicePayload(recording.file.name, asset, recording)],
            });

            // The message owns the file now: forget it here without deleting it.
            uploadedRef.current = null;
            cancelRecording(); // only frees the local recording; it is back to idle
        } catch (error) {
            if (isAbortError(error)) return;
            const message = stage === "uploading" ? toUploadError(error).message : getErrorMessage(error);
            console.error("Failed to send voice message:", error);
            setSendError(message);
            toast.error(message, { id: "chat-voice-error", position: COMPOSER_TOAST_POSITION });
        } finally {
            sendingRef.current = false;
            deliveringRef.current = false;
            abortRef.current = null;
            setSending(null);
        }
    }, [cancelRecording, receiverId, recorder.status, stopRecording]);

    /** Throws the voice message away: stops recording / the upload, and deletes what already reached Cloudinary. */
    const cancel = useCallback(() => {
        if (deliveringRef.current) return; // the message is being created right now and needs its file
        abortRef.current?.abort();
        discardUpload();
        setSendError(null);
        cancelRecording();
    }, [cancelRecording, discardUpload]);

    // Leaving the chat (or the page) drops a voice message that wasn't sent, and never leaves the microphone on.
    useEffect(
        () => () => {
            if (deliveringRef.current) return;
            abortRef.current?.abort();
            discardUpload();
            cancelRecording();
        },
        [chatId, cancelRecording, discardUpload]
    );

    /** Ends the recording and moves to the preview. */
    const finish = useCallback(() => void stopRecording(), [stopRecording]);

    const phase: VoicePhase = sending ? "sending" : recorder.status;

    return {
        phase,
        /** The voice recorder is on screen (in any step), so the normal composer is not. */
        isActive: phase !== "idle",
        supported: recorder.supported,
        /** Whole seconds of the recording so far. */
        elapsed: recorder.elapsed,
        /** The finished recording, once there is one (preview, send). */
        recording: recorder.recording,
        /** Live loudness for the recording waveform; read it inside an animation frame, not during render. */
        levelsRef: recorder.levelsRef,
        stage: sending?.stage ?? null,
        /** 0-100 while the file uploads. */
        progress: sending?.progress ?? 0,
        /** Why the last send failed; the recording is still there and "send" tries again. */
        sendError,
        start: recorder.start,
        finish,
        send,
        cancel,
    };
}

export type VoiceMessageController = ReturnType<typeof useVoiceMessage>;
