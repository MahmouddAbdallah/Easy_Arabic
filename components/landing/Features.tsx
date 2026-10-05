import {
    ShieldCheck,
    CalendarCheck,
    ClipboardCheck,
    MessageCircle,
    Users,
    Banknote,
} from 'lucide-react';
import IconTile from './shared/IconTile';
import Section from './shared/Section';
import SectionHeader from './shared/SectionHeader';

const features = [
    {
        icon: ShieldCheck,
        title: 'Personally Vetted Teachers',
        desc: 'Every teacher is reviewed by our team before being matched with a family — never an open, unscreened listing.',
    },
    {
        icon: CalendarCheck,
        title: 'Live 1-on-1 Lessons',
        desc: 'Flexible session lengths from 15 minutes to two hours, scheduled around your family, not a fixed timetable.',
    },
    {
        icon: ClipboardCheck,
        title: 'Lesson-by-Lesson Tracking',
        desc: 'Every class is logged with attendance and a detailed progress rating, so you always know how things are going.',
    },
    {
        icon: MessageCircle,
        title: 'Direct Messaging',
        desc: 'Chat directly with your teacher between lessons — no separate app to install, no waiting on email.',
    },
    {
        icon: Users,
        title: 'One Account, Whole Family',
        desc: 'Manage lessons for multiple children and multiple teachers from a single family account.',
    },
    {
        icon: Banknote,
        title: 'Fair, Transparent Pay',
        desc: 'Teachers are paid per lesson, tracked automatically — clear and dependable for everyone involved.',
    },
];

export default function Features() {
    return (
        <Section aria-labelledby="features-heading" containerClassName="space-y-12 lg:space-y-14">
            <SectionHeader
                id="features-heading"
                eyebrow="What You Get"
                title="Everything a family and teacher actually need"
                description="No bloated feature list — just what makes 1-on-1 Quran and Arabic tutoring work well for everyone involved."
            />

            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                {features.map((feature) => (
                    <li
                        key={feature.title}
                        className="space-y-3.5 rounded-2xl border border-border/60 bg-card p-5 sm:p-6 transition-colors hover:border-brand/40 motion-reduce:transition-none"
                    >
                        <IconTile icon={feature.icon} />
                        <h3 className="text-base font-bold text-foreground">{feature.title}</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
                    </li>
                ))}
            </ul>
        </Section>
    );
}
