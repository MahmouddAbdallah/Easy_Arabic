import Link from "next/link"
import { LogoIcon } from "../icons"
import { cn } from "@/lib/utils"
import { focusRing } from "./styles"

interface BrandProps {
    onClick?: () => void
    className?: string
}

/**
 * Logo tile + wordmark. The wordmark uses the display serif (`font-display`), which only
 * resolves inside an element that carries `displayFont.variable`, so whatever renders this
 * (the header, the drawer) has to apply that class itself.
 */
export function Brand({ onClick, className }: BrandProps) {
    return (
        <Link
            href="/"
            onClick={onClick}
            aria-label="Easy Arabic, home"
            className={cn("group flex items-center gap-2.5 rounded-xl sm:gap-3", focusRing, className)}
        >
            <span
                aria-hidden
                className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-soft ring-1 ring-brand/15 transition-colors duration-200 group-hover:ring-brand/40 motion-reduce:transition-none sm:size-10"
            >
                <LogoIcon className="h-[18px] w-[22px] fill-brand stroke-brand sm:h-5 sm:w-6" />
            </span>
            <span className="font-display text-xl font-bold leading-none tracking-tight text-foreground max-[349px]:sr-only sm:text-[1.375rem]">
                Easy Arabic
            </span>
        </Link>
    )
}
