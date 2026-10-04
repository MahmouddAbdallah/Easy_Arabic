import React, { Suspense } from "react";
import FamilyDetailsHeader from "@/components/dashboard/families/FamilyDetailsHeader";
import { FamilyDetailsHeaderSkeleton } from "@/components/dashboard/families/FamilySkeletons";

const RootLayout = async ({ children, params }: {
    params: Promise<{ familyId: string }>,
    children: React.ReactNode;
}) => {
    const { familyId } = await params;

    // The layout itself never waits on data: the profile/stats/nav block streams in
    // behind its own skeleton, and `children` is covered by each route's loading.tsx.
    return (
        <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
            <Suspense fallback={<FamilyDetailsHeaderSkeleton />}>
                <FamilyDetailsHeader familyId={familyId} />
            </Suspense>
            {children}
        </div>
    );
};

export default RootLayout;
