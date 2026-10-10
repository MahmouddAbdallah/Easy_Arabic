import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Planner",
};

/**
 * The page shell, shared by the page and its loading state so nothing jumps when the planner streams in.
 * Below `md` it is the same stacked, scrolling page as before (phones get the agenda list). From `md` up it is exactly
 * one screen tall: the viewport minus the sticky navbar (h-16 + its 1px border = 4.0625rem), so the calendar can use
 * all the room and scroll inside its own card instead of making the whole page scroll. `w-full`, not `w-svw`: svw
 * counts the scrollbar and would overflow sideways. Below `min-h` (very short windows) it scrolls like a normal page.
 */
export default function PlannerLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    return (
        <div className="mx-auto w-full max-w-7xl p-4 sm:p-6 max-md:space-y-6 md:flex md:h-[calc(100svh-4.0625rem)] md:min-h-[34rem] md:flex-col md:gap-3 md:overflow-hidden md:px-6 md:py-4 lg:px-8">
            {children}
        </div>
    );
}
