import { Navbar } from "@/components/dashboard/Navbar/Navbar";
import { Sidebar } from "@/components/dashboard/Navbar/Sidebar";
import { authorization } from "@/lib/verifyAuth";
import { redirect } from "next/navigation";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
    const { user } = await authorization(['admin'])
    if (!user) {
        return redirect('/sign-in')
    }
    return (
        <div className="min-h-dvh bg-muted/40 dark:bg-background lg:flex">
            <a
                href="#dashboard-content"
                className="sr-only rounded-lg bg-card px-4 py-2 text-sm font-medium text-foreground shadow-lg ring-2 ring-brand focus:not-sr-only focus:fixed focus:inset-s-4 focus:top-4 focus:z-50"
            >
                Skip to content
            </a>

            {/* Hidden below `lg`; there the navbar opens the same sidebar as a drawer. */}
            <Sidebar />

            <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
                <Navbar />

                {/* The app's root layout already provides the <main> landmark. */}
                <div id="dashboard-content" tabIndex={-1} className="flex-1 outline-none">
                    {children}
                </div>
            </div>
        </div>
    );
}
