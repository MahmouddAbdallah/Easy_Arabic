import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Planner",
};

export default function PlannerLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    return <>{children}</>;
}
