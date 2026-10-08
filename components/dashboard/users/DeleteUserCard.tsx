'use client'

import { useState } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'
import { Loader2Icon, Trash2Icon, UserXIcon } from 'lucide-react'

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogMedia,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getApiError } from '@/lib/auth/client'
import type { SettingsUser } from './UserDetailsForm'

// What differs between a family and a teacher account; the card itself is identical.
const KINDS = {
    family: {
        singular: 'Family',
        listUrl: '/dashboard/families',
        removes: "their lessons (including the teachers' records of those lessons), teacher assignments, profile change requests and notification devices",
    },
    teacher: {
        singular: 'Teacher',
        listUrl: '/dashboard/teachers',
        removes: "their lessons (including the families' records of those lessons), family assignments, lesson rate and notification devices",
    },
} as const

/**
 * Danger zone. Calls the existing `DELETE /api/users/[userId]`, which removes the account and
 * its related rows in one transaction. The admin must type the account's email first, because
 * the deletion is permanent.
 */
const DeleteUserCard = ({ kind, user }: { kind: keyof typeof KINDS; user: SettingsUser }) => {
    const router = useRouter()
    const { singular, listUrl, removes } = KINDS[kind]
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [confirmation, setConfirmation] = useState('')

    const confirmed = confirmation.trim().toLowerCase() === user.email.trim().toLowerCase()

    const confirmDelete = async () => {
        if (!confirmed) return
        try {
            setLoading(true)
            await axios.delete(`/api/users/${user.id}`)
            toast.success(`${singular} deleted`)
            // Leave this page before anything re-renders it: the layout above would find no user.
            // Navigate first, then refresh, so the list is fetched fresh.
            router.replace(listUrl)
            router.refresh()
        } catch (error: unknown) {
            const err = getApiError(error, 'Failed to delete account')
            setLoading(false)
            if (err.status === 401) return router.push('/sign-in')
            toast.error(err.message)
        }
    }

    return (
        <Card className="ring-destructive/30">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base text-destructive">
                    <UserXIcon className="size-4" aria-hidden="true" />
                    Delete account
                </CardTitle>
                <CardDescription>
                    Permanently delete this {singular.toLowerCase()} account and the data that belongs to it. This can&apos;t be undone.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <AlertDialog
                    open={open}
                    onOpenChange={(next) => {
                        if (loading) return
                        setOpen(next)
                        if (!next) setConfirmation('')
                    }}
                >
                    <AlertDialogTrigger render={<Button variant="destructive" />}>
                        <Trash2Icon />
                        Delete {singular.toLowerCase()}
                    </AlertDialogTrigger>

                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogMedia className="bg-destructive/10 text-destructive">
                                <UserXIcon />
                            </AlertDialogMedia>
                            <AlertDialogTitle>Delete {user.name}?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This permanently removes the account along with {removes}. It can&apos;t be undone.
                            </AlertDialogDescription>
                        </AlertDialogHeader>

                        <div className="space-y-1.5">
                            <Label htmlFor="delete-confirmation" className="text-xs">
                                Type <strong className="font-semibold text-foreground">{user.email}</strong> to confirm
                            </Label>
                            <Input
                                id="delete-confirmation"
                                value={confirmation}
                                disabled={loading}
                                autoComplete="off"
                                onChange={(event) => setConfirmation(event.target.value)}
                            />
                        </div>

                        <AlertDialogFooter>
                            <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
                            <AlertDialogAction variant="destructive" disabled={loading || !confirmed} onClick={confirmDelete}>
                                {loading ? <Loader2Icon className="animate-spin" /> : <Trash2Icon />}
                                Delete {singular.toLowerCase()}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </CardContent>
        </Card>
    )
}

export default DeleteUserCard
