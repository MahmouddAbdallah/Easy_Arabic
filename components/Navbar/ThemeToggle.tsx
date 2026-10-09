'use client'

import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/lib/theme'
import { cn } from 'cn'
import { focusRing, iconButtonClass } from './styles'

interface ThemeToggleProps {
    /** `icon`: compact button for the header. `switch`: full-width labelled row for the drawer. */
    variant?: 'icon' | 'switch'
    className?: string
}

const ThemeToggle = ({ variant = 'icon', className }: ThemeToggleProps) => {
    const { theme, toggleTheme } = useTheme()

    if (variant === 'switch') {
        return (
            <button
                type="button"
                role="switch"
                aria-checked={theme === 'dark'}
                onClick={toggleTheme}
                className={cn(
                    'flex h-11 w-full cursor-pointer items-center gap-3 rounded-lg px-3 text-[0.9375rem] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground motion-reduce:transition-none',
                    focusRing,
                    className
                )}
            >
                <Moon aria-hidden className="size-5 shrink-0" />
                <span className="flex-1 text-start">Dark mode</span>
                {/* Track + knob are driven by the `dark` class, so they are right from first paint. */}
                <span
                    aria-hidden
                    className="relative h-6 w-10 shrink-0 rounded-full bg-muted-foreground/35 transition-colors duration-200 motion-reduce:transition-none dark:bg-brand"
                >
                    <span className="absolute start-0.5 top-0.5 size-5 rounded-full bg-white shadow-sm transition-[inset-inline-start] duration-200 motion-reduce:transition-none dark:start-[1.125rem]" />
                </span>
            </button>
        )
    }

    return (
        <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            title="Toggle theme"
            className={cn(iconButtonClass, className)}
        >
            {/* Both icons are always rendered and CSS picks one, so the correct one shows
                from first paint (no flash while the stored theme is read). */}
            <span aria-hidden className="relative grid size-[18px] place-items-center">
                <Sun className="absolute size-[18px] -rotate-90 scale-0 opacity-0 transition-all duration-300 ease-out motion-reduce:transition-none dark:rotate-0 dark:scale-100 dark:opacity-100" />
                <Moon className="absolute size-[18px] transition-all duration-300 ease-out motion-reduce:transition-none dark:rotate-90 dark:scale-0 dark:opacity-0" />
            </span>
        </button>
    )
}

export default ThemeToggle
