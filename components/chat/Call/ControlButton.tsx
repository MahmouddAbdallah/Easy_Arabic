import type { ReactNode } from "react";
import { cn } from "cn";

const VARIANTS = {
    /** Frosted glass: the normal state of a control. */
    glass: "bg-white/15 text-white hover:bg-white/25",
    /** The control is switched on (muted, camera off): white, so it can't be missed. */
    on: "bg-white text-zinc-900 hover:bg-white/90",
    danger: "bg-red-500 text-white hover:bg-red-600",
    accept: "bg-emerald-500 text-white hover:bg-emerald-600",
} as const;

// A phone held sideways has little height to spare: the buttons shrink and lose their captions.
const SIZES = {
    md: "size-14 [@media(max-height:480px)]:size-12",
    lg: "size-16 [@media(max-height:480px)]:size-14",
} as const;

interface ControlButtonProps {
    /** What it does: read by screen readers and shown under the button. */
    label: string;
    onClick: () => void;
    children: ReactNode;
    variant?: keyof typeof VARIANTS;
    size?: keyof typeof SIZES;
    /** For toggles: whether it is switched on. */
    pressed?: boolean;
    disabled?: boolean;
    /** Hide the caption (the button keeps its accessible name). */
    hideLabel?: boolean;
    className?: string;
}

export function ControlButton({
    label,
    onClick,
    children,
    variant = "glass",
    size = "md",
    pressed,
    disabled,
    hideLabel,
    className,
}: ControlButtonProps) {
    return (
        <div className={cn("flex flex-col items-center gap-1.5", className)}>
            <button
                type="button"
                aria-label={label}
                aria-pressed={pressed}
                title={label}
                disabled={disabled}
                onClick={onClick}
                className={cn(
                    "grid shrink-0 place-items-center rounded-full outline-none backdrop-blur-md transition-all focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 active:scale-95 disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-6",
                    SIZES[size],
                    VARIANTS[variant]
                )}
            >
                {children}
            </button>
            {!hideLabel && (
                <span aria-hidden className="text-[11px] font-medium text-white/70 [@media(max-height:480px)]:hidden">
                    {label}
                </span>
            )}
        </div>
    );
}
