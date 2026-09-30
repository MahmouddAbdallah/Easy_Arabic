import Image from 'next/image';
import { Send, HeartHandshake, BookOpenCheck } from 'lucide-react';

const steps = [
    {
        number: '01',
        icon: Send,
        title: 'Reach out',
        desc: 'Tell us about your family — ages, goals, and the schedule that works for you.',
    },
    {
        number: '02',
        icon: HeartHandshake,
        title: 'Get matched',
        desc: 'We personally pair you with a vetted teacher suited to your family, not an algorithm.',
    },
    {
        number: '03',
        icon: BookOpenCheck,
        title: 'Start learning',
        desc: 'Begin scheduled 1-on-1 lessons, track every session, and message your teacher directly.',
    },
];

const facts = [
    { value: '1:1', label: 'Dedicated live sessions' },
    { value: '15–120 min', label: 'Flexible lesson lengths' },
    { value: '8-point', label: 'Lesson progress scale' },
];

export default function About() {
    return (
        <section className="relative w-full py-20 md:py-28 bg-background border-b border-border/60">
            <div className="container max-w-7xl mx-auto px-4 md:px-6 space-y-16">

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
                    {/* LEFT: image */}
                    <div className="lg:col-span-5 relative">
                        <div className="absolute inset-0 bg-gradient-to-tr from-brand/15 to-gold/10 blur-3xl rounded-[32px] -z-10" />
                        <div className="relative aspect-[4/5] rounded-[24px] overflow-hidden border border-border/70 shadow-lg">
                            <Image
                                src="/about.jpg"
                                alt="An open Quran, ready for study"
                                fill
                                sizes="(min-width: 1024px) 38vw, 90vw"
                                className="object-cover"
                            />
                        </div>
                    </div>

                    {/* RIGHT: steps */}
                    <div className="lg:col-span-7 space-y-8">
                        <div className="space-y-3">
                            <span className="text-xs font-bold tracking-wider text-brand uppercase">How Easy Arabic Works</span>
                            <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-foreground leading-[1.15]">
                                A simple, human process — not a marketplace to browse.
                            </h2>
                            <p className="text-muted-foreground text-base leading-relaxed max-w-xl">
                                No endless list of profiles to compare. You tell us what you need,
                                and our team takes it from there.
                            </p>
                        </div>

                        <div className="space-y-4">
                            {steps.map((step) => (
                                <div
                                    key={step.number}
                                    className="flex gap-4 items-start p-4 sm:p-5 rounded-2xl border border-border/60 bg-card"
                                >
                                    <div className="shrink-0 flex flex-col items-center gap-1.5">
                                        <div className="p-2.5 rounded-xl bg-brand-soft text-brand border border-brand/20">
                                            <step.icon className="h-5 w-5" />
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-brand">{step.number}</span>
                                            <h3 className="text-base font-bold text-foreground">{step.title}</h3>
                                        </div>
                                        <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Honest fact strip — real product facts, not growth stats */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 p-6 sm:p-8 rounded-3xl border border-border/60 bg-card">
                    {facts.map((fact) => (
                        <div key={fact.label} className="flex flex-col items-center text-center gap-1">
                            <p className="font-display text-2xl sm:text-3xl font-bold text-brand">{fact.value}</p>
                            <p className="text-xs sm:text-sm text-muted-foreground font-medium">{fact.label}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
