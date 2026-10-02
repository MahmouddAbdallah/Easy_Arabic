'use client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Search, GraduationCap, Phone, SearchX, X } from "lucide-react";
import AddFamily from './AddFamily';
import DeleteFamily from './DeleteFamily';
import { TeacherFamilyType, useTeacherFamilyStore } from "@/stores/admin/teacherFamilies";
import { useEffect, useMemo, useState } from "react";


interface familiesListProps {
    students?: TeacherFamilyType[];
}

const TeacherFamiliesList = ({ students = [] }: familiesListProps) => {
    const [query, setQuery] = useState('');

    const teacherFamilies = useTeacherFamilyStore((state) => state.teacherFamilies);
    const setTeacherFamilies = useTeacherFamilyStore((state) => state.setTeacherFamilies);

    useEffect(() => {
        if (teacherFamilies.length > 0) return;
        setTeacherFamilies(students)
    }, [setTeacherFamilies, students])


    // Helper functions to safely fallback to nested family attributes
    const getStudentName = (s: any) => s.name || s.family?.name || 'Unnamed Student';
    const getStudentEmail = (s: any) => s.email || s.family?.email || 'No email provided';

    const visibleFamilies = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return teacherFamilies;
        return teacherFamilies.filter((tf) =>
            `${getStudentName(tf)} ${getStudentEmail(tf)}`.toLowerCase().includes(q)
        );
    }, [teacherFamilies, query]);

    return (
        <Card className="gap-0 overflow-hidden border-border/60 py-0 shadow-sm">
            {/* Header */}
            <CardHeader className="border-b border-border/40 bg-card p-4 sm:p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    {/* Title Block */}
                    <div className="flex items-center gap-3">
                        <div className="shrink-0 rounded-xl border border-brand/20 bg-brand-soft p-2.5 text-brand">
                            <GraduationCap className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <CardTitle className="text-lg font-semibold tracking-tight">
                                    Enrolled Families
                                </CardTitle>
                                <Badge variant="secondary" className="rounded-full px-2.5 font-mono text-xs tabular-nums">
                                    {teacherFamilies.length}
                                </Badge>
                            </div>
                            <CardDescription className="mt-0.5 text-xs text-muted-foreground">
                                Manage assigned Families and track their enrollment status.
                            </CardDescription>
                        </div>
                    </div>

                    {/* Controls Area */}
                    <div className="flex w-full items-center gap-2.5 md:w-auto">
                        <div className="relative flex-1 md:w-64 md:flex-none">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" />
                            <Input
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Search enrolled..."
                                aria-label="Search enrolled families"
                                className="h-9 bg-muted/30 pl-9 text-xs transition-colors focus-visible:bg-background"
                            />
                        </div>
                        <AddFamily />
                    </div>
                </div>
            </CardHeader>

            {/* List Content */}
            <CardContent className="divide-y divide-border/60 p-0">
                {visibleFamilies.length > 0 ? (
                    visibleFamilies.map((teacherFamily) => {
                        const displayName = getStudentName(teacherFamily);
                        const displayEmail = getStudentEmail(teacherFamily);
                        const phone = teacherFamily?.family?.phone;
                        const isActive = teacherFamily?.family?.status === 'active';

                        return (
                            <div
                                key={teacherFamily.id}
                                className="flex items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-muted/30 sm:px-6"
                            >
                                <div className="flex min-w-0 items-center gap-3">
                                    <Avatar className="h-10 w-10 border">
                                        <AvatarFallback className="bg-brand-soft font-medium text-brand">
                                            {displayName.slice(0, 2).toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="min-w-0">
                                        <h4 className="truncate text-sm font-semibold text-foreground">{displayName}</h4>
                                        <p className="truncate text-xs text-muted-foreground">{displayEmail}</p>
                                    </div>
                                </div>

                                <div className="flex shrink-0 items-center gap-3 sm:gap-5">
                                    {phone && (
                                        <span className="hidden items-center gap-1.5 font-mono text-xs text-muted-foreground lg:inline-flex">
                                            <Phone className="h-3.5 w-3.5 text-brand/70" />
                                            {phone}
                                        </span>
                                    )}
                                    <Badge
                                        variant={isActive ? 'default' : 'secondary'}
                                        className="px-2.5 text-[11px] capitalize"
                                    >
                                        {teacherFamily?.family?.status}
                                    </Badge>
                                    <DeleteFamily teacherFamily={teacherFamily} />
                                </div>
                            </div>
                        );
                    })
                ) : teacherFamilies.length > 0 ? (
                    <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
                        <div className="rounded-full bg-muted p-3 text-muted-foreground">
                            <SearchX className="h-5 w-5" />
                        </div>
                        <p className="text-sm font-medium text-foreground">No matching families</p>
                        <p className="text-xs text-muted-foreground">
                            Nothing matches &ldquo;{query.trim()}&rdquo;. Try a different name or email.
                        </p>
                        <Button variant="ghost" size="sm" className="mt-1 h-8 gap-1.5 text-xs" onClick={() => setQuery('')}>
                            <X className="h-3.5 w-3.5" />
                            Clear search
                        </Button>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
                        <div className="rounded-full bg-muted p-3 text-muted-foreground">
                            <GraduationCap className="h-5 w-5" />
                        </div>
                        <p className="text-sm font-medium text-foreground">No families found</p>
                        <p className="text-xs text-muted-foreground">
                            There are no enrolled families yet. Use Add Student to assign one.
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default TeacherFamiliesList;
