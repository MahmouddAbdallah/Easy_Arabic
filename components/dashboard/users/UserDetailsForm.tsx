'use client'

import { Controller, useForm } from 'react-hook-form'
import axios from 'axios'
import { toast } from 'react-hot-toast'
import { useRouter } from 'next/navigation'
import { Activity, Loader2Icon, Mail, Phone, User } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getApiError } from '@/lib/auth/client'

export type SettingsUser = {
    id: string
    name: string
    email: string
    phone: string
    status: 'active' | 'banned' | 'suspended'
}

type FormValues = Pick<SettingsUser, 'name' | 'email' | 'phone' | 'status'>

const toFormValues = (user: Partial<SettingsUser>): FormValues => ({
    name: user.name ?? '',
    email: user.email ?? '',
    phone: user.phone ?? '',
    status: user.status ?? 'active',
})

const EMAIL_PATTERN = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i
const PHONE_PATTERN = /^[+\d\s().-]+$/

/**
 * Edits the account fields an admin may change here. Saves through the existing
 * `PUT /api/users/[userId]` (the server validates and is the authority); only the
 * fields that actually changed are sent. `role` is not offered: this page belongs to
 * one role, and switching it would strand the user's lessons and links.
 */
const UserDetailsForm = ({ user }: { user: SettingsUser }) => {
    const router = useRouter()
    const initial = toFormValues(user)
    const {
        register,
        handleSubmit,
        control,
        reset,
        formState: { errors, isSubmitting, isDirty, dirtyFields },
    } = useForm<FormValues>({ defaultValues: initial })

    const onSubmit = handleSubmit(async (values) => {
        const patch: Partial<FormValues> = {}
        if (dirtyFields.name) patch.name = values.name.trim()
        if (dirtyFields.email) patch.email = values.email.trim()
        if (dirtyFields.phone) patch.phone = values.phone.trim()
        if (dirtyFields.status) patch.status = values.status
        if (Object.keys(patch).length === 0) return

        try {
            const { data } = await axios.put(`/api/users/${user.id}`, patch)
            toast.success(data.message ?? 'User updated successfully')
            reset(toFormValues(data.user))
            // The profile card above is rendered by the layout on the server; refresh it.
            router.refresh()
        } catch (error: unknown) {
            const err = getApiError(error, 'Failed to update user')
            if (err.status === 401) return router.push('/sign-in')
            toast.error(err.message)
        }
    })

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                    <User className="size-4 text-brand" aria-hidden="true" />
                    Account details
                </CardTitle>
                <CardDescription>Update this account&apos;s name, contact details and status.</CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={onSubmit} noValidate className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label htmlFor="settings-name" className="gap-2">
                                <User className="size-4 text-muted-foreground" aria-hidden="true" />
                                Full name
                            </Label>
                            <Input
                                id="settings-name"
                                autoComplete="off"
                                disabled={isSubmitting}
                                aria-invalid={!!errors.name}
                                {...register('name', {
                                    validate: (v) =>
                                        v.trim().length === 0 ? 'Name is required' : v.trim().length > 100 ? 'Name is too long' : true,
                                })}
                            />
                            {errors.name && <p className="text-xs font-medium text-destructive">{errors.name.message}</p>}
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="settings-status" className="gap-2">
                                <Activity className="size-4 text-muted-foreground" aria-hidden="true" />
                                Status
                            </Label>
                            <Controller
                                name="status"
                                control={control}
                                render={({ field }) => (
                                    <Select disabled={isSubmitting} value={field.value} onValueChange={field.onChange}>
                                        <SelectTrigger id="settings-status" className="w-full capitalize">
                                            <SelectValue placeholder="Select status" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="active">Active</SelectItem>
                                            <SelectItem value="suspended">Suspended</SelectItem>
                                            <SelectItem value="banned">Banned</SelectItem>
                                        </SelectContent>
                                    </Select>
                                )}
                            />
                            <p className="text-xs text-muted-foreground">Suspended and banned accounts can&apos;t sign in.</p>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="settings-email" className="gap-2">
                                <Mail className="size-4 text-muted-foreground" aria-hidden="true" />
                                Email address
                            </Label>
                            <Input
                                id="settings-email"
                                type="email"
                                autoComplete="off"
                                disabled={isSubmitting}
                                aria-invalid={!!errors.email}
                                {...register('email', {
                                    validate: (v) =>
                                        v.trim().length === 0 ? 'Email is required' : EMAIL_PATTERN.test(v.trim()) ? true : 'Enter a valid email address',
                                })}
                            />
                            {errors.email && <p className="text-xs font-medium text-destructive">{errors.email.message}</p>}
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="settings-phone" className="gap-2">
                                <Phone className="size-4 text-muted-foreground" aria-hidden="true" />
                                Phone number
                            </Label>
                            <Input
                                id="settings-phone"
                                autoComplete="off"
                                disabled={isSubmitting}
                                aria-invalid={!!errors.phone}
                                className="font-mono"
                                {...register('phone', {
                                    validate: (v) => {
                                        const value = v.trim()
                                        // An account that never had a phone number may keep it empty.
                                        if (value.length === 0) return initial.phone ? 'Phone is required' : true
                                        if (value.length > 30) return 'Phone number is too long'
                                        return PHONE_PATTERN.test(value) ? true : 'Enter a valid phone number'
                                    },
                                })}
                            />
                            {errors.phone && <p className="text-xs font-medium text-destructive">{errors.phone.message}</p>}
                        </div>
                    </div>

                    <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                        <Button type="button" variant="ghost" disabled={!isDirty || isSubmitting} onClick={() => reset(initial)}>
                            Discard changes
                        </Button>
                        <Button type="submit" disabled={!isDirty || isSubmitting} className="font-semibold">
                            {isSubmitting ? (
                                <>
                                    <Loader2Icon className="mr-2 size-4 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                'Save changes'
                            )}
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    )
}

export default UserDetailsForm
