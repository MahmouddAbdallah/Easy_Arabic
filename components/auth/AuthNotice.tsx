import type { ReactNode } from 'react'
import { AlertCircleIcon, CheckCircle2Icon } from 'lucide-react'

/** Inline status panel for the new auth states, built from the same theme tokens as the rest of the auth UI. */
export default function AuthNotice({
    tone,
    children,
}: {
    tone: 'error' | 'success' | 'info'
    children: ReactNode
}) {
    const styles = {
        error: 'border-destructive/30 bg-destructive/10 text-destructive',
        success: 'border-primary/30 bg-primary/10 text-foreground',
        info: 'border-border bg-muted/40 text-foreground',
    }[tone]
    const Icon = tone === 'success' ? CheckCircle2Icon : AlertCircleIcon
    return (
        <div
            role={tone === 'error' ? 'alert' : 'status'}
            className={`flex gap-3 rounded-xl border p-3 text-sm ${styles}`}
        >
            <Icon className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
            <div className="space-y-2 min-w-0">{children}</div>
        </div>
    )
}
