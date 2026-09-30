"use client";

import React, { useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2Icon, Mic2Icon, PaperclipIcon, SendHorizontalIcon, SmileIcon, XIcon, } from "lucide-react";
import { useChat } from "../ChatProvider";
import { useAppContext } from "@/components/AppContext";
import { useTypingIndicator } from "../hooks/useTyping";

interface MessageFormValues {
    text: string;
}

const InputMessage = () => {
    const { user } = useAppContext();
    const { receiverId, chatId } = useChat();
    const { notifyTyping, stopTyping } = useTypingIndicator(chatId, user?.id);

    const [loading, setLoading] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

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

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setSelectedFile(e.target.files[0]);
        }
    };

    const onSubmit = async (data: MessageFormValues) => {
        const trimmedText = data.text?.trim() || "";

        if (!trimmedText && !selectedFile) return;

        // Sending ends "typing" at once, without waiting for the request or the idle timer.
        stopTyping();

        try {
            setLoading(true);

            let attachmentPayload = undefined;
            if (selectedFile) {
                attachmentPayload = {
                    type: selectedFile.type.startsWith("image/") ? "image" : "file",
                    fileName: selectedFile.name,
                    fileSize: `${(selectedFile.size / 1024).toFixed(1)} KB`,
                    url: URL.createObjectURL(selectedFile),
                };
            }

            const payload = {
                senderId: user?.id,
                receiverId,
                text: trimmedText,
                ...(attachmentPayload && { attachment: attachmentPayload }),
            };

            const response = await axios.patch("/api/chat/messages", payload);

            if (response.data.success) {
                reset();
                setSelectedFile(null);
            }
        } catch (error) {
            console.error("Failed to send message:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-3 md:p-4 border-t border-border/30 bg-card/10 backdrop-blur-md shrink-0">
            <form
                onSubmit={handleSubmit(onSubmit)}
                className="max-w-full mx-auto flex flex-col gap-2"
            >
                {selectedFile && (
                    <div className="flex items-center gap-2 bg-muted/60 border border-border/40 rounded-xl px-3 py-1.5 text-xs text-muted-foreground w-fit">
                        <PaperclipIcon className="h-3.5 w-3.5" />
                        <span className="truncate max-w-50">{selectedFile.name}</span>
                        <button
                            type="button"
                            onClick={() => setSelectedFile(null)}
                            className="text-muted-foreground hover:text-foreground ml-1"
                        >
                            <XIcon className="h-3.5 w-3.5" />
                        </button>
                    </div>
                )}

                <div className="flex items-center gap-2 bg-muted/30 border border-border/40 rounded-2xl p-1.5 shadow-sm focus-within:ring-1 focus-within:ring-primary/40 focus-within:bg-background/80 transition-all">
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        className="hidden"
                    />

                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => fileInputRef.current?.click()}
                        className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-xl shrink-0"
                    >
                        <PaperclipIcon className="h-4 w-4" />
                    </Button>

                    <Input
                        {...register("text")}
                        placeholder="Type a message..."
                        disabled={loading}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                handleSubmit(onSubmit)();
                            }
                        }}
                        className="border-none bg-transparent shadow-none focus-visible:ring-0 text-xs placeholder:text-muted-foreground/50 h-9 flex-1"
                    />

                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-xl shrink-0"
                    >
                        <SmileIcon className="h-4 w-4" />
                    </Button>

                    {loading ? (
                        <Button
                            disabled
                            size="icon"
                            className="h-8 w-8 bg-primary/80 rounded-xl shrink-0"
                        >
                            <Loader2Icon className="h-4 w-4 animate-spin text-primary-foreground" />
                        </Button>
                    ) : textValue?.trim() || selectedFile ? (
                        <Button
                            type="submit"
                            size="icon"
                            className="h-8 w-8 bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl shrink-0 shadow-sm shadow-primary/30 transition-all"
                        >
                            <SendHorizontalIcon className="h-4 w-4" />
                        </Button>
                    ) : (
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-xl shrink-0"
                        >
                            <Mic2Icon className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            </form>
        </div>
    );
};

export default InputMessage;