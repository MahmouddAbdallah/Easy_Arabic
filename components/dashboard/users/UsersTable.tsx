'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { CalendarIcon, EditIcon, EyeIcon, MailIcon, MoreHorizontalIcon, PhoneIcon, UserXIcon } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, } from '@/components/ui/dropdown-menu'
import PaginationPage from '@/components/PaginationPage'
import { useUserStore } from '@/stores/admin/users'
import { userType } from '@/types/userTypes'
import EditUserDialog from './EditUserDialog'
import KeywordSearch from './KeywordSearch'
import { UserStatusBadge, getInitials } from './userDisplay'

export type Role = 'family' | 'teacher' | 'admin' | string
export type Status = 'active' | 'inactive' | 'pending' | string

interface UsersTableProps {
    data: userType[]
    /** Total rows matching the current search, across all pages. */
    count?: number
    /** Which directory this is: sets copy and where a row's profile link goes. */
    role: 'family' | 'teacher'
    pageSize?: number
}

const COPY = {
    family: { base: '/dashboard/families', singular: 'family', plural: 'families' },
    teacher: { base: '/dashboard/teachers', singular: 'teacher', plural: 'teachers' },
} as const

// UTC keeps the server- and client-rendered text identical whatever the viewer's timezone.
const formatJoined = (date: Date | string) =>
    new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

const UsersTable: React.FC<UsersTableProps> = ({ data, count, role, pageSize = 10 }) => {
    const { base, plural } = COPY[role]
    const keyword = useSearchParams().get('keyword')?.trim()
    const [editingUser, setEditingUser] = useState<userType | null>(null)

    // EditUserDialog saves through this store. The server's rows are shown straight away
    // (no empty first paint) and the store only overlays edits made since they loaded.
    const setUsers = useUserStore((state) => state.setUsers)
    const storedUsers = useUserStore((state) => state.users)
    useEffect(() => {
        setUsers(data)
    }, [setUsers, data])

    const rows = useMemo(() => {
        const stored = new Map(storedUsers.map((user) => [user.id, user]))
        return data.map((user) => stored.get(user.id) ?? user)
    }, [data, storedUsers])

    return (
        <div className="space-y-4">
            <div className="rounded-2xl border border-border/80 bg-card p-3.5 shadow-sm">
                <KeywordSearch placeholder="Search by name, email, or phone…" />
            </div>

            <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm">
                <Table>
                    <TableHeader className="bg-muted/50">
                        <TableRow className="hover:bg-transparent">
                            <TableHead className="pl-4 sm:pl-6">Name</TableHead>
                            <TableHead className="hidden md:table-cell">Contact</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="hidden lg:table-cell">Joined</TableHead>
                            <TableHead className="pr-4 text-right sm:pr-6">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.length === 0 ? (
                            <TableRow className="hover:bg-transparent">
                                <TableCell colSpan={5} className="h-48">
                                    <div className="flex flex-col items-center justify-center gap-2 text-center">
                                        <div className="rounded-full bg-muted p-3 text-muted-foreground">
                                            <UserXIcon className="size-5" />
                                        </div>
                                        <p className="text-sm font-medium text-foreground">
                                            {keyword ? `No ${plural} match “${keyword}”` : `No ${plural} yet`}
                                        </p>
                                        {keyword && (
                                            <p className="text-xs text-muted-foreground">
                                                Try a different name, email or phone number.
                                            </p>
                                        )}
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            rows.map((user) => (
                                <TableRow key={user.id} className="transition-colors hover:bg-muted/40">
                                    <TableCell className="pl-4 sm:pl-6">
                                        <div className="flex items-center gap-3">
                                            <Avatar className="size-10 border border-border/60">
                                                <AvatarFallback className="bg-brand-soft text-xs font-semibold text-brand">
                                                    {getInitials(user.name)}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="min-w-0">
                                                <Link
                                                    href={`${base}/${user.id}`}
                                                    className="block max-w-56 truncate rounded text-sm font-semibold text-foreground outline-none hover:underline focus-visible:ring-2 focus-visible:ring-brand/40"
                                                >
                                                    {user.name}
                                                </Link>
                                                {/* Contact has its own column from md up. */}
                                                <p className="max-w-56 truncate text-xs text-muted-foreground md:hidden">
                                                    {user.email}
                                                </p>
                                            </div>
                                        </div>
                                    </TableCell>

                                    <TableCell className="hidden md:table-cell">
                                        <div className="space-y-1 text-xs text-muted-foreground">
                                            <p className="flex items-center gap-1.5">
                                                <MailIcon className="size-3.5 shrink-0 text-brand/70" />
                                                <span className="max-w-56 truncate">{user.email}</span>
                                            </p>
                                            <p className="flex items-center gap-1.5">
                                                <PhoneIcon className="size-3.5 shrink-0 text-brand/70" />
                                                <span className="font-mono">{user.phone ?? 'No Phone'}</span>
                                            </p>
                                        </div>
                                    </TableCell>

                                    <TableCell>
                                        <UserStatusBadge status={user.status} />
                                    </TableCell>

                                    <TableCell className="hidden text-xs text-muted-foreground lg:table-cell">
                                        <span className="flex items-center gap-1.5">
                                            <CalendarIcon className="size-3.5 opacity-70" />
                                            {user.createdAt ? formatJoined(user.createdAt) : 'N/A'}
                                        </span>
                                    </TableCell>

                                    <TableCell className="pr-4 text-right sm:pr-6">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger
                                                aria-label={`Actions for ${user.name}`}
                                                className="inline-flex size-8 cursor-pointer items-center justify-center rounded-md outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-brand/40"
                                            >
                                                <span className="sr-only">Open menu</span>

                                                <MoreHorizontalIcon className="size-4" />
                                            </DropdownMenuTrigger>

                                            <DropdownMenuContent align="end" className="w-44">
                                                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                                                    Actions
                                                </div>                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem render={<Link href={`${base}/${user.id}`} />} className="cursor-pointer gap-2">
                                                    <EyeIcon className="text-muted-foreground" /> View profile
                                                </DropdownMenuItem>
                                                <DropdownMenuItem className="cursor-pointer gap-2" onClick={() => setEditingUser(user)}>
                                                    <EditIcon className="text-muted-foreground" /> Edit user
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>

                <PaginationPage pageSize={pageSize} count={count} variant="table" />
            </div>

            {/* One dialog for the whole table, keyed so its form starts from the right user. */}
            {editingUser && (
                <EditUserDialog
                    key={editingUser.id}
                    user={editingUser}
                    open
                    onOpenChange={(open) => {
                        if (!open) setEditingUser(null)
                    }}
                />
            )}
        </div>
    )
}

export default UsersTable
