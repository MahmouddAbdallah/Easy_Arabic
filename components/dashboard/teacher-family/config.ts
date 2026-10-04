import { GraduationCap, Users, type LucideIcon } from 'lucide-react'

/**
 * Teachers and families are linked through the `TeacherFamily` model. Both
 * dashboards manage the same rows, just from opposite ends:
 *
 *   'teacher' → a teacher's page, listing the families assigned to them
 *   'family'  → a family's page, listing the teachers assigned to them
 *
 * Everything that differs between the two (copy, endpoints, which relation to
 * read) lives in LINK_SIDES, so the UI is written once.
 */
export type LinkSide = 'teacher' | 'family'

/** The person on the far end of a link: a family (teacher side) or a teacher (family side). */
export interface LinkedUser {
    id: string
    name: string
    email: string
    phone?: string | null
    status?: string
    subject?: string
}

/** A `TeacherFamily` row, normalised so the UI doesn't care which side it is on. */
export interface TeacherFamilyLink {
    /** TeacherFamily row id. */
    id: string
    createdAt?: string
    user: LinkedUser
}

/** A `TeacherFamily` row as the server pages and API routes return it. */
export interface TeacherFamilyRow {
    id: string
    createdAt?: string
    family?: LinkedUser
    teacher?: LinkedUser
}

export interface LinkSideConfig {
    /** Role of the people listed on this side (used to search for people to add). */
    linkedRole: 'family' | 'teacher'
    /** Key on a TeacherFamily row that holds the listed person. */
    relation: 'family' | 'teacher'
    /** Where a listed person's own dashboard page lives. */
    profileBase: string
    icon: LucideIcon
    singular: string
    plural: string
    title: string
    description: string
    searchPlaceholder: string
    addLabel: string
    addTitle: string
    addDescription: string
    emptyTitle: string
    emptyHint: string
    removeTitle: string
    /** POST target for adding people; `ownerId` is the teacher/family whose page this is. */
    createUrl: (ownerId: string) => string
    createBody: (ownerId: string, linkedIds: string[]) => Record<string, unknown>
    /** DELETE target for removing one person. The route accepts the pair from either side. */
    removeUrl: (ownerId: string, linkedId: string) => string
}

export const LINK_SIDES: Record<LinkSide, LinkSideConfig> = {
    teacher: {
        linkedRole: 'family',
        relation: 'family',
        profileBase: '/dashboard/families',
        icon: Users,
        singular: 'family',
        plural: 'families',
        title: 'Enrolled families',
        description: 'Families assigned to this teacher.',
        searchPlaceholder: 'Search families…',
        addLabel: 'Add family',
        addTitle: 'Add families',
        addDescription: 'Search by name, email or phone, then select the families to assign to this teacher.',
        emptyTitle: 'No families assigned yet',
        emptyHint: 'Use “Add family” to assign the first one.',
        removeTitle: 'Remove family?',
        createUrl: (teacherId) => `/api/teacher/${teacherId}/family`,
        createBody: (teacherId, familiesIds) => ({ teacherId, familiesIds }),
        removeUrl: (teacherId, familyId) => `/api/teacher/${teacherId}/family/${familyId}`,
    },
    family: {
        linkedRole: 'teacher',
        relation: 'teacher',
        profileBase: '/dashboard/teachers',
        icon: GraduationCap,
        singular: 'teacher',
        plural: 'teachers',
        title: 'Assigned teachers',
        description: 'Teachers assigned to this family.',
        searchPlaceholder: 'Search teachers…',
        addLabel: 'Add teacher',
        addTitle: 'Add teachers',
        addDescription: 'Search by name, email or phone, then select the teachers to assign to this family.',
        emptyTitle: 'No teachers assigned yet',
        emptyHint: 'Use “Add teacher” to assign the first one.',
        removeTitle: 'Remove teacher?',
        createUrl: (familyId) => `/api/family/${familyId}/teacher`,
        createBody: (familyId, teachersIds) => ({ familyId, teachersIds }),
        // DELETE lives under the teacher route and takes both ids, so the arguments swap here.
        removeUrl: (familyId, teacherId) => `/api/teacher/${teacherId}/family/${familyId}`,
    },
}

/** Capitalises the first letter: 'family' → 'Family'. */
export const capitalize = (word: string) => word.charAt(0).toUpperCase() + word.slice(1)

/** Turns server rows into links, skipping any row whose related user is missing. */
export function toLinks(side: LinkSide, rows: TeacherFamilyRow[] = []): TeacherFamilyLink[] {
    const { relation } = LINK_SIDES[side]
    return rows.flatMap((row) => {
        const user = row[relation]
        return user ? [{ id: row.id, createdAt: row.createdAt, user }] : []
    })
}

/** Where to open a listed person's own page. */
export const profileHref = (side: LinkSide, userId: string) => `${LINK_SIDES[side].profileBase}/${userId}`
