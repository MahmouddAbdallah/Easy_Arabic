import { Award, BookOpen, Calendar, Clock, Banknote, Mail, Users } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { getUser } from '@/lib/data/users'
import { getMoney, getTeacherFamilies } from '@/lib/data/families'
import { getLessons } from '@/lib/data/lessons'
import { getTeacherOverview } from '@/lib/data/home-data'
import TeacherRateBadge from '@/components/dashboard/teachers/MoneyPerLessonView'
import TeacherSectionNav from '@/components/dashboard/teachers/TeacherSectionNav'
import StatTile from './StatTile'
/**
 * Profile card + stats + section nav. Fetched here (not in layout.tsx) so the
 * layout can render instantly and stream this block behind a skeleton.
 */
const TeacherDetailsHeader = async ({ id }: { id: string }) => {
    const [{ data }, totalFamilies, totalLessons, { money }, overview] = await Promise.all([
        getUser(id, ['id', 'name', 'email', 'subject']),
        getTeacherFamilies({ filter: { where: [{ key: 'teacherId', value: id }], justCount: true } }),
        getLessons({ filter: { where: [{ key: 'teacherId', value: id }], justCount: true } }),
        getMoney(id),
        getTeacherOverview(id),
    ])

    const familiesCount = totalFamilies?.count ?? 0
    const lessonsCount = totalLessons?.count ?? 0
    const month = overview.success ? overview.data : null
    const hours = month ? `${(month.minutesThisMonth / 60).toFixed(1)}h` : '—'

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
                                {data?.subject ? `${data.subject} Teacher` : 'Teacher'}
                            </p>
                            <p>
                                {data?.email && (
                                    <a
                                        href={`mailto:${data.email}`}
                                        className="flex min-w-0 items-center gap-1.5 transition-colors hover:text-foreground"
                                    >
                                        <Mail className="h-3.5 w-3.5 shrink-0" />
                                        <span className="truncate">{data.email}</span>
                                    </a>
                                )}
                            </p>
                        </div>
                    </div>

                    <div className="sm:shrink-0">
                        <TeacherRateBadge teacherId={id} initialMoney={money as any} />
                    </div>
                </div>
            </Card>

            {/* Stats */}
            <div className="grid grid-cols-2 sm-grid-cols-3 md-grid-cols-4 lg-grid-cols-5 gap-3">
                <StatTile icon={Users} label="Families" value={String(familiesCount)} />
                <StatTile icon={BookOpen} label="Lessons" value={String(lessonsCount)} hint="All time" />
                <StatTile
                    icon={Calendar}
                    label="Lessons This Month"
                    value={month ? String(month.lessonsThisMonth) : '—'}
                />
                <StatTile icon={Clock} label="Hours Taught" value={hours} hint="This month" />
                <StatTile
                    icon={Banknote}
                    label="Earnings"
                    value={month ? `$${month.moneyThisMonth.toLocaleString('en-US')}` : '—'}
                    hint="This month"
                    className="col-span-2 sm:col-span-1"
                />
            </div>

            <TeacherSectionNav teacherId={id} totalLessons={lessonsCount} totalStudents={familiesCount} />
        </section>
    )
}

export default TeacherDetailsHeader
