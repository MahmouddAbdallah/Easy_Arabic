import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import axios from 'axios'
import { Controller, useFormContext } from 'react-hook-form'
import { useParams } from 'next/navigation'
import { Activity, AlertCircle, Loader2, Mail, Phone, UserIcon, UsersIcon } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue, } from '@/components/ui/select'
import ErrorMsg from '@/components/ErrorMsg'
import { useAppContext } from '@/components/AppContext'
import { useUserStore } from '@/stores/admin/users'
import { userType } from '@/types/userTypes'

// Everything that differs between "pick a family" and "pick a teacher" lives here.
const ROLE_CONFIG = {
    family: {
        label: 'Family',
        plural: 'families',
        fieldName: 'familyId',
        endpoint: (id: string) => `/api/teacher/${id}/families`,
    },
    teacher: {
        label: 'Teacher',
        plural: 'teachers',
        fieldName: 'teacherId',
        endpoint: (id: string) => `/api/family/${id}/teachers`,
    },
} as const

type Role = keyof typeof ROLE_CONFIG

interface SelectUserByRoleProps {
    isFilter: boolean
    role?: Role
}

// Stable reference so an empty store value doesn't create a new array on every render.
const EMPTY_USERS: userType[] = []

const firstParam = (value?: string | string[]) => (Array.isArray(value) ? value[0] : value)

const getInitials = (name?: string) => {
    const words = name?.trim().split(/\s+/).filter(Boolean) ?? []
    if (words.length === 0) return '?'
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
    return `${words[0][0]}${words[1][0]}`.toUpperCase()
}

/* -------------------------------------------------------------------------- */
/*  Presentational pieces                                                     */
/* -------------------------------------------------------------------------- */

const UserAvatar = ({ user, className }: { user: userType; className?: string }) => (
    <Avatar className={className}>
        <AvatarImage src={user.imageUrl} alt={user.name} />
        <AvatarFallback className="bg-primary/10 text-primary font-bold">
            {getInitials(user.name)}
        </AvatarFallback>
    </Avatar>
)

const ContactItem = ({ icon: Icon, value }: { icon: LucideIcon; value: string }) => (
    <div className="flex items-center gap-1">
        <Icon className="h-3 w-3 text-primary/70" />
        <span>{value}</span>
    </div>
)

const FieldLabel = ({
    htmlFor,
    icon: Icon,
    children,
}: {
    htmlFor: string
    icon: LucideIcon
    children: ReactNode
}) => (
    <label htmlFor={htmlFor} className="text-xs font-medium flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-primary" />
        <span>{children}</span>
    </label>
)

const UserOptionRow = ({ user }: { user: userType }) => (
    <div className="flex items-start gap-3 w-full text-left">
        <UserAvatar user={user} className="h-8 w-8 text-xs shrink-0 mt-0.5" />

        <div className="flex flex-col gap-1 grow">
            <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-sm text-foreground">{user.name}</span>
                {user.status && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 capitalize">
                        <Activity className="h-3 w-3" />
                        {user.status}
                    </span>
                )}
            </div>

            {(user.email || user.phone) && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {user.email && <ContactItem icon={Mail} value={user.email} />}
                    {user.phone && <ContactItem icon={Phone} value={user.phone} />}
                </div>
            )}
        </div>
    </div>
)

const StudentNameField = () => {
    const {
        register,
        formState: { errors },
    } = useFormContext()

    return (
        <div className="space-y-1.5">
            <FieldLabel htmlFor="student" icon={UserIcon}>
                Student Name
            </FieldLabel>
            <Input
                id="student"
                type="text"
                className="w-full h-auto text-sm"
                placeholder="Mohamed Abdullah"
                {...register('student', { required: 'Student name is required!' })}
            />
            <ErrorMsg message={errors?.student?.message as string} />
        </div>
    )
}

