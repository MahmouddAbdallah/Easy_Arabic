import Image from 'next/image';
import {
    ArrowRight,
    ShieldCheck,
    CalendarCheck,
    ClipboardCheck,
    Star,
    UserCheck,
} from 'lucide-react';
import LinkButton from './shared/LinkButton';

const trustPoints = [
    { icon: ShieldCheck, label: 'Every teacher personally reviewed' },
    { icon: CalendarCheck, label: 'Live 1-on-1 lessons, any schedule' },
    { icon: ClipboardCheck, label: 'Progress tracked after every class' },
];

export default function Hero() {
    return (
        <section
            aria-labelledby="hero-heading"
            className="relative isolate w-full overflow-hidden bg-background border-b border-border/60"
        >
            {/* Soft brand glow, top of page only */}
            <div aria-hidden="true" className="absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[420px] bg-brand/10 blur-[120px] rounded-full pointer-events-none -z-10" />
            <div aria-hidden="true" className="absolute inset-0 pattern-khatam text-brand opacity-[0.035] pointer-events-none -z-10" style={{ ['--pattern-size' as string]: '64px' }} />

            <div className="container max-w-7xl mx-auto px-4 md:px-6 pt-12 pb-16 sm:pt-14 md:pt-20 md:pb-24">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-10 items-center">

                    {/* LEFT: Copy */}
                    <div className="lg:col-span-6 flex flex-col items-start space-y-6 sm:space-y-7 animate-ea-rise motion-reduce:animate-none">
                        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-brand/25 bg-brand-soft text-brand text-xs sm:text-sm font-semibold">
                            <UserCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            <span>Personally matched Quran &amp; Arabic tutoring</span>
                        </div>

                        <h1
                            id="hero-heading"
                            className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-foreground leading-[1.1] text-balance"
                        >
                            Quran and Arabic lessons, matched to your family — not a marketplace.
                        </h1>

                        <p className="text-muted-foreground text-base sm:text-lg max-w-xl leading-relaxed">
                            Tell us what your family needs. We personally pair you with a vetted
                            teacher, then track every lesson together — attendance, progress,
                            and a direct line to chat.
                        </p>

                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full pt-1">
                            <LinkButton href="/contact" tone="brand">
                                <span>Get Started</span>
                                <ArrowRight className="h-4 w-4" aria-hidden="true" />
                            </LinkButton>
                            <LinkButton href="/sign-in" tone="outline">
                                <span>Sign In</span>
                            </LinkButton>
                        </div>

                        <ul className="flex flex-col gap-2.5 pt-2">
                            {trustPoints.map(({ icon: Icon, label }) => (
                                <li key={label} className="flex items-center gap-2.5 text-sm text-foreground/90 font-medium">
                                    <Icon className="h-4 w-4 text-brand shrink-0" aria-hidden="true" />
                                    <span>{label}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* RIGHT: Visual */}
                    <div className="lg:col-span-6 relative animate-ea-settle motion-reduce:animate-none [animation-delay:120ms]">
                        <div aria-hidden="true" className="absolute inset-0 bg-linear-to-tr from-brand/15 via-gold/10 to-transparent blur-3xl rounded-[40px] -z-10" />

                        <div className="relative rounded-[28px] overflow-hidden border border-border/70 bg-card shadow-xl">
                            <div className="relative aspect-[4/3]">
                                {/* `priority` is deprecated in Next 16. This image is the largest paint on desktop but sits
                                    lower on phones, so it is fetched eagerly at high priority rather than preloaded. */}
                                <Image
                                    src="/assets/hero.jpg"
                                    alt="The Quran, open and ready for a lesson"
                                    fill
                                    loading="eager"
                                    fetchPriority="high"
                                    sizes="(min-width: 1024px) 42vw, 90vw"
                                    className="object-cover"
                                />
                                <div className="absolute inset-0 bg-linear-to-t from-black/55 via-black/5 to-transparent" />
                            </div>

                            {/* Illustrative lesson card — a real example of what lesson
                                tracking looks like in the product, not a live statistic. */}
                            <div className="p-4 sm:p-5 bg-card">
                                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2.5">
                                    What a tracked lesson looks like
                                </p>
                                <div className="flex flex-col gap-3 p-3.5 rounded-2xl border border-border/70 bg-background sm:flex-row sm:items-center sm:justify-between">
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-foreground sm:truncate">Layla — Tajweed &amp; Memorization</p>
                                        <p className="text-xs text-muted-foreground mt-0.5">45 min · with Teacher Hana</p>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                                        <span className="inline-flex items-center gap-1 rounded-lg border border-teal-500/20 bg-teal-500/10 text-teal-600 dark:text-teal-400 px-2 py-1 text-[11px] font-bold">
                                            <UserCheck className="h-3 w-3" aria-hidden="true" /> Attended
                                        </span>
                                        <span className="inline-flex items-center gap-1 rounded-lg border border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-1 text-[11px] font-bold">
                                            <Star className="h-3 w-3 fill-current" aria-hidden="true" /> Excellent
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
