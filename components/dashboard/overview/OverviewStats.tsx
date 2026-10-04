import Link from 'next/link'
import { Calendar, GraduationCap, Inbox, Users } from 'lucide-react'
import StatTile from '@/components/dashboard/users/StatTile'

interface OverviewStatsProps {
    families: number | null
    teachers: number | null
    newFamilies: number | null
    newTeachers: number | null
    lessonsThisMonth: number | null
    attendanceRate: number | null
    unreadMessages: number | null
    totalMessages: number | null
}

const show = (value: number | null) => (value === null ? '—' : value.toLocaleString('en-US'))

const newThisMonth = (count: number | null) =>
    count === null ? undefined : count > 0 ? `+${count} this month` : 'None new this month'

// A tile that doubles as a shortcut to the page behind the number.
const TILE_LINK =
    'group block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-brand/50'
const TILE_HOVER =
    'h-full transition-colors motion-reduce:transition-none group-hover:bg-brand-soft/40 group-hover:ring-brand/30'

export default function OverviewStats(props: OverviewStatsProps) {
    const { attendanceRate, totalMessages } = props

    return (
        <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
            <Link href="/dashboard/families" className={TILE_LINK}>
                <StatTile
                    icon={Users}
                    label="Families"
                    value={show(props.families)}
                    hint={newThisMonth(props.newFamilies)}
                    className={TILE_HOVER}
                />
            </Link>

            <Link href="/dashboard/teachers" className={TILE_LINK}>
                <StatTile
                    icon={GraduationCap}
                    label="Teachers"
                    value={show(props.teachers)}
                    hint={newThisMonth(props.newTeachers)}
                    className={TILE_HOVER}
                />
            </Link>

            <StatTile
                icon={Calendar}
                label="Lessons this month"
                value={show(props.lessonsThisMonth)}
                hint={attendanceRate === null ? undefined : `${attendanceRate}% attended`}
            />

            <Link href="/dashboard/contact?status=unread" className={TILE_LINK}>
                <StatTile
                    icon={Inbox}
                    label="Unread messages"
                    value={show(props.unreadMessages)}
                    hint={totalMessages === null ? undefined : `of ${totalMessages.toLocaleString('en-US')} total`}
                    className={TILE_HOVER}
                />
            </Link>
        </div>
    )
}
