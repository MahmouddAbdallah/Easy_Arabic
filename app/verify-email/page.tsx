import type { Metadata } from "next"
import AuthShell from "@/components/auth/AuthShell"
import VerifyEmail from "@/components/auth/VerifyEmail"

export const metadata: Metadata = {
    title: "Verify email",
    referrer: "no-referrer",
    robots: { index: false, follow: false },
}

const VerifyEmailPage = async ({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) => {
    const { token } = await searchParams
    return (
        <AuthShell title="Email verification" description="Confirming that this email address is yours">
            <VerifyEmail token={typeof token === "string" ? token : undefined} />
        </AuthShell>
    )
}

export default VerifyEmailPage
