import { CalendarDays } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { getInitials } from '@/components/Navbar/UserAvatar';
import { formatDate } from '@/lib/profile/format';

/** Banner at the top of the Profile page. Matches the home WelcomeBanner; shows no role or account status. */
export function ProfileHero({ name, createdAt }: { name: string; createdAt: string }) {
    return (
        <div className="relative overflow-hidden rounded-3xl bg-brand-deep">
            <div className="pointer-events-none absolute inset-0 pattern-khatam text-white opacity-[0.05]" style={{ ['--pattern-size' as string]: '48px' }} />
            <div className="relative flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:p-8">
                <Avatar className="h-16 w-16 shrink-0 border-2 border-white/20">
                    <AvatarFallback className="bg-white/10 text-lg font-bold text-white">{getInitials(name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-white/70">Profile &amp; settings</p>
                    <h1 className="truncate text-2xl font-bold text-white sm:text-3xl">{name}</h1>
                    <p className="mt-1.5 inline-flex items-center gap-1.5 text-sm text-white/80">
                        <CalendarDays className="size-4 text-gold" aria-hidden="true" />
                        Member since {formatDate(createdAt)}
                    </p>
                </div>
            </div>
        </div>
    );
}
