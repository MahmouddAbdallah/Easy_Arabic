import type { Metadata } from "next"
import AuthShell from "@/components/auth/AuthShell"
import ResetPasswordForm from "@/components/auth/ResetPasswordForm"

// The token is in the URL: never send it as a Referer, never index the page.
export const metadata: Metadata = {
    title: "Reset password",
    referrer: "no-referrer",
    robots: { index: false, follow: false },
}

const ResetPassword = async ({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) => {
    const { token } = await searchParams
    return (
        <AuthShell title="Choose a new password" description="Pick a new password for your account">
            <ResetPasswordForm token={typeof token === "string" ? token : undefined} />
        </AuthShell>
    )
}

export default ResetPassword
