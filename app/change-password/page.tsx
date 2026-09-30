import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import AuthShell from "@/components/auth/AuthShell"
import ChangePasswordForm from "@/components/auth/ChangePasswordForm"
import { authorization } from "@/lib/verifyAuth"

export const metadata: Metadata = { title: "Change password", robots: { index: false } }

const ChangePassword = async () => {
    const { error } = await authorization()
    if (error) redirect("/sign-in")

    return (
        <AuthShell
            title="Change password"
            description="Enter your current password, then choose a new one"
            footer={
                <Link href="/" className="text-primary hover:underline font-semibold">
                    Back to home
                </Link>
            }
        >
            <ChangePasswordForm />
        </AuthShell>
    )
}

export default ChangePassword
