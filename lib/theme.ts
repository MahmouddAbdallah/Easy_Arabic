'use client'
import { useCallback, useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'
const STORAGE_KEY = 'theme'

function applyTheme(theme: Theme) {
    document.documentElement.classList.toggle('dark', theme === 'dark')
}


export function useTheme() {
    const [theme, setThemeState] = useState<Theme>('light')

    useEffect(() => {
        const isDark = document.documentElement.classList.contains('dark')
        setThemeState(isDark ? 'dark' : 'light')
    }, [])

    const setTheme = useCallback((next: Theme) => {
        setThemeState(next)
        applyTheme(next)
        try {
            localStorage.setItem(STORAGE_KEY, next)
        } catch {
            // localStorage unavailable (private mode, etc.) — theme just
            // won't persist across reloads, not worth failing over.
        }
    }, [])

    const toggleTheme = useCallback(() => {
        setTheme(theme === 'dark' ? 'light' : 'dark')
    }, [theme, setTheme])

    return { theme, setTheme, toggleTheme }
}

export const themeBootstrapScript = `
(function () {
  try {
    var stored = localStorage.getItem('${STORAGE_KEY}');
    var isDark = stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (isDark) document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`
