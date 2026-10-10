import { CalendarDays } from "lucide-react";
import { redirect } from "next/navigation";
import PlannerView from "@/components/planner/PlannerView";
import { authorization } from "@/lib/verifyAuth";

/**
 * The signed-in teacher's or family's own planner. Nothing in the URL says whose: the session decides, so there is no
 * id to tamper with. Admins have no planner of their own; they open one from a teacher's or family's dashboard page.
 */
export default async function PlannerPage() {
    const { user } = await authorization();
    if (!user) return redirect("/sign-in");
    if (user.role === "admin") return redirect("/dashboard");

    return (
        <>
            <div className="border-b border-border/60 pb-2 md:flex md:shrink-0 md:items-baseline md:gap-3">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2 md:shrink-0">
                    <CalendarDays className="h-6 w-6 text-primary" aria-hidden />
                    <span>Planner</span>
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 md:mt-0 md:min-w-0 md:truncate">
                    {user.role === "teacher"
                        ? "Schedule lessons for your families and answer their requests to cancel or move a lesson."
                        : "See your upcoming and past lessons. Need a change? Ask your teacher from here."}
                </p>
            </div>
            <PlannerView role={user.role === "teacher" ? "teacher" : "family"} fillViewport />
        </>
    );
}
