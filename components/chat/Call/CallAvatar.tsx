import { cn } from "cn";

// Nobody in this app has a profile photo, so a person is a colored circle with their initial. The color
// comes from the name, so the same person always looks the same.
const GRADIENTS = [
    "from-emerald-400 to-teal-600",
    "from-sky-400 to-blue-600",
    "from-violet-400 to-purple-600",
    "from-rose-400 to-pink-600",
    "from-amber-400 to-orange-600",
    "from-cyan-400 to-indigo-600",
];

function gradientFor(name: string): string {
    let hash = 0;
    for (const char of name) hash = (hash * 31 + (char.codePointAt(0) ?? 0)) | 0;
    return GRADIENTS[Math.abs(hash) % GRADIENTS.length];
}

const SIZES = {
    sm: "size-11 text-lg",
    md: "size-20 text-3xl",
    lg: "size-28 text-5xl",
    xl: "size-36 text-6xl",
} as const;

interface CallAvatarProps {
    name: string;
    size?: keyof typeof SIZES;
    /** Ripples outwards while the call is ringing. */
    ringing?: boolean;
    /** How loud this person is right now (0 to 1): a ring that follows their voice. */
    level?: number;
    className?: string;
}

export function CallAvatar({ name, size = "lg", ringing = false, level = 0, className }: CallAvatarProps) {
    // Array.from keeps a letter outside the basic plane (or an emoji) in one piece.
    const initial = Array.from(name.trim())[0]?.toUpperCase() ?? "?";

    return (
        <div className={cn("relative grid shrink-0 place-items-center", SIZES[size], className)}>
            {ringing && (
                <>
                    <span aria-hidden className="absolute inset-0 rounded-full bg-white/10 motion-safe:animate-ping" />
                    <span aria-hidden className="absolute -inset-3 rounded-full bg-white/5 motion-safe:animate-pulse" />
                </>
            )}
            <span
                aria-hidden
                className="absolute -inset-2 rounded-full bg-emerald-400/30 transition-[transform,opacity] duration-150"
                style={{ transform: `scale(${1 + level * 0.25})`, opacity: level > 0 ? 0.4 + level * 0.6 : 0 }}
            />
            <span
                aria-hidden
                className={cn(
                    "relative grid size-full place-items-center rounded-full bg-linear-to-br font-semibold text-white shadow-lg ring-1 ring-white/20",
                    gradientFor(name)
                )}
            >
                {initial}
            </span>
        </div>
    );
}
