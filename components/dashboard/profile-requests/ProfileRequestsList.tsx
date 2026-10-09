'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Inbox } from 'lucide-react';

import PaginationPage from '@/components/PaginationPage';
import { Card } from '@/components/ui/card';
import { RequestStatusBadge } from '@/components/profile/RequestStatusBadge';
import { getInitials } from '@/components/dashboard/users/userDisplay';
import { formatDateTime } from '@/lib/profile/format';
import { PROFILE_FIELDS, PROFILE_FIELD_LABELS } from '@/lib/profile/rules';
import type { AdminRequest, AdminRequestList, RequestStatus } from '@/lib/profile/service';
import { cn } from 'cn';
import { ReviewRequestDialog } from './ReviewRequestDialog';

export type StatusFilter = RequestStatus | null;

const TABS: { key: string; label: string; status: StatusFilter }[] = [
    { key: 'pending', label: 'Pending', status: 'PENDING' },
    { key: 'approved', label: 'Approved', status: 'APPROVED' },
    { key: 'rejected', label: 'Rejected', status: 'REJECTED' },
    { key: 'cancelled', label: 'Withdrawn', status: 'CANCELLED' },
    { key: 'all', label: 'All', status: null },
];

export function ProfileRequestsList({ list, activeStatus }: { list: AdminRequestList; activeStatus: StatusFilter }) {
    const [selected, setSelected] = useState<AdminRequest | null>(null);
    const { requests, count, pageSize, totals } = list;

    return (
        <div className="space-y-4">
            <nav aria-label="Filter requests by status" className="flex flex-wrap gap-2">
                {TABS.map((tab) => {
                    const active = tab.status === activeStatus;
                    const total = tab.status ? totals[tab.status] : totals.all;
                    return (
                        <Link
                            key={tab.key}
                            href={`/dashboard/profile-requests?status=${tab.key}`}
                            aria-current={active ? 'page' : undefined}
                            className={cn(
                                'inline-flex h-8 items-center gap-2 rounded-full border px-3 text-sm font-medium transition-colors',
                                active ? 'border-brand bg-brand text-white' : 'bg-card text-muted-foreground hover:bg-muted hover:text-foreground'
                            )}
                        >
                            {tab.label}
                            <span
                                className={cn(
                                    'rounded-full px-1.5 text-xs tabular-nums',
                                    active ? 'bg-white/20' : tab.key === 'pending' && total > 0 ? 'bg-amber-500/15 font-semibold text-amber-700 dark:text-amber-400' : 'bg-muted'
                                )}
                            >
                                {total}
                            </span>
                        </Link>
                    );
                })}
            </nav>

            <Card className="gap-0 py-0 shadow-sm">
                {requests.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 px-4 py-14 text-center text-sm text-muted-foreground">
                        <Inbox className="size-6" aria-hidden="true" />
                        <p className="font-medium text-foreground">{activeStatus === 'PENDING' ? 'Nothing waiting for review' : 'No requests here'}</p>
                        <p>{activeStatus === 'PENDING' ? 'New requests from customers will show up here.' : 'Try another status.'}</p>
                    </div>
                ) : (
                    <ul className="divide-y">
                        {requests.map((request) => {
                            const fields = PROFILE_FIELDS.filter((f) => request.requestedChanges[f] !== undefined);
                            const name = request.family?.name ?? 'Deleted account';
                            return (
                                <li key={request.id}>
                                    <button
                                        type="button"
                                        onClick={() => setSelected(request)}
                                        className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
                                    >
                                        <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                                            {getInitials(name)}
                                        </span>
                                        <span className="min-w-0 flex-1 space-y-1.5 md:grid md:grid-cols-[13rem_minmax(0,1fr)_9rem] md:items-center md:gap-4 md:space-y-0">
                                            <span className="block min-w-0">
                                                <span className="block truncate text-sm font-semibold">{name}</span>
                                                <span className="block truncate text-xs text-muted-foreground">{request.family?.email}</span>
                                            </span>
                                            <span className="flex flex-wrap gap-1.5">
                                                {fields.map((f) => (
                                                    <span key={f} className="rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                                                        {PROFILE_FIELD_LABELS[f]}
                                                    </span>
                                                ))}
                                            </span>
                                            <span className="flex items-center gap-2 md:flex-col md:items-end md:gap-1">
                                                <RequestStatusBadge status={request.status} />
                                                <span className="text-xs text-muted-foreground">{formatDateTime(request.createdAt)}</span>
                                            </span>
                                        </span>
                                        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
                {count > pageSize && <PaginationPage pageSize={pageSize} count={count} variant="table" />}
            </Card>

            {selected && (
                <ReviewRequestDialog
                    // Re-mount per request so the reply box never carries over to another one.
                    key={selected.id}
                    request={requests.find((r) => r.id === selected.id) ?? selected}
                    open
                    onOpenChange={(open) => !open && setSelected(null)}
                />
            )}
        </div>
    );
}
