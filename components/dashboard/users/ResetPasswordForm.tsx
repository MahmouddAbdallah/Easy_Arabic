'use client'

import { useForm, useWatch } from 'react-hook-form'
import axios from 'axios'
import { toast } from 'react-hot-toast'
import { useRouter } from 'next/navigation'
import { KeyRound, Loader2Icon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import PasswordField from '@/components/auth/PasswordField'
import { getApiError, passwordTooLong, PASSWORD_MAX_BYTES, PASSWORD_MIN_LENGTH } from '@/lib/auth/client'

interface FormInputs {
    newPassword: string
    confirmPassword: string
}

/**
 * Sets a new password for the user without needing their current one. The server route is
 * admin-only (this form is just the way to reach it) and signs the user out everywhere.
 */
const ResetPasswordForm = ({ userId }: { userId: string }) => {
    const router = useRouter()
    const {
        register,
        handleSubmit,
        control,
        reset,
        formState: { errors, isSubmitting },
    } = useForm<FormInputs>({ defaultValues: { newPassword: '', confirmPassword: '' } })
    const watchNew = useWatch({ control, name: 'newPassword' })

    const onSubmit = handleSubmit(async ({ newPassword }) => {
        try {
            const { data } = await axios.post(`/api/users/${userId}/reset-password`, { newPassword })
            toast.success(data.message ?? 'Password updated')
            reset()
        } catch (error: unknown) {
            const err = getApiError(error, 'Failed to reset password')
            if (err.status === 401) return router.push('/sign-in')
            toast.error(err.message)
        }
    })

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                    <KeyRound className="size-4 text-brand" aria-hidden="true" />
                    Reset password
                </CardTitle>
                <CardDescription>
                    Set a new password for this account. The current password isn&apos;t needed, and the user is signed out on all of their devices.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={onSubmit} noValidate className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <PasswordField
                            id="settings-new-password"
                            label="New password"
                            placeholder={`At least ${PASSWORD_MIN_LENGTH} characters`}
                            autoComplete="new-password"
                            disabled={isSubmitting}
                            error={errors.newPassword?.message}
                            registration={register('newPassword', {
                                required: 'Password is required',
                                minLength: { value: PASSWORD_MIN_LENGTH, message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters` },
                                validate: (v) => !passwordTooLong(v) || `Password is too long (maximum ${PASSWORD_MAX_BYTES} bytes)`,
                            })}
                        />
                        <PasswordField
                            id="settings-confirm-password"
                            label="Confirm new password"
                            placeholder="Re-enter the new password"
                            autoComplete="new-password"
                            disabled={isSubmitting}
                            error={errors.confirmPassword?.message}
                            registration={register('confirmPassword', {
                                required: 'Please confirm the password',
                                validate: (val) => watchNew === val || 'Passwords do not match',
                            })}
                        />
                    </div>

                    <div className="flex sm:justify-end">
                        <Button type="submit" disabled={isSubmitting} className="w-full font-semibold sm:w-auto">
                            {isSubmitting ? (
                                <>
                                    <Loader2Icon className="mr-2 size-4 animate-spin" />
                                    Updating...
                                </>
                            ) : (
                                'Reset password'
                            )}
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    )
}

export default ResetPasswordForm
