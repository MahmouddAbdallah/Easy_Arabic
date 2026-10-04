'use client';

import React, { SetStateAction, useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { LessonItem } from '@/types/lessonTypes';
import PaginationPage from '../PaginationPage';
import LessonForm from './LessonForm';
import LessonRow from './LessonRow';
import { DeleteLesson } from './DeleteLesson';
import { useSyncedLessons } from './useSyncedLessons';

interface LessonsTableProps {
    data: LessonItem[];
    count: number;
    /** Whose lessons these are. The teacher view lists families and can edit; the family view lists teachers and is read-only. */
    role: 'teacher' | 'family'
}

/** The row action currently open, if any. */
type RowAction = { type: 'edit' | 'delete'; lesson: LessonItem };

const NO_LESSONS: LessonItem[] = [];
const PAGE_SIZE = 20;
const HEAD = "text-xs font-semibold uppercase tracking-wider";

const LessonsTable: React.FC<LessonsTableProps> = ({ data = NO_LESSONS, count = 0, role = 'teacher' }) => {
    const { lessons, total } = useSyncedLessons(data, count);
    const [action, setAction] = useState<RowAction | null>(null);

    const canManage = role === 'teacher';
    const columnCount = canManage ? 7 : 6;

    // LessonForm and DeleteLesson take a boolean "open" setter. They only exist while their
    // dialog is open, so the only thing it can ever be asked to do is close.
    const setOpen = (next: SetStateAction<boolean>) => {
        if (!(typeof next === 'function' ? next(true) : next)) setAction(null);
    };

    return (
        <div>
            <Card className="pb-0! border border-border/80 shadow-sm rounded-xl overflow-hidden bg-card">
                <CardHeader className="border-b border-border/60 bg-muted/20 px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-lg font-semibold tracking-tight">Lessons Overview</CardTitle>
                            <CardDescription className="text-xs text-muted-foreground mt-0.5">
                                Manage and track all scheduled, attended, or cancelled lessons.
                            </CardDescription>
                        </div>
                        <Badge variant="outline" className="px-2.5 py-1 text-xs font-normal border-border/80">
                            Total: {total}
                        </Badge>
                    </div>
                </CardHeader>

                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-muted/40">
                            <TableRow className="hover:bg-transparent border-border/60">
                                <TableHead className={`w-45 ${HEAD}`}>{canManage ? 'Family' : 'Teacher'}</TableHead>
                                <TableHead className={`w-45 ${HEAD}`}>Student Name</TableHead>
                                <TableHead className={HEAD}>Status</TableHead>
                                <TableHead className={HEAD}>Reward</TableHead>
                                <TableHead className={HEAD}>Duration</TableHead>
                                <TableHead className={HEAD}>Date</TableHead>
                                {canManage && <TableHead className={`text-right ${HEAD}`}>Actions</TableHead>}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {lessons.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={columnCount} className="h-32 text-center text-xs text-muted-foreground">
                                        No lessons found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                lessons.map((lesson) => (
                                    <LessonRow
                                        key={lesson.id}
                                        lesson={lesson}
                                        role={role}
                                        canManage={canManage}
                                        onEdit={(l) => setAction({ type: 'edit', lesson: l })}
                                        onDelete={(l) => setAction({ type: 'delete', lesson: l })}
                                    />
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>

                <PaginationPage pageSize={PAGE_SIZE} count={total} variant="table" />
            </Card>

            <Dialog open={action?.type === 'edit'} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-150 w-[98vw] max-w-none p-0!" showCloseButton={true}>
                    {action?.type === 'edit' && (
                        <LessonForm initialData={action.lesson} setOpen={setOpen} isEditing={true} />
                    )}
                </DialogContent>
            </Dialog>

            {action?.type === 'delete' && (
                <DeleteLesson open={true} setOpen={setOpen} lessonId={action.lesson.id} />
            )}
        </div>
    );
};

export default LessonsTable;
