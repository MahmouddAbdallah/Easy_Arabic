import { NextResponse, NextRequest } from "next/server";
import { firstValidationMessage, addTeachersToFamilySchema } from "@/lib/validation";
import { db } from "@/prisma/db";
import { authorization } from "@/lib/verifyAuth";
import { apiError, isUniqueViolation } from "@/lib/apiResponse";

/**
 * Assign teachers to a family. This is the family-side twin of
 * POST /api/teacher/[teacherId]/family and writes the same `TeacherFamily` rows.
 *
 * Removing a link needs no route of its own: DELETE /api/teacher/[teacherId]/family/[familyId]
 * already removes the pair from either side.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ familyId: string }> }) {
    try {
        const { error } = await authorization(["admin"]);
        if (error) {
            return apiError(403, "FORBIDDEN", "Forbidden");
        }

        let body: unknown;
        try {
            body = await req.json();
        } catch {
            return apiError(400, "INVALID_JSON", "Request body must be valid JSON");
        }

        const validation = addTeachersToFamilySchema.safeParse({
            ...(body as Record<string, unknown>),
            familyId: (await params).familyId,
        });
        if (!validation.success) {
            return apiError(400, "VALIDATION_ERROR", firstValidationMessage(validation.error));
        }

        const { familyId } = validation.data;
        const teachersIds = [...new Set(validation.data.teachersIds)];

        const family = await db.orm.public.User
            .where({ id: familyId })
            .select("id", "role")
            .first();

        if (!family || family.role !== "family") {
            return apiError(404, "FAMILY_NOT_FOUND", "Family not found");
        }

        // Validate every teacher before creating anything, so a bad id can't leave a half-applied batch.
        const teachers = [];
        for (const id of teachersIds) {
            const teacher = await db.orm.public.User
                .where({ id })
                .select("id", "name", "email", "phone", "status", "subject", "role")
                .first();

            if (!teacher || teacher.role !== "teacher") {
                return apiError(404, "TEACHER_NOT_FOUND", `Teacher not found: ${id}`);
            }

            const existingLink = await db.orm.public.TeacherFamily
                .where({ teacherId: id, familyId })
                .first();

            if (existingLink) {
                return apiError(
                    409,
                    "CONFLICT",
                    `Teacher "${teacher.name}" is already assigned to this family`
                );
            }

            teachers.push(teacher);
        }

        const teacherFamilies = [];
        try {
            for (const teacher of teachers) {
                const link = await db.orm.public.TeacherFamily.create({
                    teacherId: teacher.id,
                    familyId,
                });
                teacherFamilies.push({
                    id: link.id,
                    createdAt: link.createdAt,
                    teacher: {
                        id: teacher.id,
                        name: teacher.name,
                        email: teacher.email,
                        phone: teacher.phone,
                        status: teacher.status,
                        subject: teacher.subject,
                    },
                });
            }
        } catch (err) {
            if (isUniqueViolation(err)) {
                return apiError(409, "CONFLICT", "One of these teachers was just assigned to this family");
            }
            throw err;
        }

        return NextResponse.json(
            { success: true, message: "Successfully added", teacherFamilies },
            { status: 201 }
        );
    } catch (error) {
        console.error(error);
        return apiError(500, "SERVER_ERROR", "Error in server");
    }
}
