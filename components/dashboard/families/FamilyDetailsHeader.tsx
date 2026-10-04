import { Award, Calendar, CalendarCheck, CalendarX, GraduationCapIcon, MailIcon } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { getFamilyOverview } from '@/lib/data/home-data'
import StatTile from '../users/StatTile'
import { DURATION_MAP } from '@/components/lesson/LessonOptions'
import { getUser } from '@/lib/data/users'
import { getTeacherFamilies } from '@/lib/data/families'
import { getLessons } from '@/lib/data/lessons'
import { formatWhen } from '@/components/home/RecentLessons'
import FamilySectionNav from './FamilySectionNav'
/**
 * Profile card + stats + section nav. Fetched here (not in layout.tsx) so the
 * layout can render instantly and stream this block behind a skeleton.
 */
const FamilyDetailsHeader = async ({ familyId }: { familyId: string }) => {
    const [{ data }, totalTeachers, totalLessons, overview] = await Promise.all([
        getUser(familyId, ['id', 'name', 'email', 'subject']),
        getTeacherFamilies({ filter: { where: [{ key: 'familyId', value: familyId }], justCount: true } }),
        getLessons({ filter: { where: [{ key: 'familyId', value: familyId }], justCount: true } }),
        getFamilyOverview(familyId),
    ])

    const next = data?.overview;
    const nextDuration = next ? DURATION_MAP[String(next.duration)] : null;

    const teacherCount = totalTeachers?.count ?? 0
    const lessonsCount = totalLessons?.count ?? 0
    const month = overview.success ? overview.data : null
    const hours = month ? `${(month.lessonsThisMonth / 60).toFixed(1)}h` : '—'


    return (
        <section className="space-y-6">
            {/* Profile */}
            <Card className="gap-0 overflow-hidden border-border/60 py-0">
                {/* Brand band, same language as the Home WelcomeBanner */}
                <div className="relative h-20 bg-brand-deep sm:h-24" aria-hidden="true">
                    <div
                        className="pointer-events-none absolute inset-0 pattern-khatam text-white opacity-[0.06]"
                        style={{ ['--pattern-size' as string]: '49px' }}
                    />
                    <div className="absolute inset-x-0 bottom-0 h-px bg-gold/40" />
                </div>

                <div className="flex flex-col gap-4 px-5 pt-2 pb-5 sm:flex-row sm:items-end sm:gap-5 sm:px-6 sm:pb-6">
                    <Avatar className="-mt-10 h-20 w-20 shrink-0 shadow-sm ring-4 ring-card sm:-mt-12 sm:h-24 sm:w-24">
                        <AvatarImage src={data?.avatar} alt={data?.name} />
                        <AvatarFallback className="bg-brand-soft text-xl font-bold text-brand sm:text-2xl">
                            {data?.name?.slice(0, 2)}
                        </AvatarFallback>
                    </Avatar>

                    <div className="min-w-0 flex-1 space-y-1.5">
                        <h1 className="truncate text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                            {data?.name}
                        </h1>
                        <div className=" text-sm text-muted-foreground">
                            <p className="flex items-center gap-1.5">
                                <Award className="h-4 w-4 text-brand" />
                                {data?.subject ? `${data.subject} Family` : 'Family'}
                            </p>
                            <p>
                                {data?.email && (
                                    <a
                                        href={`mailto:${data.email}`}
                                        className="flex min-w-0 items-center gap-1.5 transition-colors hover:text-foreground"
                                    >
                                        <MailIcon className="h-3.5 w-3.5 shrink-0" />
                                        <span className="truncate">{data.email}</span>
                                    </a>
                                )}
                            </p>
                        </div>
                    </div>

                </div>
            </Card>
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
            {/* Stats */}
            <div className="grid grid-cols-2 sm-grid-cols-3 md-grid-cols-4 lg-grid-cols-5 gap-3">
                <StatTile icon={Calendar} label="Lessons This Month" value={data ? String(hours) : '—'} />
                <StatTile icon={GraduationCapIcon} label="Your Teachers" value={data ? String(teacherCount) : '—'} />
            </div>

            <FamilySectionNav familyId={familyId} totalLessons={lessonsCount} totalTeachers={teacherCount} />
        </section>
    )
}

export default FamilyDetailsHeader
