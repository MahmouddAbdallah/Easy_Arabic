import { CheckCheck, FileText, Mic, Paperclip, Phone, Play, Video } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Bar heights (%) of the example voice message's waveform. */
const WAVEFORM = [35, 60, 45, 80, 55, 90, 50, 70, 40, 75, 60, 45, 65, 35, 55, 30];
/** How many bars count as already played. */
const PLAYED_BARS = 7;

/**
 * An illustration of the in-app chat: voice and video call buttons in the header, a text message with a
 * file, a voice message with a reaction and a read receipt, and the teacher typing. It is static markup,
 * not the real chat, so it needs no data and no client JavaScript. Render it inside <PreviewFrame>.
 */
export default function ChatPreview() {
    return (
        <>
            {/* Header: who you're talking to, that they're typing, and the call buttons */}
            <div className="flex items-center gap-3 border-b border-border/60 px-4 py-3 sm:px-5">
                <div className="relative shrink-0">
                    <span className="flex size-10 items-center justify-center rounded-full bg-brand-soft text-sm font-bold text-brand ring-1 ring-brand/20">
                        H
                    </span>
                    <span className="absolute -right-0.5 -bottom-0.5 size-3 rounded-full border-2 border-card bg-emerald-500" />
                </div>
                <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-foreground">Teacher Hana</p>
                    <p className="flex items-center gap-1.5 text-xs font-medium text-brand">
                        Typing
                        <span className="flex items-end gap-0.5 pb-0.5">
                            {[0, 150, 300].map((delay) => (
                                <span
                                    key={delay}
                                    className="size-1 animate-bounce rounded-full bg-current motion-reduce:animate-none"
                                    style={{ animationDelay: `${delay}ms` }}
                                />
                            ))}
                        </span>
                    </p>
                </div>

                {/* Voice and video call buttons, as in the real chat header */}
                <div className="ml-auto flex shrink-0 items-center gap-1.5">
                    {[Phone, Video].map((Icon, index) => (
                        <span
                            key={index}
                            className="flex size-9 items-center justify-center rounded-full border border-brand/20 bg-brand-soft text-brand"
                        >
                            <Icon className="size-4" />
                        </span>
                    ))}
                </div>
            </div>

            {/* Conversation */}
            <div className="space-y-5 bg-muted/40 px-4 py-5 sm:px-5">
                <p className="text-center text-[11px] font-semibold text-muted-foreground">Today</p>

                {/* Teacher: text + attached file */}
                <div className="flex max-w-[90%] flex-col items-start gap-1.5">
                    <div className="space-y-2.5 rounded-2xl rounded-bl-md border border-border/70 bg-card p-3 shadow-sm">
                        <p className="text-sm leading-relaxed text-foreground">
                            Layla did beautifully with her Tajweed today. Her notes for this week are attached.
                        </p>
                        <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-background p-2.5">
                            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
                                <FileText className="size-4" />
                            </span>
                            <div className="min-w-0">
                                <p className="truncate text-xs font-bold text-foreground">Week 6 notes.pdf</p>
                                <p className="text-[11px] text-muted-foreground">PDF · 240 KB</p>
                            </div>
                        </div>
                    </div>
                    <span className="px-1 text-[11px] text-muted-foreground">4:52 PM</span>
                </div>

                {/* You: voice message, with a reaction and a read receipt */}
                <div className="ml-auto flex max-w-[90%] flex-col items-end gap-1.5">
                    <div className="relative flex items-center gap-3 rounded-2xl rounded-br-md bg-brand px-3 py-2.5 text-brand-foreground shadow-sm">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-foreground/15">
                            <Play className="size-4 fill-current" />
                        </span>
                        <div className="flex h-8 items-center gap-[3px]">
                            {WAVEFORM.map((height, index) => (
                                <span
                                    key={index}
                                    className={cn(
                                        'w-[3px] rounded-full bg-brand-foreground',
                                        index < PLAYED_BARS ? 'opacity-90' : 'opacity-35'
                                    )}
                                    style={{ height: `${height}%` }}
                                />
                            ))}
                        </div>
                        <span className="text-xs font-semibold tabular-nums">0:12</span>
                        <span className="absolute -bottom-3 left-3 rounded-full border border-border bg-card px-1.5 py-0.5 text-xs leading-none shadow-sm">
                            ❤️
                        </span>
                    </div>
                    <p className="flex items-center gap-1 px-1 pt-2 text-[11px] text-muted-foreground">
                        4:55 PM
                        <CheckCheck className="size-3.5 text-emerald-500" />
                        Read
                    </p>
                </div>
            </div>

            {/* Composer */}
            <div className="flex items-center gap-2 border-t border-border/60 bg-card px-3 py-3 sm:px-4">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground">
                    <Paperclip className="size-4" />
                </span>
                <span className="flex h-10 min-w-0 flex-1 items-center rounded-full border border-border bg-background px-4 text-sm text-muted-foreground">
                    Message Hana
                </span>
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand text-brand-foreground">
                    <Mic className="size-4" />
                </span>
            </div>
        </>
    );
}
