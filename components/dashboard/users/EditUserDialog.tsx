'use client'

import React from 'react'
import { Controller, useForm } from 'react-hook-form'
import axios from 'axios'
import { toast } from 'react-hot-toast'
import { Loader2, Mail, Phone, User, ShieldCheck, Activity } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from "@/components/ui/select"

import { Role, Status } from './UsersTable'
import { userType } from '@/types/userTypes'
import { useUserStore } from '@/stores/admin/users'

interface EditUserDialogProps {
    user: userType
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess?: () => void
}

interface EditFormInputs {
    name: string
    email: string
    phone: string
    role: Role
    status: Status
}

const EditUserDialog: React.FC<EditUserDialogProps> = ({ user, open, onOpenChange, }) => {
    const updateUser = useUserStore(state => state.updateUser)
    const { register, handleSubmit, control, formState: { errors, isSubmitting }, } = useForm<EditFormInputs>({
        defaultValues: { ...user }
    })

    const onSubmit = handleSubmit(async (formData) => {
        try {
            const { data } = await axios.put(`/api/users/${user.id}`, formData, {
                headers: { 'Content-Type': 'application/json' },
            })
            updateUser(data.user.id, data.user)
            onOpenChange(false)
            toast.success('User details updated successfully')
        } catch (error: any) {
            toast.error(
                error?.response?.data?.error?.message ||
                'Failed to update user'
            )
        }
    })

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-120 rounded-2xl p-6 bg-card border-border/80 shadow-2xl">
                <DialogHeader className="space-y-1 text-left">
                    <DialogTitle className="text-xl font-bold tracking-tight">
                        Edit User Profile
                    </DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground">
                        Make changes to user account information below.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={onSubmit} className="space-y-4 py-2">
                    {/* Name */}
                    <div className="space-y-1.5">
                        <Label htmlFor="edit-name" className="text-xs font-semibold">
                            Full Name
                        </Label>
                        <div className="relative flex items-center">
                            <User className="w-4 h-4 absolute left-3 text-muted-foreground pointer-events-none" />
                            <Input
                                id="edit-name"
                                disabled={isSubmitting}
                                placeholder="John Doe"
                                className="pl-9 h-9 text-xs"
                                {...register('name', { required: 'Name is required' })}
                            />
                        </div>
                        {errors.name && (
                            <p className="text-[11px] text-destructive font-medium">
                                {errors.name.message}
                            </p>
                        )}
                    </div>

                    {/* Email */}
                    <div className="space-y-1.5">
                        <Label htmlFor="edit-email" className="text-xs font-semibold">
                            Email Address
                        </Label>
                        <div className="relative flex items-center">
                            <Mail className="w-4 h-4 absolute left-3 text-muted-foreground pointer-events-none" />
                            <Input
                                id="edit-email"
                                type="email"
                                disabled={isSubmitting}
                                placeholder="user@example.com"
                                className="pl-9 h-9 text-xs"
                                {...register('email', {
                                    required: 'Email is required',
                                    pattern: {
                                        value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                                        message: 'Invalid email address',
                                    },
                                })}
                            />
                        </div>
                        {errors.email && (
                            <p className="text-[11px] text-destructive font-medium">
                                {errors.email.message}
                            </p>
                        )}
                    </div>

                    {/* Phone */}
                    <div className="space-y-1.5">
                        <Label htmlFor="edit-phone" className="text-xs font-semibold">
                            Phone Number
                        </Label>
                        <div className="relative flex items-center">
                            <Phone className="w-4 h-4 absolute left-3 text-muted-foreground pointer-events-none" />
                            <Input
                                id="edit-phone"
                                disabled={isSubmitting}
                                placeholder="+1234567890"
                                className="pl-9 h-9 text-xs font-mono"
                                {...register('phone', { required: 'Phone is required' })}
                            />
                        </div>
                        {errors.phone && (
                            <p className="text-[11px] text-destructive font-medium">
                                {errors.phone.message}
                            </p>
                        )}
                    </div>

                    {/* Role & Status Row */}
                    <div className="grid grid-cols-2 gap-3 pt-1">
                        {/* Role Select */}
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold flex items-center gap-1">
                                <ShieldCheck className="w-3.5 h-3.5 text-primary" /> Role
                            </Label>
                            <Controller
                                name="role"
                                control={control}
                                render={({ field }) => (
                                    <Select
                                        disabled={isSubmitting}
                                        onValueChange={field.onChange}
                                        value={field.value}
                                    >
                                        <SelectTrigger className="h-9 text-xs capitalize">
                                            <SelectValue placeholder="Select role" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="family">Family</SelectItem>
                                            <SelectItem value="teacher">Teacher</SelectItem>
                                            <SelectItem value="admin">Admin</SelectItem>
                                        </SelectContent>
                                    </Select>
                                )}
                            />
                        </div>

                        {/* Status Select */}
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold flex items-center gap-1">
                                <Activity className="w-3.5 h-3.5 text-primary" /> Status
                            </Label>
                            <Controller
                                name="status"
                                control={control}
                                render={({ field }) => (
                                    <Select
                                        disabled={isSubmitting}
                                        onValueChange={field.onChange}
                                        value={field.value}
                                    >
                                        <SelectTrigger className="h-9 text-xs capitalize">
                                            <SelectValue placeholder="Select status" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="active">Active</SelectItem>
                                            <SelectItem value="banned">Banned</SelectItem>
                                            <SelectItem value="suspended">Suspended</SelectItem>
                                        </SelectContent>
                                    </Select>
                                )}
                            />
                        </div>
                    </div>

                    <DialogFooter className="pt-4 gap-2 sm:gap-0">
                        <Button
                            type="button"
                            variant="outline"
                            disabled={isSubmitting}
                            onClick={() => onOpenChange(false)}
                            className="h-9 text-xs"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={isSubmitting}
                            className="h-9 text-xs font-semibold"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />
                                    Saving...
                                </>
                            ) : (
                                'Save Changes'
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}

export default EditUserDialog