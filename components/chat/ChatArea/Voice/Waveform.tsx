import { VOICE_WAVEFORM_BARS } from "../../lib/attachments";

/** No bar is drawn shorter than this (percent of the height), so a quiet moment is still visible. */
const MIN_BAR_PERCENT = 14;

/**
 * The bars of a recorded waveform: one thin rounded bar per value (0-100). Colour is `currentColor`, so
 * the parent decides it (and the played part is just a second copy clipped to the progress).
 */
export function WaveformBars({ bars }: { bars: readonly number[] }) {
    return (
        <div aria-hidden className="flex h-full w-full items-center gap-[2px]">
            {bars.map((value, index) => (
                <span
                    key={index}
                    className="min-w-[2px] flex-1 rounded-full bg-current"
                    style={{ height: `${Math.max(MIN_BAR_PERCENT, Math.min(100, value))}%` }}
                />
            ))}
        </div>
    );
}

/** A small, repeatable string hash: the seed of a stand-in waveform. */
function hash(text: string): number {
    let value = 2166136261;
    for (let i = 0; i < text.length; i++) {
        value ^= text.charCodeAt(i);
        value = Math.imul(value, 16777619);
    }
    return value >>> 0;
}

/**
 * A waveform for a voice message that was stored without one (older clients, a failed meter): bars that
 * look like speech and are always the same for the same message, so the layout never jumps.
 */
export function getPlaceholderWaveform(seed: string, count: number = VOICE_WAVEFORM_BARS): number[] {
    let state = hash(seed) || 1;
    const next = () => {
        // xorshift32
        state ^= state << 13;
        state ^= state >>> 17;
        state ^= state << 5;
        return (state >>> 0) / 0xffffffff;
    };
    return Array.from({ length: count }, (_, index) => {
        const envelope = 0.55 + 0.45 * Math.sin((index / Math.max(count - 1, 1)) * Math.PI);
        return Math.round(25 + next() * 75 * envelope);
    });
}
