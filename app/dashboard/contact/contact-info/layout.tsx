import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Contact Page | Dashboard",
    description: "Edit the contact details shown on the public Contact page.",
};

export default function ContactInfoLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    return <>{children}</>;
}
