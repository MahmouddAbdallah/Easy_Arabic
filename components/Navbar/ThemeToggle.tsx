'use client'
import { useTheme } from '@/lib/theme'
import { SunIcon, MoonIcon } from '../icons'

const ThemeToggle = () => {
    const { theme, toggleTheme } = useTheme()
    return (
        <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="p-2 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground duration-150"
        >
            {theme === 'dark' ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
        </button>
    )
}

export default ThemeToggle
