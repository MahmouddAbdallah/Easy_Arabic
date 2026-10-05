import {
    HeartHandshake,
    GraduationCap,
    CheckCircle2,
    ArrowRight,
} from 'lucide-react';
import IconTile from './shared/IconTile';
import LinkButton from './shared/LinkButton';
import Section from './shared/Section';
import SectionHeader from './shared/SectionHeader';

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
        <Section aria-labelledby="for-role-heading" containerClassName="space-y-12 lg:space-y-14">
            <SectionHeader
                id="for-role-heading"
                eyebrow="Built For Both Sides"
                title="Two sides, one simple platform"
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 lg:gap-8">
                {columns.map((col) => (
                    <article
                        key={col.title}
                        className="flex flex-col p-6 sm:p-8 rounded-3xl border border-border/60 bg-card space-y-6"
                    >
                        <div className="space-y-3">
                            <IconTile icon={col.icon} size="lg" />
                            <h3 className="text-xl sm:text-2xl font-bold text-foreground">{col.title}</h3>
                            <p className="text-sm text-muted-foreground leading-relaxed">{col.desc}</p>
                        </div>

                        <ul className="space-y-2.5 grow">
                            {col.points.map((point) => (
                                <li key={point} className="flex items-start gap-2.5 text-sm text-foreground/90">
                                    <CheckCircle2 className="h-4 w-4 text-brand shrink-0 mt-0.5" aria-hidden="true" />
                                    <span>{point}</span>
                                </li>
                            ))}
                        </ul>

                        <LinkButton href="/contact" tone="brandOutline" className="h-11 sm:w-full">
                            <span>{col.ctaLabel}</span>
                            <ArrowRight className="h-4 w-4" aria-hidden="true" />
                        </LinkButton>
                    </article>
                ))}
            </div>
        </Section>
    );
}
