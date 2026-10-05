'use client';

import { useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Loader2Icon, TriangleAlert, XCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ChangeDiff } from '@/components/profile/ChangeDiff';
import { RequestStatusBadge } from '@/components/profile/RequestStatusBadge';
import { getApiError } from '@/lib/auth/client';
import { formatDateTime } from '@/lib/profile/format';
import { PROFILE_FIELDS, PROFILE_FIELD_LABELS } from '@/lib/profile/rules';
import type { AdminRequest } from '@/lib/profile/service';
import type { ProfileValues } from '@/lib/profile/validation';

const NOTE_MAX = 500;

type Decision = 'approve' | 'reject';

export function ReviewRequestDialog({ request, open, onOpenChange }: { request: AdminRequest; open: boolean; onOpenChange: (open: boolean) => void }) {
    const router = useRouter();
    const [note, setNote] = useState('');
    const [pending, setPending] = useState<Decision | null>(null);
    const [error, setError] = useState<string | null>(null);

    const isPending = request.status === 'PENDING';
    const requestedFields = PROFILE_FIELDS.filter((f) => request.requestedChanges[f] !== undefined);

    // What the account holds RIGHT NOW (this is what approving would overwrite), not just the snapshot.
    const live: ProfileValues = request.family
        ? { name: request.family.name, subject: request.family.subject, email: request.family.email, phone: request.family.phone }
        : request.currentValues;
    const drifted = requestedFields.filter((f) => request.currentValues[f] !== undefined && live[f] !== request.currentValues[f]);
    const emailChange = request.requestedChanges.email !== undefined;

    const decide = async (decision: Decision) => {
        setError(null);
        if (decision === 'reject' && !note.trim()) {
            setError('Please tell the customer why this request is being rejected.');
            return;
        }
        setPending(decision);
        try {
            const { data } = await axios.patch(`/api/profile-change-requests/${request.id}`, { decision, adminNote: note.trim() || undefined });
            toast.success(data.message);
            onOpenChange(false);
            setNote('');
            router.refresh();
        } catch (e: unknown) {
            const err = getApiError(e);
            if (err.status === 401) return router.push('/sign-in');
            setError(err.message);
            // Someone else may have answered it already: show the up-to-date state.
            if (err.code === 'ALREADY_REVIEWED') router.refresh();
        } finally {
            setPending(null);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
            <DialogContent className="flex max-h-[88vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
                <DialogHeader className="shrink-0 gap-2 border-b p-4 pr-12 sm:p-6 sm:pr-14">
                    <div className="flex flex-wrap items-center gap-2">
                        <DialogTitle className="text-lg font-semibold">Profile change request</DialogTitle>
                        <RequestStatusBadge status={request.status} />
                    </div>
                    <DialogDescription>
                        From <span className="font-medium text-foreground">{request.family?.name ?? 'a deleted account'}</span>
                        {request.family?.email && <> ({request.family.email})</>} &middot; sent {formatDateTime(request.createdAt)}
                    </DialogDescription>
                </DialogHeader>

                <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
                    <section aria-label="Requested changes" className="space-y-2">
                        <h3 className="text-sm font-semibold">{isPending ? 'Current value  \u2192  requested value' : 'Requested changes'}</h3>
                        <ChangeDiff requested={request.requestedChanges} current={isPending ? live : request.currentValues} />
                    </section>

                    {isPending && drifted.length > 0 && (
                        <div role="alert" className="flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
                            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden="true" />
                            <p>
                                Changed since this request was sent:{' '}
                                {drifted.map((f) => `${PROFILE_FIELD_LABELS[f]} was "${request.currentValues[f]}"`).join('; ')}. The values above are the current ones.
                            </p>
                        </div>
                    )}

                    {request.reason && (
                        <section aria-label="Customer message" className="rounded-lg bg-muted/50 p-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Customer&apos;s message</p>
                            <p className="mt-1 whitespace-pre-wrap break-words text-sm">{request.reason}</p>
                        </section>
                    )}

                    {isPending ? (
                        <section className="space-y-2">
                            <Label htmlFor="admin-note">Reply to the customer {note.length === 0 && <span className="font-normal text-muted-foreground">(required if you reject)</span>}</Label>
                            <Textarea
                                id="admin-note"
                                rows={3}
                                maxLength={NOTE_MAX}
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                disabled={!!pending}
                                placeholder="Shown to the customer on their profile page."
                            />
                            {emailChange && (
                                <p className="text-xs text-muted-foreground">
                                    Approving an email change marks the new address as unverified and invalidates any password-reset or verification links sent to the old one.
                                </p>
                            )}
                            {error && (
                                <p role="alert" className="text-sm text-destructive">
                                    {error}
                                </p>
                            )}
                        </section>
                    ) : (
                        <section aria-label="Decision" className="rounded-lg border border-brand/20 bg-brand-soft/60 p-3 text-sm">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                {request.status === 'CANCELLED' ? 'Withdrawn by the customer' : `Answered${request.reviewerName ? ` by ${request.reviewerName}` : ''}`}
                                {request.reviewedAt && <> &middot; {formatDateTime(request.reviewedAt)}</>}
                            </p>
                            {request.adminNote ? <p className="mt-1 whitespace-pre-wrap break-words">{request.adminNote}</p> : request.status !== 'CANCELLED' && <p className="mt-1 text-muted-foreground">No reply was written.</p>}
                        </section>
                    )}
                </div>

                {isPending && (
                    <DialogFooter className="shrink-0 border-t p-4 sm:p-6">
                        <Button type="button" variant="outline" disabled={!!pending} onClick={() => decide('reject')} className="text-destructive hover:text-destructive">
                            {pending === 'reject' ? <Loader2Icon className="mr-2 size-4 animate-spin" /> : <XCircle className="mr-2 size-4" aria-hidden="true" />}
                            Reject
                        </Button>
                        <Button type="button" disabled={!!pending} onClick={() => decide('approve')} className="font-semibold">
                            {pending === 'approve' ? <Loader2Icon className="mr-2 size-4 animate-spin" /> : <CheckCircle2 className="mr-2 size-4" aria-hidden="true" />}
                            Approve &amp; apply
                        </Button>
                    </DialogFooter>
                )}
            </DialogContent>
        </Dialog>
    );
}
