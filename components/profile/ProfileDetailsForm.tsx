'use client';

import { useForm } from 'react-hook-form';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { BookOpen, CalendarDays, Loader2Icon, Mail, Phone, User } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { getApiError } from '@/lib/auth/client';
import { formatDate } from '@/lib/profile/format';
import type { OwnProfile } from '@/lib/profile/service';
import { FieldRow, StaticValue } from './FieldRow';

type FormValues = { name: string; subject: string };

/**
 * "Your details": the customer's own information.
 * Name + subject are inputs while the profile is unlocked, plain text once it is locked.
 * Email, phone and join date are never inputs. (The server enforces all of this independently.)
 */
export function ProfileDetailsForm({ profile, canEditDirectly }: { profile: OwnProfile; canEditDirectly: boolean }) {
    const router = useRouter();
    const {
        register,
        handleSubmit,
        reset,
        formState: { errors, isSubmitting, isDirty, dirtyFields },
    } = useForm<FormValues>({ defaultValues: { name: profile.name, subject: profile.subject } });

    const onSubmit = handleSubmit(async (values) => {
        // Send only what changed.
        const patch: Partial<FormValues> = {};
        if (dirtyFields.name) patch.name = values.name.trim();
        if (dirtyFields.subject) patch.subject = values.subject.trim();
        if (Object.keys(patch).length === 0) return;

        try {
            const { data } = await axios.patch('/api/profile', patch);
            toast.success(data.message);
            reset({ name: data.profile.name, subject: data.profile.subject });
            router.refresh();
        } catch (error: unknown) {
            const err = getApiError(error);
            if (err.status === 401) return router.push('/sign-in');
            toast.error(err.message);
            // The profile may have locked while this page was open (a teacher was just assigned).
            if (err.code === 'PROFILE_LOCKED') router.refresh();
        }
    });

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                    <User className="size-4 text-brand" aria-hidden="true" />
                    Your details
                </CardTitle>
                <CardDescription>The badge next to each item shows who can change it.</CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={onSubmit} noValidate className="divide-y">
                    <FieldRow icon={User} label="Full name" kind={canEditDirectly ? 'editable' : 'locked'} htmlFor="profile-name">
                        {canEditDirectly ? (
                            <>
                                <Input
                                    id="profile-name"
                                    autoComplete="name"
                                    disabled={isSubmitting}
                                    aria-invalid={!!errors.name}
                                    {...register('name', {
                                        validate: (v) => (v.trim().length === 0 ? 'Name is required' : v.trim().length > 100 ? 'Name is too long' : true),
                                    })}
                                />
                                {errors.name && <p className="mt-1.5 text-xs text-destructive">{errors.name.message}</p>}
                            </>
                        ) : (
                            <StaticValue id="profile-name">{profile.name}</StaticValue>
                        )}
                    </FieldRow>

                    <FieldRow icon={BookOpen} label="Subject" kind={canEditDirectly ? 'editable' : 'locked'} htmlFor="profile-subject">
                        {canEditDirectly ? (
                            <>
                                <Input
                                    id="profile-subject"
                                    disabled={isSubmitting}
                                    aria-invalid={!!errors.subject}
                                    {...register('subject', {
                                        validate: (v) => (v.trim().length === 0 ? 'Subject is required' : v.trim().length > 50 ? 'Subject is too long' : true),
                                    })}
                                />
                                {errors.subject && <p className="mt-1.5 text-xs text-destructive">{errors.subject.message}</p>}
                            </>
                        ) : (
                            <StaticValue id="profile-subject">{profile.subject}</StaticValue>
                        )}
                    </FieldRow>

                    <FieldRow icon={Mail} label="Email" kind="admin" hint="Your email is how you sign in, so only the admin can change it. Send a request below if it needs updating.">
                        <StaticValue id="profile-email">{profile.email}</StaticValue>
                    </FieldRow>

                    <FieldRow icon={Phone} label="Phone" kind="admin" hint="Only the admin can change your phone number. Send a request below if it needs updating.">
                        <StaticValue id="profile-phone">{profile.phone}</StaticValue>
                    </FieldRow>

                    <FieldRow icon={CalendarDays} label="Member since" kind="readonly">
                        <StaticValue id="profile-joined">{formatDate(profile.createdAt)}</StaticValue>
                    </FieldRow>

                    {canEditDirectly && (
                        <div className="flex flex-col-reverse gap-2 pt-4 sm:flex-row sm:justify-end">
                            <Button
                                type="button"
                                variant="ghost"
                                disabled={!isDirty || isSubmitting}
                                onClick={() => reset({ name: profile.name, subject: profile.subject })}
                            >
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
                    )}
                </form>
            </CardContent>
        </Card>
    );
}
