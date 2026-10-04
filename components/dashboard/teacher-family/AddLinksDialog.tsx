'use client'

import { useEffect, useState } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { Loader2Icon, SearchIcon, UserPlusIcon } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { getInitials } from '../users/userDisplay'
import { LINK_SIDES, capitalize, toLinks, type LinkSide, type LinkedUser, type TeacherFamilyLink } from './config'

const SEARCH_DEBOUNCE_MS = 400

interface AddLinksDialogProps {
    side: LinkSide
    /** Id of the teacher/family whose page this is. */
    ownerId: string
    /** Ids already linked: shown as "Assigned" and not selectable. */
    linkedIds: ReadonlySet<string>
    onAdded: (links: TeacherFamilyLink[]) => void
}

const AddLinksDialog = ({ side, ownerId, linkedIds, onAdded }: AddLinksDialogProps) => {
    const config = LINK_SIDES[side]

    const [open, setOpen] = useState(false)
    const [search, setSearch] = useState('')
    const [results, setResults] = useState<LinkedUser[]>([])
    const [totalMatches, setTotalMatches] = useState(0)
    const [searching, setSearching] = useState(false)
    const [searchFailed, setSearchFailed] = useState(false)
    // Kept across searches, so people picked under one search are still added after searching for another.
    const [selected, setSelected] = useState<Map<string, LinkedUser>>(new Map())
    const [submitting, setSubmitting] = useState(false)

    const keyword = search.trim()

    useEffect(() => {
        if (!keyword) {
            setResults([])
            setTotalMatches(0)
            setSearching(false)
            setSearchFailed(false)
            return
        }

        setSearching(true)
        setSearchFailed(false)

        // Typing again cancels the pending/in-flight request, so a slow old answer can't overwrite a newer one.
        const controller = new AbortController()
        const timer = setTimeout(async () => {
            try {
                const { data } = await axios.get('/api/users', {
                    params: { keyword, role: config.linkedRole },
                    signal: controller.signal,
                })
                setResults(data?.users?.data ?? [])
                setTotalMatches(data?.users?.count ?? 0)
            } catch (error) {
                if (axios.isCancel(error)) return
                console.error(error)
                setResults([])
                setTotalMatches(0)
                setSearchFailed(true)
            } finally {
                if (!controller.signal.aborted) setSearching(false)
            }
        }, SEARCH_DEBOUNCE_MS)

        return () => {
            clearTimeout(timer)
            controller.abort()
        }
    }, [keyword, config.linkedRole])

    const reset = () => {
        setSearch('')
        setSelected(new Map())
    }

    const handleOpenChange = (next: boolean) => {
        if (submitting) return
        setOpen(next)
        if (!next) reset()
    }

    const toggle = (user: LinkedUser) => {
        setSelected((prev) => {
            const next = new Map(prev)
            if (next.has(user.id)) next.delete(user.id)
            else next.set(user.id, user)
            return next
        })
    }

    const handleSubmit = async () => {
        if (selected.size === 0) return
        try {
            setSubmitting(true)
            const { data } = await axios.post(config.createUrl(ownerId), config.createBody(ownerId, [...selected.keys()]))
            const added = toLinks(side, data?.teacherFamilies)
            onAdded(added)
            toast.success(added.length === 1 ? `${capitalize(config.singular)} added` : `${added.length} ${config.plural} added`)
            setOpen(false)
            reset()
        } catch (error: any) {
            toast.error(error?.response?.data?.error?.message || 'Something went wrong')
        } finally {
            setSubmitting(false)
        }
    }

    const count = selected.size
    const submitLabel = count === 0 ? config.addLabel : `Add ${count} ${count === 1 ? config.singular : config.plural}`

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger render={<Button size="lg" aria-label={config.addLabel} className="shrink-0 gap-2" />}>
                <UserPlusIcon />
                <span className="hidden sm:inline">{config.addLabel}</span>
            </DialogTrigger>

            <DialogContent className="sm:max-w-lg">
                <DialogHeader className="pr-8">
                    <DialogTitle>{config.addTitle}</DialogTitle>
                    <DialogDescription>{config.addDescription}</DialogDescription>
                </DialogHeader>

                <div className="space-y-3">
                    <div className="relative">
                        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Name, email or phone"
                            aria-label={`Search ${config.plural}`}
                            className="h-9 pl-9"
                            autoFocus
                        />
                    </div>

                    <div className="flex h-5 items-center justify-between text-xs text-muted-foreground">
                        <span>
                            {!searching && results.length > 0 &&
                                (totalMatches > results.length
                                    ? `Showing ${results.length} of ${totalMatches} — refine your search to narrow it down`
                                    : `${results.length} found`)}
                        </span>
                        {count > 0 && (
                            <span className="flex items-center gap-2">
                                <span className="font-medium text-foreground">{count} selected</span>
                                <button
                                    type="button"
                                    onClick={() => setSelected(new Map())}
                                    className="rounded text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
                                >
                                    Clear
                                </button>
                            </span>
                        )}
                    </div>

                    <div className="h-72 overflow-y-auto rounded-lg border bg-muted/20 p-2" aria-live="polite">
                        {searching ? (
                            <Message icon={<Loader2Icon className="animate-spin" />} title="Searching…" />
                        ) : searchFailed ? (
                            <Message
                                icon={<SearchIcon />}
                                title="Couldn’t search right now"
                                hint="Check your connection, then edit the search to try again."
                            />
                        ) : !keyword ? (
                            <Message
                                icon={<SearchIcon />}
                                title={`Find a ${config.singular}`}
                                hint={`Start typing a name, email or phone number.`}
                            />
                        ) : results.length === 0 ? (
                            <Message
                                icon={<SearchIcon />}
                                title={`No ${config.plural} match “${keyword}”`}
                                hint="Check the spelling, or try their email address."
                            />
                        ) : (
                            <ul className="space-y-1.5">
                                {results.map((user) => (
                                    <li key={user.id}>
                                        <ResultRow
                                            user={user}
                                            assigned={linkedIds.has(user.id)}
                                            checked={selected.has(user.id)}
                                            onToggle={() => toggle(user)}
                                        />
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" size="lg" disabled={submitting} onClick={() => handleOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button size="lg" disabled={count === 0 || submitting} onClick={handleSubmit}>
                        {submitting && <Loader2Icon className="animate-spin" />}
                        {submitLabel}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

function Message({ icon, title, hint }: { icon: React.ReactNode; title: string; hint?: string }) {
    return (
        <div className="flex h-full flex-col items-center justify-center gap-1.5 px-6 text-center">
            <div className="mb-1 rounded-full bg-muted p-2.5 text-muted-foreground [&_svg]:size-5">{icon}</div>
            <p className="text-sm font-medium text-foreground">{title}</p>
            {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
    )
}

interface ResultRowProps {
    user: LinkedUser
    assigned: boolean
    checked: boolean
    onToggle: () => void
}

function ResultRow({ user, assigned, checked, onToggle }: ResultRowProps) {
    const body = (
        <>
            <Avatar>
                <AvatarFallback className="bg-brand-soft text-xs font-medium text-brand">
                    {getInitials(user.name)}
                </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{user.name}</p>
                <p className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                    <span className="truncate">{user.email}</span>
                    {user.phone && <span className="font-mono">{user.phone}</span>}
                </p>
            </div>
        </>
    )

    if (assigned) {
        return (
            <div className="flex items-center gap-3 rounded-lg border bg-background px-3 py-2 opacity-70">
                {body}
                <Badge variant="secondary">Assigned</Badge>
            </div>
        )
    }

    return (
        <label
            className={cn(
                'flex cursor-pointer items-center gap-3 rounded-lg border bg-background px-3 py-2 transition-colors hover:bg-muted/50',
                checked && 'border-brand/40 bg-brand-soft hover:bg-brand-soft'
            )}
        >
            {body}
            <Checkbox checked={checked} onCheckedChange={onToggle} aria-label={`Select ${user.name}`} />
        </label>
    )
}

export default AddLinksDialog
