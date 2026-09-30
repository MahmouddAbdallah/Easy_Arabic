import { authorization } from "@/lib/verifyAuth";
import type { Metadata } from "next";
import { redirect } from "next/navigation";


export const metadata: Metadata = {
    title: "Lessons",
};
export default async function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const { user } = await authorization(['teacher', 'admin']);
    if (!user) {
        return redirect('/sign-in')
    }
    return (
        <>
            {children}
        </>
    );
}
