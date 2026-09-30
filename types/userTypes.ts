export type userType = {
    id: string;
    name: string;
    status: "active" | "banned" | "suspended";
    email: string;
    phone: string;
    passwordLastChanged: string;
    emailVerifiedAt?: string | null;
    role: "admin" | "teacher" | "family";
    createdAt: Date;
    updatedAt: Date
}