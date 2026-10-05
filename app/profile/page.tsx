import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { authorization } from '@/lib/verifyAuth';
import { getProfileOverview } from '@/lib/profile/service';
import { PasswordCard } from '@/components/profile/PasswordCard';
import { ProfileDetailsForm } from '@/components/profile/ProfileDetailsForm';
import { ProfileHero } from '@/components/profile/ProfileHero';
import { ProfileNotice } from '@/components/profile/ProfileNotice';
import { ProfileRequests } from '@/components/profile/ProfileRequests';

export const metadata: Metadata = {
    title: 'Profile',
    robots: { index: false },
    description: 'View your account details and ask the admin to update them.',
};

/** Customer (`family`) Profile / Settings. Everything is loaded for the signed-in user only. */
export default async function ProfilePage() {
    const { user } = await authorization();
    if (!user) redirect('/sign-in');
    // Customer-only page: teachers and admins have their own tools.
    if (user.role !== 'family') redirect('/');

    const result = await getProfileOverview(user.id);
    if (!result.ok) redirect('/');
    const { profile, eligibility, pendingRequest, requests } = result.data;

    return (
        <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6 lg:p-8">
            <ProfileHero name={profile.name} createdAt={profile.createdAt} />
            <ProfileNotice eligibility={eligibility} />
            <ProfileDetailsForm profile={profile} canEditDirectly={eligibility.canEditDirectly} />
            <ProfileRequests
                profile={profile}
                requestableFields={eligibility.requestableFields}
                canEditDirectly={eligibility.canEditDirectly}
                pendingRequest={pendingRequest}
                history={requests.filter((r) => r.status !== 'PENDING')}
            />
            <PasswordCard />
        </div>
    );
}
