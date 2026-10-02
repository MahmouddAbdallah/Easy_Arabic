import React, { Suspense } from 'react';
import TeacherDetailsHeader from '@/components/dashboard/teachers/TeacherDetailsHeader';
import { TeacherDetailsHeaderSkeleton } from '@/components/dashboard/teachers/TeacherSkeletons';

const RootLayout = async ({ children, params }: {
    params: Promise<{ id: string }>,
    children: React.ReactNode;
}) => {
    const { id } = await params;

    // The layout itself never waits on data: the profile/stats/nav block
    // streams in behind its own skeleton, and `children` is covered by the
    // route's loading.tsx. (A loading.tsx can't wrap the layout it sits next to.)
    return (
        <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
            <Suspense fallback={<TeacherDetailsHeaderSkeleton />}>
                <TeacherDetailsHeader id={id} />
            </Suspense>
            {children}
        </div>
    );
};

export default RootLayout;
