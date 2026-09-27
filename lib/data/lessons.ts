import { prismaArgs } from "@/lib/prismaArgs";
export const getLessons = prismaArgs<'Lesson'>('Lesson');