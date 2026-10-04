import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import OverviewContent from '@/components/dashboard/overview/OverviewContent'
import OverviewHeader from '@/components/dashboard/overview/OverviewHeader'
import OverviewSkeleton from '@/components/dashboard/overview/OverviewSkeleton'
import { authorization } from '@/lib/verifyAuth'

export const metadata: Metadata = {
    title: 'Overview | Dashboard',
}

/**
 * Admin landing page of the dashboard. The page only guards access and renders
 * the header; the numbers stream in behind a skeleton so the page title and
 * navigation are never waiting on the database.
 */
const Page = async () => {
    const { user, error } = await authorization(['admin'])

    if (!user) {
        // Signed in but not an admin → their own home; otherwise → sign in.
        redirect(error?.code === 'INSUFFICIENT_PERMISSIONS' ? '/' : '/sign-in')
    }

    return (
        <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
            <OverviewHeader name={user.name} />
            <Suspense fallback={<OverviewSkeleton />}>
                <OverviewContent />
            </Suspense>
        </div>
    )
}

export default Page
