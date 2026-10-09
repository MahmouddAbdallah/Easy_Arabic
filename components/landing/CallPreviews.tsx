import type { ReactNode } from 'react';
import { Mic, PhoneOff, Video } from 'lucide-react';
import { cn } from 'cn';

/** Bar heights (%) of the sound bars shown while someone is speaking on the voice call. */
const LEVELS = [30, 55, 40, 75, 50, 85, 45, 65, 35, 55, 30];

/** A round call control, styled like the in-call buttons. `danger` is the red hang-up button. */
function Control({ children, danger = false }: { children: ReactNode; danger?: boolean }) {
    return (
        <span
            className={cn(
                'flex size-11 items-center justify-center rounded-full [&_svg]:size-[18px]',
                danger ? 'bg-red-500 text-white' : 'bg-white/15 text-white'
            )}
        >
            {children}
        </span>
    );
}

/** The always-dark teal surface both call illustrations sit on, with a soft glow near the top. */
function CallSurface({ children, className }: { children: ReactNode; className?: string }) {
    return (
        <div className={cn('relative isolate flex h-60 flex-col overflow-hidden bg-brand-deep text-white sm:h-64', className)}>
            <div
                aria-hidden="true"
                className="absolute inset-0 -z-10 bg-[radial-gradient(60%_55%_at_50%_30%,rgba(61,189,179,0.22),transparent)]"
            />
            {children}
        </div>
    );
}

/**
 * An illustration of a voice call in progress: the teacher's avatar, call time, sound bars and the
 * mute and hang-up buttons. Static markup, not a real call. Render it inside a labelled `role="img"`.
 */
export function VoiceCallPreview() {
    return (
        <CallSurface className="items-center justify-center gap-4">
            <div className="flex flex-col items-center gap-3">
                <div className="relative">
                    <span className="absolute -inset-3 rounded-full ring-1 ring-white/10" />
                    <span className="absolute -inset-5 rounded-full ring-1 ring-white/5" />
                    <span className="relative flex size-20 items-center justify-center rounded-full bg-brand-soft text-3xl font-bold text-brand ring-4 ring-white/10">
                        H
                    </span>
                </div>
                <div className="mt-2 space-y-1.5 text-center">
                    <p className="text-base font-bold">Teacher Hana</p>
                    <p className="flex items-center justify-center gap-2.5 text-sm text-white/70">
                        <span className="tabular-nums">08:42</span>
                        <span className="flex h-4 items-center gap-[3px]">
                            {LEVELS.map((height, index) => (
                                <span
                                    key={index}
                                    className="w-[3px] rounded-full bg-white/60"
                                    style={{ height: `${height}%` }}
                                />
                            ))}
                        </span>
                    </p>
                </div>
            </div>

            <div className="flex items-center gap-4">
                <Control>
                    <Mic />
                </Control>
                <Control danger>
                    <PhoneOff />
                </Control>
            </div>
        </CallSurface>
    );
}

/**
 * An illustration of a video call in progress: a stand-in for the teacher's picture, a small view of
 * yourself, the call time and the mute, camera and hang-up buttons. Static markup, not a real call.
 */
export function VideoCallPreview() {
    return (
        <CallSurface className="justify-between">
            {/* A simple head-and-shoulders shape stands in for the other person's video */}
            <div aria-hidden="true" className="absolute inset-0 -z-10 bg-linear-to-b from-brand/25 via-brand-deep/0 to-brand-deep/0" />
            <div aria-hidden="true" className="absolute bottom-0 left-1/2 -z-10 h-40 w-44 -translate-x-1/2">
                <span className="absolute top-0 left-1/2 size-[70px] -translate-x-1/2 rounded-full bg-white/15" />
                <span className="absolute inset-x-0 bottom-0 h-[92px] rounded-t-full bg-white/10" />
            </div>

            <div className="flex items-start justify-between gap-3 p-3 sm:p-4">
                <p className="inline-flex items-center gap-2 rounded-full bg-black/30 px-3 py-1.5 text-xs font-semibold backdrop-blur-sm">
                    Teacher Hana
                    <span className="font-medium tabular-nums text-white/70">08:42</span>
                </p>
                <span className="flex h-20 w-14 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-brand-soft text-xs font-bold text-brand shadow-lg sm:h-24 sm:w-[68px]">
                    You
                </span>
            </div>

            <div className="flex items-center justify-center gap-4 pb-4">
                <Control>
                    <Mic />
                </Control>
                <Control>
                    <Video />
                </Control>
                <Control danger>
                    <PhoneOff />
                </Control>
            </div>
        </CallSurface>
    );
}
