import { BellOff, BellRing, Inbox, ListFilter, MailCheck, Smartphone, SunMoon } from 'lucide-react';
import NotificationPreview from './previews/NotificationPreview';
import CapabilityGrid from './shared/CapabilityGrid';
import FeatureList, { type FeatureItem } from './shared/FeatureList';
import PreviewFrame from './shared/PreviewFrame';
import Section from './shared/Section';
import SectionHeader from './shared/SectionHeader';

const features: readonly FeatureItem[] = [
    {
        icon: BellRing,
        title: 'Push alerts on your devices',
        desc: 'Turn notifications on once and alerts arrive even when Easy Arabic isn\u2019t the page you\u2019re looking at.',
    },
    {
        icon: Inbox,
        title: 'An inbox that keeps count',
        desc: 'Every notification is saved with an unread badge, and you can mark each one as read. The inbox works even if you never turn on push.',
    },
    {
        icon: BellOff,
        title: 'Quiet when you\u2019re already there',
        desc: 'If you\u2019re reading a conversation, we won\u2019t ping you about it. New messages in the same chat update one notification instead of piling up.',
    },
];

const alsoBuiltIn: readonly FeatureItem[] = [
    {
        icon: SunMoon,
        title: 'Light and dark mode',
        desc: 'Switch themes any time to suit your eyes and your evening.',
    },
    {
        icon: Smartphone,
        title: 'Made for phones',
        desc: 'Lessons, chat and notifications work comfortably on a small screen.',
    },
    {
        icon: ListFilter,
        title: 'Filterable lesson history',
        desc: 'Narrow past lessons down by status, length or date range.',
    },
    {
        icon: MailCheck,
        title: 'Email verification',
        desc: 'Verified email addresses and password reset are built into sign-in.',
    },
];

/**
 * Landing section for notifications, mirrored against ChatShowcase (illustration on the left from `lg`),
 * on a quiet teal band so the two showcases read as separate moments. Ends with a strip of smaller
 * built-in capabilities.
 */
export default function NotificationsShowcase() {
    return (
        <Section id="notifications" aria-labelledby="notifications-heading" tone="tinted">
            <div className="grid grid-cols-1 items-center gap-x-16 gap-y-10 lg:grid-cols-12">
                <SectionHeader
                    id="notifications-heading"
                    align="left"
                    eyebrow="Notifications"
                    title="Never miss a message or a lesson update"
                    description="Alerts reach you on your phone or computer, and everything lands in one inbox you can catch up on whenever it suits you."
                    className="lg:col-span-5 lg:col-start-8 lg:row-start-1 lg:self-end"
                />

                <PreviewFrame
                    label="Illustration of notifications: a push alert from Teacher Hana on a phone, above an inbox showing two unread notifications and one read."
                    caption="An illustration of notifications, not real messages."
                    className="mx-auto w-full max-w-md lg:col-span-6 lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:max-w-lg lg:justify-self-center"
                >
                    <NotificationPreview />
                </PreviewFrame>

                <FeatureList
                    items={features}
                    className="lg:col-span-5 lg:col-start-8 lg:row-start-2 lg:self-start"
                />
            </div>

            <CapabilityGrid title="Also built in" items={alsoBuiltIn} className="mt-14 sm:mt-16 lg:mt-20" />
        </Section>
    );
}
