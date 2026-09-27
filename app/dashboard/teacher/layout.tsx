import type { Metadata } from "next";


export const metadata: Metadata = {
    title: "Teacher",
    description: `you can add a class in this page to your component.`
};
export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <>
            {children}
        </>
    );
}
