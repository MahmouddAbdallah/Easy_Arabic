import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { authorization } from '@/lib/verifyAuth';
import { listProfileChangeRequests, type RequestStatus } from '@/lib/profile/service';
import { ProfileRequestsList, type StatusFilter } from '@/components/dashboard/profile-requests/ProfileRequestsList';

export const metadata: Metadata = { title: 'Profile requests', robots: { index: false } };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const STATUS_BY_KEY: Record<string, RequestStatus> = {
    pending: 'PENDING',
    approved: 'APPROVED',
    rejected: 'REJECTED',
    cancelled: 'CANCELLED',
};

export default async function ProfileRequestsPage({ searchParams }: { searchParams: SearchParams }) {
    // Admin only. (The data helper re-checks the session too.)
    const { error } = await authorization(['admin']);
    if (error) redirect(error.code === 'INSUFFICIENT_PERMISSIONS' ? '/' : '/sign-in');

    const params = await searchParams;
    const rawStatus = Array.isArray(params.status) ? params.status[0] : params.status;
    // No filter given -> what needs attention. "all" -> no filter.
    const status: StatusFilter = rawStatus === 'all' ? null : STATUS_BY_KEY[rawStatus ?? 'pending'] ?? 'PENDING';
    const rawPage = Number(Array.isArray(params.page) ? params.page[0] : params.page);
    const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;

    const result = await listProfileChangeRequests({ status, page });
    if (!result.ok) redirect('/');

    return (
        <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
            <header className="flex flex-col gap-2 border-b border-border/40 pb-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">Profile Requests</h1>
                    <p className="mt-0.5 text-sm text-muted-foreground">Review changes customers have asked for. Approving applies them to the account.</p>
                </div>
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <span className="size-2 rounded-full bg-amber-500" aria-hidden />
                    <span className="font-semibold tabular-nums text-foreground">{result.data.totals.PENDING}</span> waiting for review
                </p>
            </header>
            <ProfileRequestsList list={result.data} activeStatus={status} />
        </div>
    );
}
