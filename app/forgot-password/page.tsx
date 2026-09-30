import type { Metadata } from "next"
import Link from "next/link"
import AuthShell from "@/components/auth/AuthShell"
import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm"

export const metadata: Metadata = { title: "Forgot password" }

const ForgotPassword = () => (
    <AuthShell
        title="Forgot your password?"
        description="Enter your email and we'll send you a link to reset it"
        footer={
            <>
                Dont have an account?{" "}
                <Link href="/sign-up" className="text-primary hover:underline font-semibold">
                    Create an account
                </Link>
            </>
        }
    >
        <ForgotPasswordForm />
    </AuthShell>
)

export default ForgotPassword
