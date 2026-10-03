'use client'

import React, { useState, useEffect } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, } from "@/components/ui/dropdown-menu"
import { MoreHorizontal, Mail, Phone, Calendar, ShieldCheck, Eye, UserX, EditIcon } from 'lucide-react'
import KeywordSearch from './KeywordSearch'
import EditUserDialog from './EditUserDialog'
import { useUserStore } from '@/stores/admin/users'
import { userType } from '@/types/userTypes'
import PaginationPage from '@/components/PaginationPage'
import { usePathname, useRouter } from 'next/navigation'

export type Role = 'family' | 'teacher' | 'admin' | string;
export type Status = 'active' | 'inactive' | 'pending' | string;


interface UsersTableProps {
    data: userType[]
    count?: number
}

const UsersTable: React.FC<UsersTableProps> = ({ data, count }) => {
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const { push } = useRouter();
    const pathname = usePathname();

    const setUsers = useUserStore((state) => state.setUsers)
    const users = useUserStore((state) => state.users)
    useEffect(() => {
        setUsers(data)
    }, [setUsers, data])

    const getInitials = (name: string) => {
        if (!name) return 'U'
        return name
            .trim()
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2)
    }


    return (
        <div className="space-y-4">

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card p-3.5 rounded-2xl border border-border/80 shadow-sm">
                <KeywordSearch placeholder="Search by name, email, or phone..." />
            </div>

            <div className="rounded-2xl border border-border/80 bg-card/95 backdrop-blur-sm shadow-sm overflow-hidden">
                <Table>
                    <TableHeader className="bg-muted/50">
                        <TableRow className="hover:bg-transparent">
                            <TableHead className="w-70">User</TableHead>
                            <TableHead>Contact Info</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Joined Date</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {(users ? users : data).length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-40 text-center text-muted-foreground">
                                    <div className="flex flex-col items-center justify-center gap-2">
                                        <UserX className="w-8 h-8 text-muted-foreground/50" />
                                        <p className="text-sm font-medium">No users found</p>
                                        <p className="text-xs text-muted-foreground">Try adjusting your search or filters</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            (users ? users : data).map((user) => (
                                <TableRow key={user.id} className="transition-colors hover:bg-muted/40">
                                    <TableCell className="font-medium">
                                        <div className="flex items-center gap-3">
                                            <Avatar className="h-10 w-10 border border-border/60">
                                                <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                                                    {getInitials(user?.name)}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="space-y-0.5">
                                                <p className="font-semibold text-foreground text-sm line-clamp-1">
                                                    {user.name}
                                                </p>
                                                <p className="text-[10px] text-muted-foreground font-mono tracking-tight">
                                                    ID: {user.id.slice(0, 8)}...
                                                </p>
                                            </div>
                                        </div>
                                    </TableCell>

                                    <TableCell>
                                        <div className="space-y-1 text-xs">
                                            <div className="flex items-center gap-1.5 text-muted-foreground">
                                                <Mail className="w-3.5 h-3.5 text-primary/70 shrink-0" />
                                                <span className="truncate max-w-45">{user.email}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 text-muted-foreground">
                                                <Phone className="w-3.5 h-3.5 text-primary/70 shrink-0" />
                                                <span className="font-mono">{user.phone}</span>
                                            </div>
                                        </div>
                                    </TableCell>

                                    <TableCell>
                                        <Badge variant="outline" className="gap-1 border-primary/30 bg-primary/5 text-primary font-medium text-xs px-2.5 py-0.5 capitalize">
                                            <ShieldCheck className="w-3 h-3" />
                                            {user.role}
                                        </Badge>
                                    </TableCell>

                                    <TableCell>
                                        <Badge
                                            variant="secondary"
                                            className={
                                                user.status === 'active'
                                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                                    : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                                            }
                                        >
                                            <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${user.status === 'active' ? 'bg-emerald-500' : 'bg-rose-500'
                                                }`} />
                                            <span className="capitalize">{user.status}</span>
                                        </Badge>
                                    </TableCell>

                                    <TableCell className="text-xs text-muted-foreground">
                                        <div className="flex items-center gap-1.5">
                                            <Calendar className="w-3.5 h-3.5 opacity-70" />
                                            {user.createdAt
                                                ? new Date(user.createdAt).toLocaleDateString('en-US', {
                                                    month: 'short',
                                                    day: 'numeric',
                                                    year: 'numeric'
                                                })
                                                : 'N/A'
                                            }
                                        </div>
                                    </TableCell>

                                    <TableCell className="text-right">
                                        {isEditDialogOpen &&
                                            <EditUserDialog
                                                user={user}
                                                open={isEditDialogOpen}
                                                onOpenChange={setIsEditDialogOpen}
                                            />
                                        }
                                        <DropdownMenu>
                                            <DropdownMenuTrigger className="flex justify-center items-center cursor-pointer  rounded-md h-8 w-8 p-0 hover:bg-muted" >
                                                <span className="sr-only">Open menu</span>
                                                <MoreHorizontal className="h-4 w-4" />
                                            </DropdownMenuTrigger>

                                            <DropdownMenuContent align="end" className="w-40">
                                                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                                                    Actions
                                                </div>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                    onClick={() => push(`${pathname}/${user.id}`)}
                                                    className="cursor-pointer gap-2">
                                                    <Eye className="w-4 h-4 text-muted-foreground" /> View Profile
                                                </DropdownMenuItem>

                                                <DropdownMenuItem
                                                    className="cursor-pointer gap-2"
                                                    onClick={() => setIsEditDialogOpen(true)}
                                                >
                                                    <EditIcon className="w-4 h-4 text-muted-foreground" /> Edit User
                                                </DropdownMenuItem>

                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>

                <PaginationPage
                    pageSize={10}
                    count={count}
                    totalRecords={users?.length}
                    variant='table' />
            </div>
        </div>
    )
}

export default UsersTable