import Image from 'next/image';
import { Send, HeartHandshake, BookOpenCheck } from 'lucide-react';
import IconTile from './shared/IconTile';
import Section from './shared/Section';
import SectionHeader from './shared/SectionHeader';

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
        <Section aria-labelledby="how-it-works-heading" containerClassName="space-y-12 lg:space-y-16">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-center">
                {/* LEFT: image — short on phones so the steps start sooner, tall on desktop */}
                <div className="lg:col-span-5 relative">
                    <div aria-hidden="true" className="absolute inset-0 bg-linear-to-tr from-brand/15 to-gold/10 blur-3xl rounded-[32px] -z-10" />
                    <div className="relative aspect-[16/10] sm:aspect-[16/9] lg:aspect-[4/5] rounded-[24px] overflow-hidden border border-border/70 shadow-lg">
                        <Image
                            src="/assets/about.jpg"
                            alt="An open Quran, ready for study"
                            fill
                            sizes="(min-width: 1024px) 38vw, 90vw"
                            className="object-cover"
                        />
                    </div>
                </div>

                {/* RIGHT: steps */}
                <div className="lg:col-span-7 space-y-8">
                    <SectionHeader
                        id="how-it-works-heading"
                        align="left"
                        eyebrow="How Easy Arabic Works"
                        title="A simple, human process — not a marketplace to browse."
                        description="No endless list of profiles to compare. You tell us what you need, and our team takes it from there."
                    />

                    <ol className="space-y-4">
                        {steps.map((step) => (
                            <li
                                key={step.number}
                                className="flex gap-4 items-start p-4 sm:p-5 rounded-2xl border border-border/60 bg-card"
                            >
                                <IconTile icon={step.icon} />
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-brand" aria-hidden="true">{step.number}</span>
                                        <h3 className="text-base font-bold text-foreground">{step.title}</h3>
                                    </div>
                                    <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
                                </div>
                            </li>
                        ))}
                    </ol>
                </div>
            </div>

            {/* Honest fact strip — real product facts, not growth stats. Label comes first in the
                markup (so it reads as "label, value") and the value is shown on top. */}
            <dl className="grid grid-cols-1 sm:grid-cols-3 divide-y divide-border/60 sm:divide-y-0 sm:divide-x p-2 sm:p-4 rounded-3xl border border-border/60 bg-card">
                {facts.map((fact) => (
                    <div key={fact.label} className="flex flex-col-reverse items-center text-center gap-1 px-4 py-5 sm:py-4">
                        <dt className="text-xs sm:text-sm text-muted-foreground font-medium">{fact.label}</dt>
                        <dd className="font-display text-2xl sm:text-3xl font-bold text-brand">{fact.value}</dd>
                    </div>
                ))}
            </dl>
        </Section>
    );
}
