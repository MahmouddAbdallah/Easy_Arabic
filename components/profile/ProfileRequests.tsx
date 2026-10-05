'use client';

import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { BookOpen, Inbox, Loader2Icon, Mail, MessageSquareText, Phone, Send, Undo2, User, type LucideIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { getApiError } from '@/lib/auth/client';
import { formatDateTime } from '@/lib/profile/format';
import { PROFILE_FIELDS, PROFILE_FIELD_LABELS, type ProfileField } from '@/lib/profile/rules';
import type { CustomerRequest, OwnProfile } from '@/lib/profile/service';
import { ChangeDiff } from './ChangeDiff';
import { RequestStatusBadge } from './RequestStatusBadge';

const REASON_MAX = 500;

const FIELD_INPUT: Record<ProfileField, { icon: LucideIcon; type: string; autoComplete?: string; inputMode?: 'tel' | 'email' }> = {
    name: { icon: User, type: 'text', autoComplete: 'name' },
    subject: { icon: BookOpen, type: 'text' },
    email: { icon: Mail, type: 'email', autoComplete: 'email', inputMode: 'email' },
    phone: { icon: Phone, type: 'tel', autoComplete: 'tel', inputMode: 'tel' },
};

type FormValues = Record<ProfileField, string> & { reason: string };

type Props = {
    profile: OwnProfile;
    /** Fields a request may contain right now (decided on the server). */
    requestableFields: ProfileField[];
    canEditDirectly: boolean;
    pendingRequest: CustomerRequest | null;
    /** Everything that is not pending, newest first. */
    history: CustomerRequest[];
};

export function ProfileRequests({ profile, requestableFields, canEditDirectly, pendingRequest, history }: Props) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                    <MessageSquareText className="size-4 text-brand" aria-hidden="true" />
                    Change requests
                </CardTitle>
                <CardDescription>
                    {canEditDirectly
                        ? 'Need a different email or phone number? Ask the admin to update it.'
                        : 'Ask the admin to update your details. You\u2019ll see the answer here.'}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {pendingRequest ? <PendingRequest request={pendingRequest} /> : <RequestForm profile={profile} requestableFields={requestableFields} />}

                <section aria-labelledby="request-history">
                    <h3 id="request-history" className="mb-3 text-sm font-semibold">
                        Previous requests
                    </h3>
                    {history.length === 0 ? (
                        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                            <Inbox className="size-5" aria-hidden="true" />
                            No earlier requests yet.
                        </div>
                    ) : (
                        <ul className="space-y-3">
                            {history.map((request) => (
                                <li key={request.id} className="space-y-3 rounded-xl border p-4">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <RequestStatusBadge status={request.status} />
                                        <span className="text-xs text-muted-foreground">Sent {formatDateTime(request.createdAt)}</span>
                                    </div>
                                    <ChangeDiff requested={request.requestedChanges} current={request.currentValues} />
                                    {request.reason && <Quote label="Your message">{request.reason}</Quote>}
                                    {request.adminNote && <Quote label="Admin reply" tone="admin">{request.adminNote}</Quote>}
                                    {request.reviewedAt && <p className="text-xs text-muted-foreground">Answered {formatDateTime(request.reviewedAt)}</p>}
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </CardContent>
        </Card>
    );
}

function Quote({ label, tone, children }: { label: string; tone?: 'admin'; children: string }) {
    return (
        <div className={tone === 'admin' ? 'rounded-lg border border-brand/20 bg-brand-soft/60 p-3' : 'rounded-lg bg-muted/50 p-3'}>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="mt-1 whitespace-pre-wrap wrap-break-word text-sm">{children}</p>
        </div>
    );
}

function PendingRequest({ request }: { request: CustomerRequest }) {
    const router = useRouter();
    const [withdrawing, setWithdrawing] = useState(false);

    const withdraw = async () => {
        setWithdrawing(true);
        try {
            const { data } = await axios.delete(`/api/profile/change-requests/${request.id}`);
            toast.success(data.message);
        } catch (error: unknown) {
            const err = getApiError(error);
            if (err.status === 401) return router.push('/sign-in');
            toast.error(err.message);
        } finally {
            setWithdrawing(false);
            router.refresh();
        }
    };

    return (
        <section aria-label="Your pending request" className="space-y-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <RequestStatusBadge status="PENDING" />
                <span className="text-xs text-muted-foreground">Sent {formatDateTime(request.createdAt)}</span>
            </div>
            <p className="text-sm text-muted-foreground">
                The admin hasn&apos;t answered yet. You can send a new request once this one is answered, or withdraw it to start over.
            </p>
            <ChangeDiff requested={request.requestedChanges} current={request.currentValues} />
            {request.reason && <Quote label="Your message">{request.reason}</Quote>}
            <Button type="button" variant="outline" onClick={withdraw} disabled={withdrawing}>
                {withdrawing ? <Loader2Icon className="mr-2 size-4 animate-spin" /> : <Undo2 className="mr-2 size-4" aria-hidden="true" />}
                Withdraw request
            </Button>
        </section>
    );
}

function RequestForm({ profile, requestableFields }: { profile: OwnProfile; requestableFields: ProfileField[] }) {
    const router = useRouter();
    const defaults: FormValues = {
        name: profile.name,
        subject: profile.subject,
        email: profile.email,
        phone: profile.phone ?? '',
        reason: ''
    };
    const {
        register,
        handleSubmit,
        reset,
        control,
        formState: { errors, isSubmitting, dirtyFields },
    } = useForm<FormValues>({ defaultValues: defaults });

    const fields = PROFILE_FIELDS.filter((f) => requestableFields.includes(f));
    const reasonLength = (useWatch({ control, name: 'reason' }) ?? '').length;
    const hasChange = fields.some((f) => dirtyFields[f]);

    const onSubmit = handleSubmit(async (values) => {
        const changes: Partial<Record<ProfileField, string>> = {};
        for (const field of fields) if (dirtyFields[field]) changes[field] = values[field].trim();
        if (Object.keys(changes).length === 0) return toast.error('Change at least one detail first.');

        try {
            const { data } = await axios.post('/api/profile/change-requests', { changes, reason: values.reason.trim() || undefined });
            toast.success(data.message);
            reset(defaults);
        } catch (error: unknown) {
            const err = getApiError(error);
            if (err.status === 401) return router.push('/sign-in');
            toast.error(err.message);
        } finally {
            // Always re-read from the server: the request may exist now, or the profile may have changed.
            router.refresh();
        }
    });

    return (
        <form onSubmit={onSubmit} noValidate className="space-y-4" aria-label="Send a change request">
            <p className="text-sm text-muted-foreground">Edit only the details you want changed. Anything you leave as it is won&apos;t be sent.</p>

            {fields.map((field) => {
                const { icon: Icon, type, autoComplete, inputMode } = FIELD_INPUT[field];
                return (
                    <div key={field} className="space-y-1.5">
                        <Label htmlFor={`request-${field}`}>
                            <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
                            {PROFILE_FIELD_LABELS[field]}
                        </Label>
                        <Input
                            id={`request-${field}`}
                            type={type}
                            autoComplete={autoComplete}
                            inputMode={inputMode}
                            disabled={isSubmitting}
                            aria-invalid={!!errors[field]}
                            {...register(field, {
                                validate: (v) => {
                                    const value = v.trim();
                                    if (!value) return `${PROFILE_FIELD_LABELS[field]} can't be empty`;
                                    if (field === 'email' && !/^\S+@\S+\.\S+$/.test(value)) return 'Enter a valid email address';
                                    if (field === 'phone' && !/^[+\d\s().-]+$/.test(value)) return 'Enter a valid phone number';
                                    return true;
                                },
                            })}
                        />
                        {errors[field] && <p className="text-xs text-destructive">{errors[field]?.message}</p>}
                    </div>
                );
            })}

            <div className="space-y-1.5">
                <Label htmlFor="request-reason">Message to the admin (optional)</Label>
                <Textarea
                    id="request-reason"
                    rows={3}
                    maxLength={REASON_MAX}
                    placeholder="Anything the admin should know, for example why you need this change."
                    disabled={isSubmitting}
                    {...register('reason')}
                />
                <p className="text-right text-xs text-muted-foreground tabular-nums">
                    {reasonLength}/{REASON_MAX}
                </p>
            </div>

            <Button type="submit" disabled={!hasChange || isSubmitting} className="w-full font-semibold sm:w-auto">
                {isSubmitting ? (
                    <>
                        <Loader2Icon className="mr-2 size-4 animate-spin" />
                        Sending...
                    </>
                ) : (
                    <>
                        <Send className="mr-2 size-4" aria-hidden="true" />
                        Send request to admin
                    </>
                )}
            </Button>
        </form>
    );
}
