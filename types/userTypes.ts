export type userType = {
    id: string;
    name: string;
    status: "active" | "banned" | "suspended";
    email: string;
    phone: string;
    passwordLastChanged: string;
    role: "admin" | "teacher" | "family";
    createdAt: Date;
    updatedAt: Date
}