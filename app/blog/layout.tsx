import type { ReactNode } from "react";
import type { Metadata } from "next";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
    title: { default: "Blog | Easy Arabic", template: "%s | Easy Arabic" },
    description: "Notes on learning Arabic and the Quran: study tips, lesson ideas, and news from the Easy Arabic team.",
};

// The site navbar comes from AppProvider and the <main> landmark from the root layout. The footer is
// added here so the list and every post share it, while <Blog /> itself stays free of page chrome and
// can be embedded anywhere.
export default function BlogLayout({ children }: Readonly<{ children: ReactNode }>) {
    return (
        <>
            {children}
            <Footer />
        </>
    );
}