/* -------------------------------------------------------------------------- */
/*  Data                                                                      */
/* -------------------------------------------------------------------------- */

const useAssignedUsers = (role: Role, id?: string) => {
    const [loading, setLoading] = useState(false)
    const isFamily = role === 'family'

    const users = useUserStore(state => (isFamily ? state.families : state.teachers)) ?? EMPTY_USERS
    const setUsers = useUserStore(state => (isFamily ? state.setFamilies : state.setTeachers))

    useEffect(() => {
        if (!id) return

        const controller = new AbortController()

        const fetchUsers = async () => {
            setLoading(true)
            try {
                const { data } = await axios.get<{ data?: userType[] }>(
                    ROLE_CONFIG[role].endpoint(id),
                    { signal: controller.signal },
                )
                setUsers(data?.data ?? [])
            } catch (err) {
                if (axios.isCancel(err)) return
                console.error('Failed to fetch users:', err)
                setUsers([])
            } finally {
                if (!controller.signal.aborted) setLoading(false)
            }
        }

        fetchUsers()
        return () => controller.abort()
    }, [role, id, setUsers])

    return { users, loading }
}

/* -------------------------------------------------------------------------- */
/*  Component                                                                 */
/* -------------------------------------------------------------------------- */

const SelectUserByRole = ({ isFilter, role = 'teacher' }: SelectUserByRoleProps) => {
    const params = useParams()
    const { user: currentUser } = useAppContext()
    const {
        control,
        formState: { errors },
    } = useFormContext()

    const id = firstParam(params.teacherId) ?? firstParam(params.familyId) ?? currentUser?.id
    const { users, loading } = useAssignedUsers(role, id)

    const { label, plural, fieldName } = ROLE_CONFIG[role]
    const placeholder = `Select a ${label.toLowerCase()}`
    const rules = isFilter ? {} : { required: `Please select ${label.toLowerCase()}` }

    return (
        <div className="space-y-3">
            {!isFilter && (
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Select {label}
                </h3>
            )}

            <div className="space-y-1.5">
                <FieldLabel htmlFor={fieldName} icon={UsersIcon}>
                    {label}
                </FieldLabel>

                {loading ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground border p-2 rounded-md">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Loading {plural}...</span>
                    </div>
                ) : (
                    <Controller
                        name={fieldName}
                        control={control}
                        rules={rules}
                        render={({ field }) => {
                            const selectedUser = users.find(u => u.id === field.value)

                            return (
                                <Select onValueChange={field.onChange} value={field.value || ''}>
                                    <SelectTrigger id={fieldName} className="w-full h-auto py-2">
                                        <SelectValue placeholder={placeholder}>
                                            {selectedUser ? (
                                                <div className="flex items-center gap-2">
                                                    <UserAvatar
                                                        user={selectedUser}
                                                        className="h-6 w-6 text-[10px]"
                                                    />
                                                    <span>{selectedUser.name}</span>
                                                </div>
                                            ) : (
                                                placeholder
                                            )}
                                        </SelectValue>
                                    </SelectTrigger>

                                    <SelectContent>
                                        <SelectGroup>
                                            <SelectLabel>{label} list</SelectLabel>

                                            {users.length === 0 ? (
                                                <p className="p-3 text-xs font-medium text-muted-foreground flex items-center justify-center gap-1.5">
                                                    <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                                                    <span>No {plural} assigned to you yet</span>
                                                </p>
                                            ) : (
                                                users.map(user => (
                                                    <SelectItem key={user.id} value={user.id} className="py-2.5">
                                                        <UserOptionRow user={user} />
                                                    </SelectItem>
                                                ))
                                            )}
                                        </SelectGroup>
                                    </SelectContent>
                                </Select>
                            )
                        }}
                    />
                )}

                <ErrorMsg message={errors?.[fieldName]?.message as string} />
            </div>

            {!isFilter && <StudentNameField />}
        </div>
    )
}

export default SelectUserByRole