import { Navbar } from "@/components/dashboard/Navbar/Navbar";
import { Sidebar } from "@/components/dashboard/Navbar/Sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-slate-50/50 dark:bg-zinc-950 lg:flex">
            <Sidebar />

            <div className="flex-1 flex flex-col min-h-screen">
                <Navbar />

                <main className="flex-1">
                    {children}
                </main>
            </div>
        </div>
    );
}