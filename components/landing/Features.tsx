import {
    ShieldCheck,
    CalendarCheck,
    ClipboardCheck,
    MessageCircle,
    Users,
    Banknote,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

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
        <section className="relative w-full py-20 md:py-28 bg-background border-b border-border/60">
            <div className="container max-w-7xl mx-auto px-4 md:px-6 space-y-14">
                <div className="flex flex-col items-center text-center space-y-4 max-w-2xl mx-auto">
                    <span className="text-xs font-bold tracking-wider text-brand uppercase">What You Get</span>
                    <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-foreground leading-[1.15]">
                        Everything a family and teacher actually need
                    </h2>
                    <p className="text-muted-foreground text-base leading-relaxed">
                        No bloated feature list — just what makes 1-on-1 Quran and Arabic
                        tutoring work well for everyone involved.
                    </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {features.map((feature) => (
                        <Card key={feature.title} className="border-border/60 hover:border-brand/40 transition-colors">
                            <CardContent className="space-y-3.5">
                                <div className="p-2.5 rounded-xl bg-brand-soft text-brand border border-brand/20 w-fit">
                                    <feature.icon className="h-5 w-5" />
                                </div>
                                <h3 className="text-base font-bold text-foreground">{feature.title}</h3>
                                <p className="text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </section>
    );
}
