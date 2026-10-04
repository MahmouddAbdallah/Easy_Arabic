import FamilyDetailsHeader from "@/components/dashboard/families/FamilyDetailsHeader";

const RootLayout = async ({ children, params }: {
    params: Promise<{ familyId: string }>,
    children: React.ReactNode;
}) => {
    const { familyId } = await params;

    return (
        <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
            <FamilyDetailsHeader familyId={familyId} />
            {children}
        </div>
    );
};

export default RootLayout;
