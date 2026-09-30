import Link from 'next/link';
import {
    HeartHandshake,
    GraduationCap,
    CheckCircle2,
    ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const columns = [
    {
        icon: HeartHandshake,
        title: 'For Families',
        desc: 'A dedicated space to manage every child\u2019s Quran and Arabic learning in one place.',
        points: [
            'Tell us your goals, ages, and schedule',
            'Get matched with a vetted teacher',
            'Track attendance and progress after every class',
            'Message your teacher directly, anytime',
        ],
        ctaLabel: 'Get in Touch',
    },
    {
        icon: GraduationCap,
        title: 'For Teachers',
        desc: 'Teach motivated students 1-on-1, with the schedule and structure handled for you.',
        points: [
            'Teach students matched to your strengths',
            'Set your own availability',
            'Get paid per lesson, tracked automatically',
            'Stay in touch with families directly',
        ],
        ctaLabel: 'Apply to Teach',
    },
];

export default function ForRole() {
    return (
        <section className="relative w-full py-20 md:py-28 bg-background border-b border-border/60">
            <div className="container max-w-7xl mx-auto px-4 md:px-6 space-y-14">
                <div className="flex flex-col items-center text-center space-y-4 max-w-2xl mx-auto">
                    <span className="text-xs font-bold tracking-wider text-brand uppercase">Built For Both Sides</span>
                    <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-foreground leading-[1.15]">
                        Two sides, one simple platform
                    </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
                    {columns.map((col) => (
                        <div
                            key={col.title}
                            className="flex flex-col p-6 sm:p-8 rounded-3xl border border-border/60 bg-card space-y-6"
                        >
                            <div className="space-y-3">
                                <div className="p-3 rounded-2xl bg-brand-soft text-brand border border-brand/20 w-fit">
                                    <col.icon className="h-6 w-6" />
                                </div>
                                <h3 className="text-xl sm:text-2xl font-bold text-foreground">{col.title}</h3>
                                <p className="text-sm text-muted-foreground leading-relaxed">{col.desc}</p>
                            </div>

                            <ul className="space-y-2.5 grow">
                                {col.points.map((point) => (
                                    <li key={point} className="flex items-start gap-2.5 text-sm text-foreground/90">
                                        <CheckCircle2 className="h-4 w-4 text-brand shrink-0 mt-0.5" />
                                        <span>{point}</span>
                                    </li>
                                ))}
                            </ul>

                            <Link href="/contact" className="w-full">
                                <Button variant="outline" className="w-full h-11 font-bold rounded-xl border-brand/30 text-brand hover:bg-brand-soft hover:text-brand">
                                    <span>{col.ctaLabel}</span>
                                    <ArrowRight className="h-4 w-4" />
                                </Button>
                            </Link>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
