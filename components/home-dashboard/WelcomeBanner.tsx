import { Avatar, AvatarFallback } from '@/components/ui/avatar';

const ROLE_LABEL: Record<string, string> = {
    admin: 'Administrator',
    teacher: 'Teacher',
    family: 'Family Account',
};

function initials(name: string) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

export default function WelcomeBanner({ name, role }: { name: string; role: string }) {
    const today = new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
    });

    return (
        <div className="relative rounded-3xl overflow-hidden bg-brand-deep">
            <div className="absolute inset-0 pattern-khatam text-white opacity-[0.05] pointer-events-none" style={{ ['--pattern-size' as string]: '48px' }} />
            <div className="relative p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center gap-5">
                <Avatar className="h-14 w-14 border-2 border-white/20 shrink-0">
                    <AvatarFallback className="bg-white/10 text-white text-base font-bold">
                        {initials(name)}
                    </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                    <p className="text-white/70 text-xs font-semibold uppercase tracking-wide">
                        {today}
                    </p>
                    <h1 className="font-display text-2xl sm:text-3xl font-bold text-white truncate">
                        Welcome back, {name}
                    </h1>
                    <span className="inline-flex items-center mt-1.5 px-2.5 py-1 rounded-full bg-gold/15 border border-gold/30 text-gold text-[11px] font-bold">
                        {ROLE_LABEL[role] ?? role}
                    </span>
                </div>
            </div>
        </div>
    );
}
