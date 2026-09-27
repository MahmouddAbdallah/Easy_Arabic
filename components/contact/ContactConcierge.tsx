'use client';

import { HelpCircle, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger, } from '@/components/ui/accordion';
import SocialMediaCard from './SocialMediaCard';

export default function ContactConcierge() {
    const faqs = [
        {
            id: 'faq-1',
            q: 'How fast can my family start after reaching out?',
            a: 'Once you connect with us, a dedicated Family Advisor will assess your needs within 15 minutes and pair you with a certified Sanad tutor for a trial lesson within 24 hours.',
        },
        {
            id: 'faq-2',
            q: 'Can we request a specific gender or dialect for the tutor?',
            a: 'Absolutely. We have elite male and female scholars fluent in Arabic, English, French, and Urdu, holding verified Ijazah and specialized in teaching children and adults.',
        },
        {
            id: 'faq-3',
            q: 'What if we need to reschedule our sessions across different time zones?',
            a: 'Our global student portal lets you manage and adjust your lesson schedule 24/7 with a single click, perfectly sync’d with your local timezone.',
        },
        {
            id: 'faq-4',
            q: 'Are the trial sessions completely free with no commitment?',
            a: 'Yes. Your initial consultation and first trial session with a master tutor are 100% complimentary so you can experience the quality firsthand.',
        },
    ];

    const hubs = [
        { city: 'New York', zone: 'EST (UTC-5)' },
        { city: 'London', zone: 'GMT (UTC+0)' },
        { city: 'Dubai', zone: 'GST (UTC+4)' },
        { city: 'Cairo', zone: 'EEST (UTC+3)' },
    ];

    return (
        <section className="relative w-full py-24 bg-background border-b border-border/40 overflow-hidden">
            {/* Background Lighting */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-primary/5 blur-[180px] rounded-full pointer-events-none -z-10" />

            <div className="container max-w-7xl px-4 md:px-6 mx-auto">
                {/* Section Header */}
                <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
                    <Badge
                        variant="outline"
                        className="gap-2 px-3.5 py-1.5 border-primary/30 bg-primary/5 text-primary text-xs font-semibold backdrop-blur-xl rounded-full"
                    >
                        <Sparkles className="h-3.5 w-3.5" />
                        <span>VIP Support Experience</span>
                    </Badge>

                    <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-foreground">
                        Frequently Asked Questions &{' '}
                        Global Concierge
                    </h2>

                    <p className="text-muted-foreground text-base sm:text-lg">
                        Everything you need to know about starting your family’s Quranic journey with complete peace of mind.
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    {/* LEFT: Accordion FAQs (7 Cols) */}
                    <div className="lg:col-span-7 space-y-4">
                        <h3 className="text-xl font-bold text-foreground flex items-center gap-2 mb-6">
                            <HelpCircle className="h-5 w-5 text-primary" />
                            <span>Quick Answers for Families</span>
                        </h3>

                        <Accordion className="space-y-3">
                            {faqs.map((faq) => (
                                <AccordionItem
                                    key={faq.id}
                                    value={faq.id}
                                    className="border border-border/60 rounded-2xl bg-card/30 backdrop-blur-md px-5 data-[state=open]:border-primary/50 data-[state=open]:bg-card/70 data-[state=open]:shadow-lg transition-all"
                                >
                                    <AccordionTrigger className="font-bold text-base text-foreground hover:no-underline py-5">
                                        {faq.q}
                                    </AccordionTrigger>
                                    <AccordionContent className="text-sm text-muted-foreground leading-relaxed pt-1 pb-5 border-t border-border/40 mt-1">
                                        {faq.a}
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                    </div>

                    {/* RIGHT: Global Active Hubs & Instant Booking Card (5 Cols) */}
                    <SocialMediaCard />
                </div>
            </div>
        </section>
    );
}