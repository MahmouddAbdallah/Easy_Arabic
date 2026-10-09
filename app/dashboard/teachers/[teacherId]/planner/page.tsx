import { notFound, redirect } from "next/navigation";
import PlannerView from "@/components/planner/PlannerView";
import { isValidId } from "@/lib/planner/validation";
import { authorization } from "@/lib/verifyAuth";
import { db } from "@/prisma/db";

/**
 * Admin view of one teacher's planner. The dashboard layout already requires an admin, but a layout is not a security
 * boundary for the page beneath it (they render independently), so this page checks again, and checks that the id in
 * the URL really is a teacher. The data itself comes through /api/planner, which re-verifies both on every call.
 */
export default async function TeacherPlannerPage({ params }: { params: Promise<{ teacherId: string }> }) {
    const { teacherId } = await params;
    const { user } = await authorization(["admin"]);
    if (!user) return redirect("/sign-in");

    if (!isValidId(teacherId)) notFound();
    const teacher = await db.orm.public.User.where({ id: teacherId }).select("id", "role").first();
    if (!teacher || teacher.role !== "teacher") notFound();

    return <PlannerView role="admin" subject={{ teacherId }} />;
}
