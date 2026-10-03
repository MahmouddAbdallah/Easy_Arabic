'use client';

import { CalendarClock, ExternalLink, HelpCircle, Info, LayoutTemplate, MapPin, PhoneCall, Share2 } from 'lucide-react';
import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { ContactPageContent } from '@/lib/contact/types';
import ChannelsSection from './ChannelsSection';
import ContentSection from './ContentSection';
import FaqsSection from './FaqsSection';
import {
    toChannelsValues,
    toContentValues,
    toFaqsValues,
    toHoursValues,
    toLocationValues,
    toSocialValues,
} from './formValues';
import HoursSection from './HoursSection';
import LocationSection from './LocationSection';
import SocialSection from './SocialSection';

const TABS = [
    { value: 'content', label: 'Page content', icon: LayoutTemplate },
    { value: 'channels', label: 'Channels', icon: PhoneCall },
    { value: 'location', label: 'Location', icon: MapPin },
    { value: 'hours', label: 'Hours', icon: CalendarClock },
    { value: 'social', label: 'Social', icon: Share2 },
    { value: 'faqs', label: 'FAQs', icon: HelpCircle },
] as const;

export default function ContactInfoEditor({ content }: { content: ContactPageContent }) {
    const { info, hours, faqs, source } = content;

    return (
        <div className="space-y-6">
            <header className="flex flex-col gap-3 border-b border-border/40 pb-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">Contact Page</h1>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                        Edit the contact details and wording shown on your public Contact page. Each section saves on its own.
                    </p>
                </div>
                <Link
                    href="/contact"
                    target="_blank"
                    className="inline-flex h-8 items-center gap-1.5 self-start rounded-lg border border-border bg-background px-3 text-sm font-medium hover:bg-muted sm:self-auto"
                >
                    View live page
                    <ExternalLink className="h-3.5 w-3.5" />
                </Link>
            </header>

            {source === 'defaults' && (
                <div role="status" className="flex items-start gap-3 rounded-xl border border-blue-500/30 bg-blue-500/5 p-4 text-sm">
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                    <p className="text-muted-foreground">
                        <span className="font-semibold text-foreground">Nothing has been saved yet.</span> The forms below show the default content visitors currently see.
                        Review it, replace the placeholder phone number, WhatsApp number and address with your real details, and save each section.
                    </p>
                </div>
            )}

            <Tabs defaultValue="content" className="gap-5">
                <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
                    <TabsList variant="line" className="h-auto! w-max min-w-full justify-start gap-1 border-b border-border/50 pb-1.5">
                        {TABS.map(({ value, label, icon: Icon }) => (
                            <TabsTrigger key={value} value={value} className="h-9 flex-none px-3">
                                <Icon className="h-4 w-4" />
                                {label}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                </div>

                {/* keepMounted: switching tabs must never discard unsaved edits. */}
                <TabsContent value="content" keepMounted>
                    <ContentSection defaultValues={toContentValues(info)} />
                </TabsContent>
                <TabsContent value="channels" keepMounted>
                    <ChannelsSection defaultValues={toChannelsValues(info)} />
                </TabsContent>
                <TabsContent value="location" keepMounted>
                    <LocationSection defaultValues={toLocationValues(info)} />
                </TabsContent>
                <TabsContent value="hours" keepMounted>
                    <HoursSection defaultValues={toHoursValues(info, hours)} />
                </TabsContent>
                <TabsContent value="social" keepMounted>
                    <SocialSection defaultValues={toSocialValues(info)} />
                </TabsContent>
                <TabsContent value="faqs" keepMounted>
                    {/* Re-keyed by row ids so a save (which creates rows) remounts with the real ids. */}
                    <FaqsSection key={faqs.map((f) => f.id).join('|')} defaultValues={toFaqsValues(faqs)} />
                </TabsContent>
            </Tabs>
        </div>
    );
}
