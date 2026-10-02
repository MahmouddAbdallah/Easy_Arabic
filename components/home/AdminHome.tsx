import { GraduationCap, Users, Calendar, TrendingUp, PlusCircle, MessageCircle } from 'lucide-react';
import WelcomeBanner from './WelcomeBanner';
import StatCard from './StatCard';
import QuickLinks, { type QuickLink } from './QuickLinks';
import RecentLessons from './RecentLessons';
import { getAdminOverview } from '@/lib/data/home-data';

const quickLinks: QuickLink[] = [
    { href: '/dashboard/teacher', label: 'Manage Teachers', description: 'View and manage the teacher directory', icon: GraduationCap },
    { href: '/dashboard/families', label: 'Manage Families', description: 'View and manage the family directory', icon: Users },
    { href: '/lesson/new-lesson', label: 'Log a Lesson', description: 'Record a new lesson', icon: PlusCircle },
    { href: '/chat', label: 'Messages', description: 'Open your conversations', icon: MessageCircle },
];

export default async function AdminHome({ name, role }: { name: string; role: string }) {
    const result = await getAdminOverview();
    const data = result.success ? result.data : null;

    return (
        <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6">
            <WelcomeBanner name={name} role={role} />

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                <StatCard icon={GraduationCap} label="Teachers" value={data ? String(data.teacherCount) : '—'} />
                <StatCard icon={Users} label="Families" value={data ? String(data.familyCount) : '—'} />
                <StatCard icon={Calendar} label="Lessons This Month" value={data ? String(data.lessonsThisMonth) : '—'} />
                <StatCard
                    icon={TrendingUp}
                    label="Attendance Rate"
                    value={data?.attendanceRate != null ? `${data.attendanceRate}%` : '—'}
                    hint="This month"
                />
            </div>

            <QuickLinks links={quickLinks} />

            <RecentLessons
                lessons={data?.recent ?? []}
                variant="admin"
                emptyHint="Lessons logged by teachers will show up here."
            />
        </div>
    );
}
