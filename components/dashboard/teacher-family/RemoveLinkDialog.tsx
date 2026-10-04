'use client'

import { useState } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { Loader2Icon, Trash2Icon, UserMinusIcon } from 'lucide-react'
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
import { LINK_SIDES, capitalize, type LinkSide, type TeacherFamilyLink } from './config'

interface RemoveLinkDialogProps {
    side: LinkSide
    /** Id of the teacher/family whose page this is. */
    ownerId: string
    link: TeacherFamilyLink
    onRemoved: (linkId: string) => void
}

/** Trash button + confirmation. One per row, so focus returns to the right button on cancel. */
const RemoveLinkDialog = ({ side, ownerId, link, onRemoved }: RemoveLinkDialogProps) => {
    const config = LINK_SIDES[side]
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)

    const confirmRemove = async () => {
        try {
            setLoading(true)
            await axios.delete(config.removeUrl(ownerId, link.user.id))
            toast.success(`${capitalize(config.singular)} removed`)
            setOpen(false)
            onRemoved(link.id)
        } catch (error: any) {
            toast.error(error?.response?.data?.error?.message || 'Something went wrong')
        } finally {
            setLoading(false)
        }
    }

    return (
        <AlertDialog open={open} onOpenChange={(next) => !loading && setOpen(next)}>
            <AlertDialogTrigger
                render={
                    <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove ${link.user.name}`}
                        title={`Remove ${link.user.name}`}
                        className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    />
                }
            >
                <Trash2Icon />
            </AlertDialogTrigger>

            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogMedia className="bg-destructive/10 text-destructive">
                        <UserMinusIcon />
                    </AlertDialogMedia>
                    <AlertDialogTitle>{config.removeTitle}</AlertDialogTitle>
                    <AlertDialogDescription>
                        <strong className="font-semibold text-foreground">{link.user.name}</strong> will be unassigned.
                        Existing lessons are not affected.
                    </AlertDialogDescription>
                </AlertDialogHeader>

                <AlertDialogFooter>
                    <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
                    <AlertDialogAction variant="destructive" disabled={loading} onClick={confirmRemove}>
                        {loading ? <Loader2Icon className="animate-spin" /> : <Trash2Icon />}
                        Remove {config.singular}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}

export default RemoveLinkDialog
