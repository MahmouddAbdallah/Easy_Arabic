import React from 'react';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, Edit3, GraduationCap, Trash2, UserIcon, Users, type LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TableCell, TableRow } from '@/components/ui/table';
import { userType } from '@/types/userTypes';
import { LessonItem } from '@/types/lessonTypes';
import { ALL_STATUS_OPTIONS, DURATION_OPTIONS, OptionItem, REWARD_OPTIONS } from './LessonOptions';

const findOption = (options: OptionItem[], value: string) => options.find((option) => option.value === value);

interface LessonRowProps {
    lesson: LessonItem;
    /** Whose lessons these are; decides whether the other party is a family or a teacher. */
    role: 'teacher' | 'family';
    /** Show the edit/delete actions. */
    canManage: boolean;
    onEdit: (lesson: LessonItem) => void;
    onDelete: (lesson: LessonItem) => void;
}

const LessonRow = ({ lesson, role, canManage, onEdit, onDelete }: LessonRowProps) => {
    const status = findOption(ALL_STATUS_OPTIONS, lesson.status);
    // A scheduled lesson hasn't happened yet, so it has no reward to show (the column only holds the database default).
    const reward = lesson.status === 'SCHEDULED' ? undefined : findOption(REWARD_OPTIONS, lesson.TeacherReward);
    const duration = findOption(DURATION_OPTIONS, `${lesson.duration}`);

    return (
        <TableRow className="hover:bg-muted/30 transition-colors border-border/50 group">
            {role === 'teacher'
                ? <PartyCell party={lesson.family} icon={Users} fallback="Family Name" />
                : <PartyCell party={lesson.teacher} icon={GraduationCap} fallback="Teacher Name" />}

            <TableCell className="py-3.5">
                {lesson.student ? (
                    <div className="flex items-center gap-1">
                        <UserIcon className="size-4 text-blue-500" />
                        <span className="font-semibold text-sm">{lesson.student}</span>
                    </div>
                ) : '-'}
            </TableCell>

            <TableCell className="py-3.5">
                {status ? (
                    <Badge
                        variant="outline"
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-medium border rounded-full ${status.color}`}
                    >
                        <status.icon className="h-3 w-3" />
                        <span>{status.label}</span>
                    </Badge>
                ) : '-'}
            </TableCell>

            <TableCell className="py-3.5">
                {reward ? (
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium border ${reward.color}`}>
                        <reward.icon className="h-3.5 w-3.5" />
                        <span>{reward.label}</span>
                    </div>
                ) : '-'}
            </TableCell>

            <TableCell className="py-3.5">
                {duration ? (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                        <duration.icon className={`h-3.5 w-3.5 ${duration.color}`} />
                        <span>{duration.label}</span>
                    </div>
                ) : '-'}
            </TableCell>

            <TableCell className="py-3.5">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CalendarIcon className="h-3.5 w-3.5 text-emerald-500" />
                    <span>{lesson.classDate ? format(new Date(lesson.classDate), 'MMM dd, yyyy') : 'N/A'}</span>
                </div>
            </TableCell>

            {canManage && (
                <TableCell className="text-right py-3.5">
                    <div className="flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Edit lesson"
                            onClick={() => onEdit(lesson)}
                            className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-md"
                        >
                            <Edit3 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Delete lesson"
                            onClick={() => onDelete(lesson)}
                            className="h-8 w-8 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 rounded-md"
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                </TableCell>
            )}
        </TableRow>
    );
};

/** The family (teacher's view) or teacher (family's view) a lesson is with: icon, name, email. */
const PartyCell = ({ party, icon: Icon, fallback }: { party?: Partial<userType>; icon: LucideIcon; fallback: string }) => {
    const name = party?.name || fallback;
    return (
        <TableCell className="font-medium text-xs py-3.5">
            <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-md bg-primary/10 text-primary shrink-0">
                    <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="flex flex-col min-w-0">
                    <span className="font-semibold text-foreground truncate max-w-40" title={name}>
                        {name}
                    </span>
                    {party?.email && (
                        <span className="text-[11px] text-muted-foreground truncate max-w-40" title={party.email}>
                            {party.email}
                        </span>
                    )}
                </div>
            </div>
        </TableCell>
    );
};

export default LessonRow;
