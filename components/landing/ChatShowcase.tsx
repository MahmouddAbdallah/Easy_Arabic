import { CheckCheck, Mic, Paperclip, SmilePlus } from 'lucide-react';
import ChatPreview from './previews/ChatPreview';
import FeatureList, { type FeatureItem } from './shared/FeatureList';
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

/**
 * Landing section for the built-in chat. On phones the order is heading, illustration, feature list;
 * from `lg` the heading and list share the left column while the illustration spans both rows.
 */
export default function ChatShowcase() {
    return (
        <Section id="chat" aria-labelledby="chat-heading">
            <div className="grid grid-cols-1 items-center gap-x-16 gap-y-10 lg:grid-cols-12">
                <SectionHeader
                    id="chat-heading"
                    align="left"
                    eyebrow="Built-in chat"
                    title="Talk to your teacher right where the lessons happen"
                    description="Ask a question, share a recording or send a quick thank-you. Every conversation sits next to your lessons, with nothing extra to install."
                    className="lg:col-span-5 lg:row-start-1 lg:self-end"
                />

                <PreviewFrame
                    label="Illustration of a chat with a teacher: a message with a PDF attached, a voice message with a heart reaction and a read receipt, and the teacher typing a reply."
                    caption="An illustration of the chat, not a real conversation."
                    className="mx-auto w-full max-w-md lg:col-span-6 lg:col-start-7 lg:row-span-2 lg:row-start-1 lg:max-w-lg lg:justify-self-center"
                >
                    <ChatPreview />
                </PreviewFrame>

                <FeatureList items={features} className="lg:col-span-5 lg:row-start-2 lg:self-start" />
            </div>
        </Section>
    );
}
