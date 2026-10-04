import { MessageSquare, PlusCircle, SquarePen, TriangleAlert, UserPlus } from 'lucide-react'
import QuickLinks, { type QuickLink } from '@/components/home/QuickLinks'
import RecentLessons from '@/components/home/RecentLessons'
import { getDashboardOverview } from '@/lib/data/dashboard-overview'
import OverviewStats from './OverviewStats'
import RecentMessages from './RecentMessages'

const quickLinks: QuickLink[] = [
    { href: '/lesson/new-lesson', label: 'Log a lesson', description: 'Record a lesson a teacher just finished', icon: PlusCircle },
    { href: '/sign-up', label: 'Add an account', description: 'Create a teacher or family account', icon: UserPlus },
    { href: '/dashboard/contact/contact-info', label: 'Edit contact page', description: 'Update what visitors see on /contact', icon: SquarePen },
    { href: '/chat', label: 'Open chat', description: 'Pick up your conversations', icon: MessageSquare },
]

export default async function OverviewContent() {
    const { overview, inbox, newAccounts } = await getDashboardOverview()
    const partial = !overview || !inbox || !newAccounts

    return (
        <div className="space-y-6">
            {partial && (
                <div
                    role="status"
                    className="flex items-start gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300"
                >
                    <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                    <p>Some figures couldn&apos;t be loaded and appear as —. Refresh the page to try again.</p>
                </div>
            )}

            <OverviewStats
                families={overview?.familyCount ?? null}
                teachers={overview?.teacherCount ?? null}
                newFamilies={newAccounts?.families ?? null}
                newTeachers={newAccounts?.teachers ?? null}
                lessonsThisMonth={overview?.lessonsThisMonth ?? null}
                attendanceRate={overview?.attendanceRate ?? null}
                unreadMessages={inbox?.unread ?? null}
                totalMessages={inbox?.total ?? null}
            />

            <div className="grid gap-6 lg:grid-cols-3">
                {/* RecentLessons renders its own Card; `*:h-full` lets it match the inbox card's height. */}
                <div className="lg:col-span-2 *:h-full">
                    <RecentLessons
                        lessons={overview?.recent ?? []}
                        variant="admin"
                        emptyHint="Lessons logged by teachers will show up here."
                    />
                </div>
                <RecentMessages messages={inbox?.recent ?? null} unread={inbox?.unread ?? 0} />
            </div>

            <QuickLinks links={quickLinks} />
        </div>
    )
}
