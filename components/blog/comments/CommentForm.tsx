"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from 'cn'
import { COMMENT_HONEYPOT_FIELD, COMMENT_LIMITS, blogPostCommentsApiUrl } from "../lib/constants";

type Field = "name" | "email" | "body";
type FieldErrors = Partial<Record<Field, string>>;
type Status = { kind: "idle" } | { kind: "sending" } | { kind: "sent"; message: string } | { kind: "error"; message: string };

const SENT_FALLBACK = "Thanks! Your comment has been sent and will appear once it has been reviewed.";
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Quick checks so a typo doesn't cost a round trip. The server checks everything again and is the one that decides. */
function validate(name: string, email: string, body: string): FieldErrors {
    const errors: FieldErrors = {};
    if (!name.trim()) errors.name = "Please enter your name.";
    else if (name.trim().length > COMMENT_LIMITS.name) errors.name = `Keep your name under ${COMMENT_LIMITS.name} characters.`;
    if (email.trim() && !EMAIL_SHAPE.test(email.trim())) errors.email = "Enter a valid email address.";
    if (body.trim().length < COMMENT_LIMITS.minBody) errors.body = "Please write a few words.";
    else if (body.length > COMMENT_LIMITS.body) errors.body = `Keep your comment under ${COMMENT_LIMITS.body} characters.`;
    return errors;
}

interface CommentFormProps {
    blogId: string;
    /** Signed by the server when the page was rendered (see createCommentFormToken). */
    token: string;
}

/**
 * The "leave a comment" form. A comment is never shown the moment it is sent: it goes to the site's
 * moderators first, and the form says so. The hidden `website` field is a trap for scripts.
 */
