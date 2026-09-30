import { Calendar, Clock, Users, Banknote, PlusCircle, BookOpen, MessageCircle } from 'lucide-react';
import WelcomeBanner from './WelcomeBanner';
import StatCard from './StatCard';
import QuickLinks, { type QuickLink } from './QuickLinks';
import RecentLessons from './RecentLessons';
import { getTeacherOverview } from '@/lib/data/home-data';

const quickLinks: QuickLink[] = [
    { href: '/lesson/new-lesson', label: 'Log a Lesson', description: 'Record a lesson you just taught', icon: PlusCircle },
    { href: '/lesson', label: 'My Lessons', description: 'Browse your full lesson history', icon: BookOpen },
    { href: '/chat', label: 'Messages', description: 'Open your conversations', icon: MessageCircle },
];

export default async function TeacherHome({ id, name, role }: { id: string; name: string; role: string }) {
    const result = await getTeacherOverview(id);
    const data = result.success ? result.data : null;
    const hours = data ? (data.minutesThisMonth / 60).toFixed(1) : null;

    return (
        <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6">
            <WelcomeBanner name={name} role={role} />

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                <StatCard icon={Calendar} label="Lessons This Month" value={data ? String(data.lessonsThisMonth) : '—'} />
                <StatCard icon={Clock} label="Hours Taught" value={hours ? `${hours}h` : '—'} hint="This month" />
                <StatCard icon={Users} label="Families" value={data ? String(data.familyCount) : '—'} />
                <StatCard icon={Banknote} label="Earnings" value={data ? `$${data.moneyThisMonth}` : '—'} hint="This month" />
            </div>

            <QuickLinks links={quickLinks} />

            <RecentLessons
                lessons={data?.recent ?? []}
                variant="teacher"
                emptyHint="Lessons you log will show up here."
            />
        </div>
    );
}
