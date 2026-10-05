import { CheckCheck, Mic, Paperclip, Phone, SmilePlus, Video, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import ChatPreview from './ChatPreview';
import { VideoCallPreview, VoiceCallPreview } from './CallPreviews';
import FeatureList, { type FeatureItem } from './shared/FeatureList';
import IconTile from './shared/IconTile';
import PreviewFrame from './shared/PreviewFrame';
import Section from './shared/Section';
import SectionHeader from './shared/SectionHeader';

const features: readonly FeatureItem[] = [
    {
        icon: Mic,
        title: 'Voice messages',
        desc: 'Record up to 10 minutes and send it in one tap. Ideal for sharing a recitation or explaining something clearly.',
    },
    {
        icon: Paperclip,
        title: 'Photos, videos and files',
        desc: 'Attach up to 10 items to a message: homework pages, lesson recordings, PDFs and more. Drag them in or pick them from your device.',
    },
    {
        icon: SmilePlus,
        title: 'Reactions, edits and deletes',
        desc: 'Answer with a quick reaction, fix a typo after sending, or remove a message you didn\u2019t mean to send.',
    },
    {
        icon: CheckCheck,
        title: 'See who\u2019s there',
        desc: 'Know when your teacher is online or typing, and when your message has been read.',
    },
];

interface CallOption {
    icon: LucideIcon;
    title: string;
    desc: string;
    /** What the illustration shows, for screen readers. */
    label: string;
    preview: ReactNode;
}

const calls: readonly CallOption[] = [
    {
        icon: Phone,
        title: 'Voice calls',
        desc: 'Go over a recitation or sort out the next lesson out loud. Mute whenever you need to, and the call time stays in view.',
        label: 'Illustration of a voice call with Teacher Hana: her avatar, the call time, and mute and hang-up buttons.',
        preview: <VoiceCallPreview />,
    },
    {
        icon: Video,
        title: 'Video calls',
        desc: 'See each other while you talk. Show a page of homework to the camera, switch your video off any time, or flip cameras on your phone.',
        label: 'Illustration of a video call with Teacher Hana: her picture, a small view of yourself, and mute, camera and hang-up buttons.',
        preview: <VideoCallPreview />,
    },
];

/**
 * Landing section for the built-in chat and its voice and video calls. On phones the order is heading,
 * chat illustration, chat features, then the two call cards; from `lg` the heading and list share the
 * left column while the chat illustration spans both rows. The calls get their own row underneath so
 * chat, voice and video each read as a clear step.
 *
 * It sits on a soft warm wash (not `tone="tinted"`) because the next section already uses the teal
 * band and the one before is plain white; the decorative layers sit at `-z-10` inside the section's
 * own stacking context, and `overflow-hidden` keeps the blurred glows from widening the page.
 */
export default function ChatShowcase() {
    return (
        <Section id="chat" aria-labelledby="chat-heading" className="overflow-hidden">
            {/* Soft background: a warm wash that fades out, a faint gold lattice, and two gentle glows */}
            <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 -z-10 bg-linear-to-b from-gold-soft/60 via-gold-soft/30 to-transparent dark:from-gold-soft/40 dark:via-gold-soft/20"
            />
            <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 -z-10 [mask-image:linear-gradient(to_bottom,black,transparent_70%)]"
            >
                <div
                    className="pattern-khatam size-full text-gold opacity-[0.07] dark:opacity-[0.05]"
                    style={{ ['--pattern-size' as string]: '64px' }}
                />
            </div>
            <div
                aria-hidden="true"
                className="pointer-events-none absolute top-24 -right-40 -z-10 h-[420px] w-[520px] rounded-full bg-brand/10 blur-[120px]"
            />
            <div
                aria-hidden="true"
                className="pointer-events-none absolute -bottom-32 -left-40 -z-10 h-[360px] w-[480px] rounded-full bg-gold/10 blur-[120px]"
            />

            <div className="grid grid-cols-1 items-center gap-x-16 gap-y-10 lg:grid-cols-12">
                <SectionHeader
                    id="chat-heading"
                    align="left"
                    eyebrow="Chat, voice and video"
                    title="Talk to your teacher by chat, voice or video"
                    description="Ask a question, share a recording or send a quick thank-you, then switch to a voice or video call when talking is easier. It all sits next to your lessons, with nothing extra to install."
                    className="lg:col-span-5 lg:row-start-1 lg:self-end"
                />

                <PreviewFrame
                    label="Illustration of a chat with a teacher: voice and video call buttons in the header, a message with a PDF attached, a voice message with a heart reaction and a read receipt, and the teacher typing a reply."
                    caption="An illustration of the chat, not a real conversation."
                    className="mx-auto w-full max-w-md lg:col-span-6 lg:col-start-7 lg:row-span-2 lg:row-start-1 lg:max-w-lg lg:justify-self-center"
                >
                    <ChatPreview />
                </PreviewFrame>

                <FeatureList items={features} className="lg:col-span-5 lg:row-start-2 lg:self-start" />
            </div>

            <div className="mt-14 space-y-6 sm:mt-16 sm:space-y-8 lg:mt-20">
                <div className="max-w-2xl space-y-3">
                    <h3 className="font-display text-2xl font-bold leading-tight tracking-tight text-balance text-foreground sm:text-3xl">
                        Prefer to talk? Call from the same conversation
                    </h3>
                    <p className="text-base leading-relaxed text-muted-foreground">
                        Voice and video calls start from the chat header and run in your browser. Every call is saved in
                        the conversation with how long it lasted, so calling back is easy.
                    </p>
                </div>

                <ul className="grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2 lg:gap-8">
                    {calls.map((call) => (
                        <li
                            key={call.title}
                            className="flex flex-col overflow-hidden rounded-3xl border border-border/60 bg-card shadow-sm"
                        >
                            <div role="img" aria-label={call.label}>
                                {call.preview}
                            </div>
                            <div className="flex items-start gap-4 p-5 sm:p-6">
                                <IconTile icon={call.icon} />
                                <div className="space-y-1.5">
                                    <h4 className="text-base font-bold text-foreground">{call.title}</h4>
                                    <p className="text-sm leading-relaxed text-muted-foreground">{call.desc}</p>
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>

                <p className="text-center text-xs text-muted-foreground">
                    Illustrations of voice and video calls, not real calls.
                </p>
            </div>
        </Section>
    );
}