export function CommentForm({ blogId, token }: CommentFormProps) {
    const uid = useId();
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [body, setBody] = useState("");
    const [trap, setTrap] = useState("");
    const [errors, setErrors] = useState<FieldErrors>({});
    const [status, setStatus] = useState<Status>({ kind: "idle" });
    const nameRef = useRef<HTMLInputElement>(null);
    const emailRef = useRef<HTMLInputElement>(null);
    const bodyRef = useRef<HTMLTextAreaElement>(null);

    const sending = status.kind === "sending";
    const id = (field: string) => `${uid}-${field}`;

    async function onSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (sending) return;

        const found = validate(name, email, body);
        setErrors(found);
        const firstInvalid = (["name", "email", "body"] as const).find((field) => found[field]);
        if (firstInvalid) {
            ({ name: nameRef, email: emailRef, body: bodyRef })[firstInvalid].current?.focus();
            return;
        }

        setStatus({ kind: "sending" });
        try {
            const response = await fetch(blogPostCommentsApiUrl(blogId), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, email, body, token, [COMMENT_HONEYPOT_FIELD]: trap }),
            });
            const data = (await response.json().catch(() => null)) as {
                success?: boolean;
                message?: string;
                error?: { message?: string; details?: Partial<Record<Field, string[]>> };
            } | null;

            if (response.ok && data?.success) {
                setName("");
                setEmail("");
                setBody("");
                setErrors({});
                setStatus({ kind: "sent", message: data.message ?? SENT_FALLBACK });
                return;
            }

            const details = data?.error?.details;
            if (details) setErrors({ name: details.name?.[0], email: details.email?.[0], body: details.body?.[0] });
            setStatus({ kind: "error", message: data?.error?.message ?? "Something went wrong while sending your comment. Please try again." });
        } catch {
            setStatus({ kind: "error", message: "We couldn't reach the server. Check your connection and try again." });
        }
    }

    if (status.kind === "sent") {
        return (
            <div role="status" className="rounded-2xl border border-brand/20 bg-brand-soft/60 p-5 sm:p-7">
                <div className="flex items-start gap-4">
                    <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-brand text-brand-foreground">
                        <CheckCircle2 className="size-5" />
                    </span>
                    <div className="min-w-0 space-y-4">
                        <p className="pt-1.5 font-medium text-foreground">{status.message}</p>
                        <Button type="button" variant="outline" className="h-11 px-5 text-sm" onClick={() => setStatus({ kind: "idle" })}>
                            Write another comment
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <form onSubmit={onSubmit} noValidate aria-labelledby={id("title")} className="rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-7">
            <h3 id={id("title")} className="font-display text-xl font-bold tracking-tight text-foreground md:text-2xl">
                Leave a comment
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                Comments are reviewed before they appear. Your email is optional and is never shown.
            </p>

            <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                    <Label htmlFor={id("name")}>
                        Name <span aria-hidden className="text-destructive">*</span>
                    </Label>
                    <Input
                        ref={nameRef}
                        id={id("name")}
                        dir="auto"
                        autoComplete="name"
                        placeholder="Enter your name or a nickname"
                        required
                        maxLength={COMMENT_LIMITS.name * 2}
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        aria-invalid={Boolean(errors.name)}
                        aria-describedby={errors.name ? id("name-error") : undefined}
                        className="h-11 px-3 md:text-base"
                    />
                    {errors.name && (
                        <p id={id("name-error")} className="text-sm text-destructive">
                            {errors.name}
                        </p>
                    )}
                </div>

                <div className="space-y-2">
                    <Label htmlFor={id("email")}>
                        Email <span className="font-normal text-muted-foreground">(optional)</span>
                    </Label>
                    <Input
                        ref={emailRef}
                        id={id("email")}
                        type="email"
                        dir="ltr"
                        autoComplete="email"
                        autoCapitalize="none"
                        spellCheck={false}
                        placeholder="name@example.com (optional)"
                        maxLength={COMMENT_LIMITS.email}
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        aria-invalid={Boolean(errors.email)}
                        aria-describedby={errors.email ? id("email-error") : undefined}
                        className="h-11 px-3 md:text-base"
                    />
                    {errors.email && (
                        <p id={id("email-error")} className="text-sm text-destructive">
                            {errors.email}
                        </p>
                    )}
                </div>
            </div>

            <div className="mt-5 space-y-2">
                <Label htmlFor={id("body")}>
                    Comment <span aria-hidden className="text-destructive">*</span>
                </Label>
                <Textarea
                    ref={bodyRef}
                    id={id("body")}
                    dir="auto"
                    required
                    rows={5}
                    placeholder="Share your thoughts, ask a question, or add something helpful…"
                    value={body}
                    onChange={(event) => setBody(event.target.value)}
                    aria-invalid={Boolean(errors.body)}
                    aria-describedby={[errors.body ? id("body-error") : null, id("count")].filter(Boolean).join(" ")}
                    className="min-h-36 resize-y px-3 py-2.5 leading-relaxed md:text-base"
                />
                <div className="flex items-start justify-between gap-3">
                    <p id={id("body-error")} className="text-sm text-destructive">
                        {errors.body}
                    </p>
                    <p
                        id={id("count")}
                        className={cn("ms-auto shrink-0 text-xs tabular-nums text-muted-foreground", body.length > COMMENT_LIMITS.body && "font-medium text-destructive")}
                    >
                        <bdi dir="ltr">
                            {body.length} / {COMMENT_LIMITS.body}
                        </bdi>
                    </p>
                </div>
            </div>

            {/* Honeypot: invisible and unreachable for people (and screen readers); scripts fill in every field they find. */}
            <div aria-hidden inert className="pointer-events-none absolute size-0 overflow-hidden opacity-0">
                <label htmlFor={id("website")}>Leave this field empty</label>
                <input id={id("website")} name={COMMENT_HONEYPOT_FIELD} type="text" tabIndex={-1} autoComplete="off" value={trap} onChange={(event) => setTrap(event.target.value)} />
            </div>

            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div aria-live="polite" className="min-h-5 text-sm">
                    {status.kind === "error" && (
                        <p role="alert" className="font-medium text-destructive">
                            {status.message}
                        </p>
                    )}
                </div>
                <Button type="submit" disabled={sending} className="h-11 bg-brand px-6 text-[0.9375rem] text-brand-foreground hover:bg-brand/90 sm:w-auto">
                    {sending ? <Loader2 aria-hidden className="animate-spin" /> : <Send aria-hidden className="rtl:-scale-x-100" />}
                    {sending ? "Sending…" : "Post comment"}
                </Button>
            </div>
        </form>
    );
}
