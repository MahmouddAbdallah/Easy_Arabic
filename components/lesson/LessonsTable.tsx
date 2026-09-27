'use client';

import React, { useEffect, useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Calendar as CalendarIcon, Users, Edit3, Trash2, HelpCircle, UserIcon } from "lucide-react";
import { format } from "date-fns";
import { DURATION_OPTIONS, OptionItem, REWARD_OPTIONS, STATUS_OPTIONS } from './LessonOptions';
import PaginationPage from '../PaginationPage';
import LessonForm from './LessonForm';
import { Dialog, DialogContent, } from '../ui/dialog';
import { LessonItem } from '@/types/lessonTypes';
import { DeleteLesson } from './DeleteLesson';
import { useLessonStore } from '@/stores/lessons';

interface LessonsTableProps {
    data: LessonItem[];
    count: number;
}

const LessonsTable: React.FC<LessonsTableProps> = ({ data, count = 0 }) => {
    const [isEdit, setIsEdit] = useState(false);
    const [isDelete, setIsDelete] = useState(false);
    const [lesson, setLesson] = useState<Partial<LessonItem>>({})

    const getOption = (options: OptionItem[], value: string) => {
        return options.find((opt) => opt.value === value);
    };

    const setLessons = useLessonStore(state => state.setLessons);
    const setCount = useLessonStore(state => state.setCount);
    const lessons = useLessonStore(state => state.lessons);
    const number = useLessonStore(state => state.count);

    useEffect(() => {
        setLessons(data)
    }, [setLessons, data]);
    useEffect(() => {
        setCount(count)
    }, [setCount, count]);

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
                            Total: {lessons?.length}
                        </Badge>
                    </div>
                </CardHeader>

                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-muted/40">
                            <TableRow className="hover:bg-transparent border-border/60">
                                <TableHead className="w-45 text-xs font-semibold uppercase tracking-wider">Family</TableHead>
                                <TableHead className="w-45 text-xs font-semibold uppercase tracking-wider">Student Name</TableHead>
                                <TableHead className="text-xs font-semibold uppercase tracking-wider">Status</TableHead>
                                <TableHead className="text-xs font-semibold uppercase tracking-wider">Reward</TableHead>
                                <TableHead className="text-xs font-semibold uppercase tracking-wider">Duration</TableHead>
                                <TableHead className="text-xs font-semibold uppercase tracking-wider">Date</TableHead>
                                <TableHead className="text-right text-xs font-semibold uppercase tracking-wider">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {lessons?.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-32 text-center text-xs text-muted-foreground">
                                        No lessons found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                lessons?.map((lesson) => {
                                    const statusInfo = getOption(STATUS_OPTIONS, lesson.status);
                                    const rewardInfo = getOption(REWARD_OPTIONS, lesson.TeacherReward);
                                    const durationInfo = getOption(DURATION_OPTIONS, `${lesson.duration}`);

                                    const StatusIcon = statusInfo?.icon || HelpCircle;
                                    const RewardIcon = rewardInfo?.icon || HelpCircle;
                                    const DurationIcon = durationInfo?.icon || HelpCircle;

                                    const formattedDate = lesson.classDate
                                        ? format(new Date(lesson.classDate), "MMM dd, yyyy")
                                        : "N/A";

                                    return (
                                        <TableRow key={lesson.id} className="hover:bg-muted/30 transition-colors border-border/50 group">
                                            {/* Family / Student */}
                                            <TableCell className="font-medium text-xs py-3.5">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="p-1.5 rounded-md bg-primary/10 text-primary shrink-0">
                                                        <Users className="h-3.5 w-3.5" />
                                                    </div>
                                                    <div className="flex flex-col min-w-0">
                                                        <span
                                                            className="font-semibold text-foreground truncate max-w-40"
                                                            title={lesson.family?.name || 'Family Name'}
                                                        >
                                                            {lesson.family?.name || 'Family Name'}
                                                        </span>
                                                        {lesson.family?.email && (
                                                            <span
                                                                className="text-[11px] text-muted-foreground truncate max-w-40"
                                                                title={lesson.family.email}
                                                            >
                                                                {lesson.family.email}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </TableCell>

                                            {/* Student Name */}
                                            <TableCell className="py-3.5">
                                                {statusInfo ? (
                                                    <div className='flex items-center gap-1'>
                                                        <UserIcon className="size-4 text-blue-500" />
                                                        <span className='font-semibold text-sm'>{lesson.student}</span>
                                                    </div>
                                                ) : '-'}
                                            </TableCell>

                                            {/* Status */}
                                            <TableCell className="py-3.5">
                                                {statusInfo ? (
                                                    <Badge
                                                        variant="outline"
                                                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-medium border rounded-full ${statusInfo.color}`}
                                                    >
                                                        <StatusIcon className="h-3 w-3" />
                                                        <span>{statusInfo.label}</span>
                                                    </Badge>
                                                ) : '-'}
                                            </TableCell>

                                            {/* Reward */}
                                            <TableCell className="py-3.5">
                                                {rewardInfo ? (
                                                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium border ${rewardInfo.color}`}>
                                                        <RewardIcon className="h-3.5 w-3.5" />
                                                        <span>{rewardInfo.label}</span>
                                                    </div>
                                                ) : '-'}
                                            </TableCell>

                                            {/* Duration */}
                                            <TableCell className="py-3.5">
                                                {durationInfo ? (
                                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                                                        <DurationIcon className={`h-3.5 w-3.5 ${durationInfo.color}`} />
                                                        <span>{durationInfo.label}</span>
                                                    </div>
                                                ) : '-'}
                                            </TableCell>

                                            {/* Date */}
                                            <TableCell className="py-3.5">
                                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                    <CalendarIcon className="h-3.5 w-3.5 text-emerald-500" />
                                                    <span>{formattedDate}</span>
                                                </div>
                                            </TableCell>

                                            {/* Actions */}
                                            <TableCell className="text-right py-3.5">
                                                <div className="flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => {
                                                            setLesson(lesson)
                                                            setIsEdit(true)
                                                        }}
                                                        className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-md"
                                                    >
                                                        <Edit3 className="h-3.5 w-3.5" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => {
                                                            setLesson(lesson)
                                                            setIsDelete(true)
                                                        }}
                                                        className="h-8 w-8 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 rounded-md"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
                <PaginationPage
                    pageSize={20}
                    count={number}
                    variant='table'
                />
            </Card>
            <Dialog open={isEdit} onOpenChange={setIsEdit}>
                <DialogContent
                    className="sm:max-w-150 w-[98vw] max-w-none p-0!"
                    showCloseButton={true}
                >
                    {isEdit && <LessonForm
                        initialData={lesson}
                        setOpen={setIsEdit}
                        isEditing={true}
                    />}
                </DialogContent>
            </Dialog>

            {isDelete && <DeleteLesson
                open={isDelete}
                setOpen={setIsDelete}
                lessonId={lesson.id}
            />}

        </div>
    );
};

export default LessonsTable;