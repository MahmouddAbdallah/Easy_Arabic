import { Info, LockKeyhole } from 'lucide-react';
import { PROFILE_LOCK_MONTHS, type ProfileEligibility } from '@/lib/profile/rules';
import { formatDate } from '@/lib/profile/format';
import { cn } from '@/lib/utils';

/** Explains, in plain words, whether the customer can edit directly and why / until when. */
export function ProfileNotice({ eligibility }: { eligibility: ProfileEligibility }) {
    const { canEditDirectly, lockReasons, ageLockDate } = eligibility;
    const Icon = canEditDirectly ? Info : LockKeyhole;

    return (
        <div
            role="note"
            className={cn(
                'flex gap-3 rounded-2xl border p-4 text-sm',
                canEditDirectly ? 'border-brand/20 bg-brand-soft/60 text-foreground' : 'border-amber-500/30 bg-amber-500/10 text-foreground'
            )}
        >
            <Icon className={cn('mt-0.5 size-5 shrink-0', canEditDirectly ? 'text-brand' : 'text-amber-600 dark:text-amber-400')} aria-hidden="true" />
            <div className="space-y-1.5 leading-relaxed">
                {canEditDirectly ? (
                    <>
                        <p className="font-semibold">You can edit your name and subject yourself.</p>
                        <p className="text-muted-foreground">
                            This is open to you until {formatDate(ageLockDate)} ({PROFILE_LOCK_MONTHS} months after you joined) or until a teacher is assigned to you,
                            whichever comes first. After that, changes need the admin&apos;s approval. Your email and phone number are always changed by the admin.
                        </p>
                    </>
                ) : (
                    <>
                        <p className="font-semibold">Your profile is locked - changes need admin approval.</p>
                        <p className="text-muted-foreground">
                            {lockReasons.includes('teacher_assigned') && 'A teacher has been assigned to your account. '}
                            {lockReasons.includes('account_age') && `Your account is more than ${PROFILE_LOCK_MONTHS} months old. `}
                            To change anything, send a request below and the admin will review it.
                        </p>
                    </>
                )}
            </div>
        </div>
    );
}
