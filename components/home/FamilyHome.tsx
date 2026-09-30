import { Calendar, GraduationCap, MessageCircle, CalendarCheck, CalendarX } from 'lucide-react';
import WelcomeBanner from './WelcomeBanner';
import StatCard from './StatCard';
import QuickLinks, { type QuickLink } from './QuickLinks';
import RecentLessons, { formatWhen } from './RecentLessons';
import { getFamilyOverview } from '@/lib/data/home-data';
import { DURATION_MAP } from '@/components/lesson/LessonOptions';

const quickLinks: QuickLink[] = [
    { href: '/chat', label: 'Messages', description: 'Message your teacher directly', icon: MessageCircle },
];

export default async function FamilyHome({ id, name, role }: { id: string; name: string; role: string }) {
    const result = await getFamilyOverview(id);
    const data = result.success ? result.data : null;
    const next = data?.nextLesson;
    const nextDuration = next ? DURATION_MAP[String(next.duration)] : null;

    return (
        <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6">
            <WelcomeBanner name={name} role={role} />

            <div className="rounded-2xl border border-border/60 bg-card p-5 sm:p-6 flex items-center gap-4">
                <div className={`p-3 rounded-xl border shrink-0 ${next ? 'bg-brand-soft text-brand border-brand/20' : 'bg-muted text-muted-foreground border-transparent'}`}>
                    {next ? <CalendarCheck className="h-5 w-5" /> : <CalendarX className="h-5 w-5" />}
                </div>
                <div className="min-w-0">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Next Lesson</p>
                    {next ? (
                        <p className="text-sm sm:text-base font-bold text-foreground mt-0.5">
                            {next.student} with {next.teacher?.name ?? 'your teacher'} · {formatWhen(next.classDate)}
                            {nextDuration && <span className="text-muted-foreground font-medium"> · {nextDuration.label}</span>}
                        </p>
                    ) : (
                        <p className="text-sm text-muted-foreground mt-0.5">
                            No upcoming lesson scheduled yet — message your teacher to set one up.
                        </p>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3.5 max-w-lg">
                <StatCard icon={Calendar} label="Lessons This Month" value={data ? String(data.lessonsThisMonth) : '—'} />
                <StatCard icon={GraduationCap} label="Your Teachers" value={data ? String(data.teacherCount) : '—'} />
            </div>

            <QuickLinks links={quickLinks} />

            <RecentLessons
                lessons={data?.recent ?? []}
                variant="family"
                emptyHint="Lessons your teacher logs will show up here."
            />
        </div>
    );
}
