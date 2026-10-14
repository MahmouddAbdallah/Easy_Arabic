"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useForm, useWatch } from "react-hook-form";
import axios from "axios";
import toast from "react-hot-toast";
import { cn } from "cn";
import { Loader2Icon, MicIcon, SendHorizontalIcon, UploadIcon } from "lucide-react";
import { useChat } from "../ChatProvider";
import { useAppContext } from "@/components/AppContext";
import { useTypingIndicator } from "../hooks/useTyping";
import { useAttachmentUploads } from "../hooks/useAttachmentUploads";
import { useVoiceMessage } from "../hooks/useVoiceMessage";
import { useFileDrop } from "../hooks/useFileDrop";
import { COMPOSER_TOAST_POSITION, MAX_MESSAGE_LENGTH, MESSAGES_API_URL } from "../lib/constants";
import { CHAT_ROOT_CLASS, ui } from "../lib/chatTheme";
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

    // The field grows with what is typed (up to a few lines, then it scrolls) and shrinks back after sending.
    const { ref: registerRef, ...textField } = register("text");
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    useEffect(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = "auto";
        el.style.height = `${Math.min(el.scrollHeight, 168)}px`;
    }, [textValue, voice.isActive]);

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
                textareaRef.current?.focus({ preventScroll: true });
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
        <div className="shrink-0 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1 sm:px-5 sm:pb-4">
            <div className="mx-auto w-full max-w-3xl">
                {blocked ? (
                    <BlockedNotice />
                ) : (
                    <form onSubmit={submitForm} className="flex flex-col gap-2">
                        <PendingTray
                            items={attachments.items}
                            locked={loading}
                            onRemove={attachments.remove}
                            onRetry={attachments.retry}
                        />

                        {voice.isActive ? (
                            <VoiceComposer voice={voice} />
                        ) : (
                            <div className="flex items-end gap-1 rounded-[28px] border border-(--chat-line) bg-(--chat-surface) p-1.5 shadow-(--chat-shadow-md) transition-[border-color,box-shadow] focus-within:border-(--chat-accent-ring) focus-within:shadow-[0_0_0_3px_var(--chat-accent-soft),var(--chat-shadow-md)]">
                                <AttachMenu disabled={loading || !receiverId} onFiles={addFiles} />

                                <textarea
                                    {...textField}
                                    ref={(el) => {
                                        registerRef(el);
                                        textareaRef.current = el;
                                    }}
                                    dir="auto"
                                    rows={1}
                                    maxLength={MAX_MESSAGE_LENGTH}
                                    aria-label="Message"
                                    placeholder={attachments.items.length > 0 ? "Add a caption" : "Message"}
                                    // Read-only (not disabled) while sending, so the field keeps the focus.
                                    readOnly={loading}
                                    enterKeyHint="send"
                                    onKeyDown={(e) => {
                                        if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
                                        // Phones: Enter is a new line and the Send button sends. Computers: Enter sends.
                                        if (window.matchMedia("(pointer: coarse)").matches) return;
                                        e.preventDefault();
                                        submitForm();
                                    }}
                                    // Pasted screenshots / copied images become attachments instead of being dropped.
                                    onPaste={(e) => {
                                        const files = Array.from(e.clipboardData.files);
                                        if (files.length === 0) return;
                                        e.preventDefault();
                                        addFiles(files);
                                    }}
                                    className="chat-scroll max-h-[168px] min-h-11 min-w-0 flex-1 resize-none self-center bg-transparent px-2 py-[11px] text-[15px] leading-[22px] text-(--chat-ink) outline-none placeholder:text-(--chat-ink-3)"
                                />

                                {loading ? (
                                    <button
                                        type="button"
                                        disabled
                                        aria-label="Sending"
                                        className="grid size-11 shrink-0 place-items-center rounded-full bg-(--chat-accent) text-(--chat-accent-ink) opacity-70"
                                    >
                                        <Loader2Icon className="size-5 animate-spin" />
                                    </button>
                                ) : hasContent ? (
                                    <button
                                        type="submit"
                                        disabled={sendBlocked}
                                        aria-label="Send"
                                        title={attachments.isBusy ? "Waiting for uploads to finish" : attachments.hasFailed ? "Retry or remove failed files" : "Send"}
                                        className="chat-rise grid size-11 shrink-0 place-items-center rounded-full bg-(--chat-accent) text-(--chat-accent-ink) outline-none transition-colors hover:bg-(--chat-accent-hover) focus-visible:ring-2 focus-visible:ring-(--chat-accent-ring) disabled:opacity-60"
                                    >
                                        {attachments.isBusy ? (
                                            <Loader2Icon className="size-5 animate-spin" />
                                        ) : (
                                            <SendHorizontalIcon className="size-5" />
                                        )}
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={voice.start}
                                        disabled={!receiverId}
                                        aria-label="Record voice message"
                                        title="Record voice message"
                                        className={cn(ui.iconButton, "size-11 [&_svg]:size-[22px]")}
                                    >
                                        <MicIcon strokeWidth={1.75} />
                                    </button>
                                )}
                            </div>
                        )}
                    </form>
                )}
            </div>

            {isDraggingFiles &&
                createPortal(
                    <div
                        aria-hidden
                        className={cn(
                            CHAT_ROOT_CLASS,
                            "pointer-events-none fixed inset-0 z-60 grid place-items-center bg-(--chat-canvas)/80 p-6 backdrop-blur-sm"
                        )}
                    >
                        <div className="flex max-w-sm flex-col items-center gap-3 rounded-[28px] border-2 border-dashed border-(--chat-accent-ring) bg-(--chat-surface) px-10 py-12 text-center shadow-(--chat-shadow-lg)">
                            <span className="grid size-14 place-items-center rounded-2xl bg-(--chat-accent-soft) text-(--chat-accent-text)">
                                <UploadIcon className="size-7" />
                            </span>
                            <p className="text-base font-semibold text-(--chat-ink)">Drop to attach</p>
                            <p className="text-sm text-(--chat-ink-2)">Photos, videos and documents</p>
                        </div>
                    </div>,
                    document.body
                )}
        </div>
    );
};

export default InputMessage;
