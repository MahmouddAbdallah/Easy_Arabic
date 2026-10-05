import Link from 'next/link';
import { KeyRound } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/** Password management is separate from the profile rules: it always uses the existing Change Password flow. */
export function PasswordCard() {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                    <KeyRound className="size-4 text-brand" aria-hidden="true" />
                    Password
                </CardTitle>
                <CardDescription>You can change your password at any time. You&apos;ll stay signed in on this device and be signed out everywhere else.</CardDescription>
            </CardHeader>
            <CardContent>
                <Link href="/change-password" className={buttonVariants({ variant: 'outline' })}>
                    Change password
                </Link>
            </CardContent>
        </Card>
    );
}
