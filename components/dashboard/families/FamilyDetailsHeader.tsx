import { BookOpen, Calendar, CalendarCheck, CalendarX, GraduationCap } from 'lucide-react'
import ProfileCard from '@/components/dashboard/users/ProfileCard'
import ProfileSectionNav from '@/components/dashboard/users/ProfileSectionNav'
import StatTile from '@/components/dashboard/users/StatTile'
import { getFamilyOverview } from '@/lib/data/home-data'
import { getTeacherFamilies } from '@/lib/data/families'
import { getLessons } from '@/lib/data/lessons'
import { countPendingRequests } from '@/lib/planner/service'
import { getUser } from '@/lib/data/users'

const formatDay = (date: string | Date) =>
    new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

const formatTime = (date: string | Date) =>
    new Date(date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

/**
 * Profile card + stats + section nav. Fetched here (not in layout.tsx) so the
 * layout can render instantly and stream this block behind a skeleton.
 */
const FamilyDetailsHeader = async ({ familyId }: { familyId: string }) => {
    const [{ data }, totalTeachers, totalLessons, overview, pendingRequests] = await Promise.all([
        getUser(familyId, ['id', 'name', 'email', 'phone', 'status', 'subject']),
        getTeacherFamilies({ filter: { where: [{ key: 'familyId', value: familyId }], justCount: true } }),
        getLessons({ filter: { where: [{ key: 'familyId', value: familyId }], justCount: true } }),
        getFamilyOverview(familyId),
        countPendingRequests({ kind: 'family', id: familyId }),
    ])

    const teachersCount = totalTeachers?.count ?? 0
    const lessonsCount = totalLessons?.count ?? 0
    const month = overview.success ? overview.data : null
    const next = month?.nextLesson ?? null

    return (
        <section className="space-y-6">
            <ProfileCard
                name={data?.name}
                roleLabel={data?.subject ? `${data.subject} Family` : 'Family'}
                email={data?.email}
                phone={data?.phone}
                status={data?.status}
            />

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatTile
                    icon={next ? CalendarCheck : CalendarX}
                    label="Next Lesson"
                    value={next ? formatDay(next.classDate) : 'None'}
                    hint={
                        next
                            ? `${formatTime(next.classDate)} · ${next.student ?? 'Student'}${next.teacher ? ` with ${next.teacher.name}` : ''}`
                            : 'Nothing scheduled'
                    }
                />
                <StatTile
                    icon={Calendar}
                    label="Lessons This Month"
                    value={month ? String(month.lessonsThisMonth) : '—'}
                />
                <StatTile icon={BookOpen} label="Lessons" value={String(lessonsCount)} hint="All time" />
                <StatTile icon={GraduationCap} label="Teachers" value={String(teachersCount)} />
            </div>

            <ProfileSectionNav kind="family" id={familyId} totalLessons={lessonsCount} totalLinked={teachersCount} pendingRequests={pendingRequests} />
        </section>
    )
}

export default FamilyDetailsHeader
