import { NextResponse, NextRequest } from "next/server";
import { firstValidationMessage, addFamilyToTeacherSchema } from "@/lib/validation";
import { db } from "@/prisma/db";
import { authorization } from "@/lib/verifyAuth";
import { apiError as fail, isUniqueViolation } from "@/lib/apiResponse";

export async function POST(req: NextRequest, { params }: { params: Promise<{ teacherId: string }> }) {
    try {
        const { error } = await authorization(["admin"]);
        if (error) {
            return fail(403, "FORBIDDEN", typeof error === "string" ? error : "Forbidden");
        }
        let body: any;
        try {
            body = await req.json();
        } catch {
            return fail(400, "INVALID_JSON", "Request body must be valid JSON");
        }

        const validation = addFamilyToTeacherSchema.safeParse({
            ...body,
            teacherId: (await params).teacherId
        });
        if (!validation.success) {
            return fail(400, "VALIDATION_ERROR", firstValidationMessage(validation.error));
        }

        const { teacherId } = validation.data;
        const familiesIds = [...new Set(validation.data.familiesIds)];

        const teacher = await db.orm.public.User
            .where({ id: teacherId })
            .select("id", "role")
            .first();

        if (!teacher || teacher.role !== "teacher") {
            return fail(404, "TEACHER_NOT_FOUND", "Teacher not found");
        }

        const families: { id: string; email: string; name: string; phone?: string; status: string }[] = [];

        for (const id of familiesIds) {
            const family = await db.orm.public.User
                .where({ id })
                .select("id", "email", "name", "phone", "status", "role")
                .first();

            if (!family || family.role !== "family") {
                return fail(404, "FAMILY_NOT_FOUND", `Family not found: ${id}`);
            }

            const existingLink = await db.orm.public.TeacherFamily
                .where({ familyId: id, teacherId })
                .first();

            if (existingLink) {
                return fail(
                    409,
                    "CONFLICT",
                    `Family "${family.name}" is already linked to this teacher`
                );
            }

            families.push({
                id: family.id,
                name: family.name,
                email: family.email,
                ...(family.phone && { phone: family.phone }),
                status: family.status
            });
        }

        const teacherFamilies = [];
        try {
            for (const family of families) {
                const teacherFamily = await db.orm.public.TeacherFamily.create({
                    familyId: family.id,
                    teacherId,
                });
                teacherFamilies.push({
                    id: teacherFamily.id,
                    createdAt: teacherFamily.createdAt,
                    family: {
                        id: family.id,
                        name: family.name,
                        email: family.email,
                        phone: family.phone,
                        status: family.status,
                    },
                });
            }
        } catch (err) {
            if (isUniqueViolation(err)) {
                return fail(409, "CONFLICT", "One of these families was just linked to this teacher");
            }
            throw err;
        }

        return NextResponse.json(
            { success: true, message: "Successfully added", teacherFamilies },
            { status: 201 }
        );
    } catch (error) {
        console.error(error);
        return fail(500, "SERVER_ERROR", "Error in server");
    }
}