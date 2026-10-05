import { authorization } from "@/lib/verifyAuth";
import type { Metadata } from "next";
import { redirect } from "next/navigation";


export const metadata: Metadata = {
    title: "Sign in",
    description: `you can add a class in this page to your component.`
};
export default async function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const { user } = await authorization();
    if (user) {
        redirect('/')
    }
    return (
        <>
            {children}
        </>
    );
}
