import { authorization } from "@/lib/verifyAuth";
import type { Metadata } from "next";
import { redirect } from "next/navigation";


export const metadata: Metadata = {
    title: "Add new lesson",
};
export default async function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const { user } = await authorization(['teacher'])
    if (!user) {
        redirect('/sign-in')
    }
    return (
        <>
            {children}
        </>
    );
}
