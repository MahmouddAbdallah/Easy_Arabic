import { notFound, redirect } from "next/navigation";
import PlannerView from "@/components/planner/PlannerView";
import { isValidId } from "@/lib/planner/validation";
import { authorization } from "@/lib/verifyAuth";
import { db } from "@/prisma/db";

/** Admin view of one family's planner. Same checks as the teacher version: admin only, and the id must be a family. */
export default async function FamilyPlannerPage({ params }: { params: Promise<{ familyId: string }> }) {
    const { familyId } = await params;
    const { user } = await authorization(["admin"]);
    if (!user) return redirect("/sign-in");

    if (!isValidId(familyId)) notFound();
    const family = await db.orm.public.User.where({ id: familyId }).select("id", "role").first();
    if (!family || family.role !== "family") notFound();

    return <PlannerView role="admin" subject={{ familyId }} />;
}
