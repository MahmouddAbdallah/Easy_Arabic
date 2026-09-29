'use client';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, GraduationCap, } from "lucide-react";
import AddFamily from './AddFamily';
import DeleteFamily from './DeleteFamily';
import { userType } from '@/types/userTypes';

export interface Student {
    id: string;
    family: Partial<userType>;
    createdAt: Temporal.Instant
}

interface StudentsListProps {
    students?: Student[];
}

export const StudentsList = ({ students = [] }: StudentsListProps) => {
    const [enrolledStudents, setEnrolledStudents] = useState<Student[]>(students);
    const [search, setSearch] = useState('');

    // Helper functions to safely fallback to nested family attributes
    const getStudentName = (s: any) => s.name || s.family?.name || 'Unnamed Student';
    const getStudentEmail = (s: any) => s.email || s.family?.email || 'No email provided';

    const filteredStudents = enrolledStudents.filter((s) => {
        const name = getStudentName(s).toLowerCase();
        const email = getStudentEmail(s).toLowerCase();
        const query = search.toLowerCase();
        return name.includes(query) || email.includes(query);
    });



    return (
        <div className="relative space-y-4">
            <Card className="border-border/60 shadow-sm overflow-hidden">
                {/* Header */}
                <CardHeader className="p-6 border-b border-border/40 bg-card">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        {/* Title Block */}
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0">
                                <GraduationCap className="h-5 w-5" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <CardTitle className="text-lg font-semibold tracking-tight">
                                        Enrolled Students
                                    </CardTitle>
                                    <Badge variant="secondary" className="rounded-full font-mono text-xs px-2.5 py-0.5">
                                        {enrolledStudents.length}
                                    </Badge>
                                </div>
                                <CardDescription className="text-xs text-muted-foreground mt-0.5">
                                    Manage assigned students and track their enrollment status.
                                </CardDescription>
                            </div>
                        </div>

                        {/* Controls Area */}
                        <div className="flex items-center gap-2.5 w-full md:w-auto">
                            <div className="relative flex-1 md:w-60">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
                                <Input
                                    placeholder="Search enrolled..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="pl-9 h-9 text-xs bg-muted/30 focus-visible:bg-background transition-colors"
                                />
                            </div>
                            <AddFamily />
                        </div>
                    </div>
                </CardHeader>

                {/* List Content */}
                <CardContent className="p-0 divide-y divide-border/60">
                    {filteredStudents.length > 0 ? (
                        filteredStudents.map((student) => {
                            const displayName = getStudentName(student);
                            const displayEmail = getStudentEmail(student);

                            return (
                                <div
                                    key={student.id}
                                    className={`flex items-center justify-between p-4 transition-colors bg-primary/5 hover:bg-muted/30`}
                                >
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-10 w-10 border">
                                            <AvatarImage src={student.family.name} alt={displayName} />
                                            <AvatarFallback className="bg-primary/10 text-primary font-medium">
                                                {displayName.slice(0, 2).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h4 className="text-sm font-semibold text-foreground">{displayName}</h4>
                                            </div>
                                            <p className="text-xs text-muted-foreground">{displayEmail}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        <Badge
                                            variant={student?.family?.status === 'active' ? 'default' : 'secondary'}
                                            className="text-xs px-2.5 py-0.5 capitalize hidden xs:inline-flex"
                                        >
                                            {student?.family?.status}
                                        </Badge>
                                        <DeleteFamily family={student?.family} />
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="p-12 text-center space-y-2">
                            <p className="text-sm font-medium text-foreground">No students found</p>
                            <p className="text-xs text-muted-foreground">
                                {search ? 'Try adjusting your search criteria.' : 'There are no enrolled students yet.'}
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Warning Confirmation Dialog */}
            {/* Floating Bottom Action Bar */}

        </div>
    );
};