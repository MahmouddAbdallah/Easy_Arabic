const ROLE_LABEL: Record<string, string> = { admin: "Admin", teacher: "Teacher", family: "Family" };

/** What a role is called on screen. Unknown roles are shown as they are; a missing role gives null. */
export function getRoleLabel(role: string | null | undefined): string | null {
    if (!role) return null;
    return ROLE_LABEL[role] ?? role;
}
