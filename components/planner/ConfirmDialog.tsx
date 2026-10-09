'use client'

import { Loader2 } from 'lucide-react'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface ConfirmDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    title: string
    description: React.ReactNode
    confirmLabel: string
    cancelLabel?: string
    destructive?: boolean
    loading?: boolean
    onConfirm: () => void
}

/**
 * "Are you sure?" for one-way actions (cancel a lesson, withdraw a request). The confirm button does NOT close the
 * dialog by itself: the caller closes it when the request succeeds, so an error leaves it open and visible.
 */
const ConfirmDialog = ({ open, onOpenChange, title, description, confirmLabel, cancelLabel = 'Keep it', destructive, loading, onConfirm }: ConfirmDialogProps) => (
    <AlertDialog open={open} onOpenChange={(next) => !loading && onOpenChange(next)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>{title}</AlertDialogTitle>
                <AlertDialogDescription>{description}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel disabled={loading}>{cancelLabel}</AlertDialogCancel>
                <AlertDialogAction variant={destructive ? 'destructive' : 'default'} disabled={loading} onClick={onConfirm}>
                    {loading && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
                    {confirmLabel}
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
)

export default ConfirmDialog
