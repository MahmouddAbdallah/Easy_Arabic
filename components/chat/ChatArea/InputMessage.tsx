"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useForm, useWatch } from "react-hook-form";
import axios from "axios";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2Icon, Mic2Icon, SendHorizontalIcon, UploadIcon } from "lucide-react";
import { useChat } from "../ChatProvider";
import { useAppContext } from "@/components/AppContext";
import { useTypingIndicator } from "../hooks/useTyping";
import { useAttachmentUploads } from "../hooks/useAttachmentUploads";
import { useVoiceMessage } from "../hooks/useVoiceMessage";
import { useFileDrop } from "../hooks/useFileDrop";
import { COMPOSER_TOAST_POSITION, MESSAGES_API_URL } from "../lib/constants";
import { getErrorMessage } from "../lib/getErrorMessage";
import { AttachMenu } from "./Attachments/AttachMenu";
import { PendingTray } from "./Attachments/PendingTray";
import { VoiceComposer } from "./Voice/VoiceComposer";
import { BlockedNotice } from "./BlockedNotice";

interface MessageFormValues {
    text: string;
}

const InputMessage = () => {
    const { user } = useAppContext();
    const { receiverId, chatId, conversation } = useChat();
    const { notifyTyping, stopTyping } = useTypingIndicator(chatId, user?.id);
    // Neither of the two can send, react or call: the composer gives way to a notice.
    const blocked = conversation.blocked;

    const [loading, setLoading] = useState(false);
    // A ref as well as state: two quick submits (Enter twice) would both pass a state check.
    const sendingRef = useRef(false);

    const attachments = useAttachmentUploads({ chatId, receiverId });
    const { addFiles } = attachments;
    const voice = useVoiceMessage({ chatId, receiverId });
    // Files can't be dropped on a voice message that is being recorded or sent.
    const isDraggingFiles = useFileDrop(addFiles, Boolean(receiverId) && !loading && !voice.isActive && !blocked);

    const { register, handleSubmit, control, reset } = useForm<MessageFormValues>({
        defaultValues: {
            text: "",
        },
    });

    const textValue = useWatch({ name: "text", control });

    // Typing follows the input: text present = typing (idle/heartbeat handled inside the hook, no
    // request per keystroke); empty or whitespace-only input = not typing, right away.
    // Only `textValue` drives this, so switching chats with a leftover draft doesn't start typing.
    useEffect(() => {
        if (textValue?.trim()) notifyTyping();
        else stopTyping();
    }, [textValue, notifyTyping, stopTyping]);

    // A block that lands while typing or recording ends both at once: nothing is sent, nothing is left running.
    const voiceActive = voice.isActive;
    const cancelVoice = voice.cancel;
    useEffect(() => {
        if (!blocked) return;
        stopTyping();
        if (voiceActive) cancelVoice();
    }, [blocked, voiceActive, stopTyping, cancelVoice]);

    const onSubmit = async (data: MessageFormValues) => {
        if (sendingRef.current || blocked) return;

        const trimmedText = data.text?.trim() || "";
        const ready = attachments.getReady();

        // The send button is disabled in these states; Enter in the text field still lands here.
        if (attachments.isBusy) {
            toast("Your files are still uploading.", { id: "chat-attachments-busy", position: COMPOSER_TOAST_POSITION });
            return;
        }
        if (attachments.hasFailed) {
            toast.error("Retry or remove the files that didn't upload first.", {
                id: "chat-attachments-failed",
                position: COMPOSER_TOAST_POSITION,
            });
            return;
        }
        if (!trimmedText && ready.length === 0) return;

        // Sending ends "typing" at once, without waiting for the request or the idle timer.
        stopTyping();

        sendingRef.current = true;
        setLoading(true);
        try {
            const response = await axios.patch(MESSAGES_API_URL, {
                receiverId,
                text: trimmedText,
                ...(ready.length > 0 && { attachments: attachments.getPayload() }),
            });

            if (response.data.success) {
                reset();
                // The message owns the uploaded files now: forget them here without deleting them.
                attachments.release(ready.map((item) => item.id));
            }
        } catch (error) {
            // Text and attachments stay as they were, so the user can simply press send again.
            console.error("Failed to send message:", error);
            toast.error(getErrorMessage(error), { id: "chat-send-error", position: COMPOSER_TOAST_POSITION });
        } finally {
            sendingRef.current = false;
            setLoading(false);
        }
    };

    // Only ever called from events (submit, Enter), never during render.
    const submitForm = (event?: React.BaseSyntheticEvent) => handleSubmit(onSubmit)(event);

    const hasContent = Boolean(textValue?.trim()) || attachments.items.length > 0;
    // Can't send while files are still uploading or when one failed; the tray says why.
    const sendBlocked = attachments.isBusy || attachments.hasFailed;

    return (
        <div className="p-3 md:p-4 border-t border-border/30 bg-card/10 backdrop-blur-md shrink-0">
            {blocked ? (
                <BlockedNotice />
            ) : (
                <form
                    onSubmit={submitForm}
                    className="max-w-full mx-auto flex flex-col gap-2"
                >
                    <PendingTray
                        items={attachments.items}
                        locked={loading}
                        onRemove={attachments.remove}
                        onRetry={attachments.retry}
                    />

                    {voice.isActive ? (
                        <VoiceComposer voice={voice} />
                    ) : (
                        <div className="flex items-center gap-1 md:gap-2 bg-muted/30 border border-border/40 rounded-2xl p-1.5 shadow-sm focus-within:ring-1 focus-within:ring-primary/40 focus-within:bg-background/80 transition-all">
                            <AttachMenu disabled={loading || !receiverId} onFiles={addFiles} />

                            <Input
                                {...register("text")}
                                placeholder={attachments.items.length > 0 ? "Add a caption..." : "Type a message..."}
                                disabled={loading}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey) {
                                        e.preventDefault();
                                        submitForm();
                                    }
                                }}
                                // Pasted screenshots / copied images become attachments instead of being dropped.
                                onPaste={(e) => {
                                    const files = Array.from(e.clipboardData.files);
                                    if (files.length === 0) return;
                                    e.preventDefault();
                                    addFiles(files);
                                }}
                                className="border-none bg-transparent shadow-none focus-visible:ring-0 text-xs placeholder:text-muted-foreground/50 h-9 min-w-0 flex-1"
                            />

                            {loading ? (
                                <Button
                                    disabled
                                    size="icon"
                                    aria-label="Sending"
                                    className="size-11 md:size-8 bg-primary/80 rounded-xl shrink-0"
                                >
                                    <Loader2Icon className="h-4 w-4 animate-spin text-primary-foreground" />
                                </Button>
                            ) : hasContent ? (
                                <Button
                                    type="submit"
                                    size="icon"
                                    disabled={sendBlocked}
                                    aria-label="Send"
                                    title={attachments.isBusy ? "Waiting for uploads to finish" : attachments.hasFailed ? "Retry or remove failed files" : "Send"}
                                    className="size-11 md:size-8 bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl shrink-0 shadow-sm shadow-primary/30 transition-all"
                                >
                                    {attachments.isBusy ? (
                                        <Loader2Icon className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <SendHorizontalIcon className="h-4 w-4" />
                                    )}
                                </Button>
                            ) : (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={voice.start}
                                    disabled={!receiverId}
                                    aria-label="Record voice message"
                                    title="Record voice message"
                                    className="size-11 md:size-8 text-muted-foreground hover:text-foreground rounded-xl shrink-0"
                                >
                                    <Mic2Icon className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    )}
                </form>
            )}

            {isDraggingFiles &&
                createPortal(
                    <div
                        aria-hidden
                        className="pointer-events-none fixed inset-0 z-60 grid place-items-center bg-background/70 p-6 backdrop-blur-sm"
                    >
                        <div className="flex max-w-sm flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-primary/60 bg-card/90 px-10 py-12 text-center shadow-xl">
                            <span className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
                                <UploadIcon className="size-7" />
                            </span>
                            <p className="text-sm font-semibold">Drop to attach</p>
                            <p className="text-xs text-muted-foreground">Photos, videos and documents</p>
                        </div>
                    </div>,
                    document.body
                )}
        </div>
    );
};

export default InputMessage;
