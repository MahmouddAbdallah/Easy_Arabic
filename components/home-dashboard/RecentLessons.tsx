import { BookOpen } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { STATUS_MAP, REWARD_MAP, DURATION_MAP } from '@/components/lesson/LessonOptions';
import type { RecentLessonRow } from '@/lib/data/dashboard';

export function formatWhen(classDate: string | Date) {
    const d = new Date(classDate);
    return d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
}

interface RecentLessonsProps {
    lessons: RecentLessonRow[];
    variant: 'admin' | 'teacher' | 'family';
    emptyHint: string;
}

export default function RecentLessons({ lessons, variant, emptyHint }: RecentLessonsProps) {
    return (
        <Card className="border-border/60">
            <CardHeader>
                <CardTitle>Recent Lessons</CardTitle>
            </CardHeader>
            <CardContent>
                {lessons.length === 0 ? (
                    <div className="flex flex-col items-center text-center gap-2 py-10">
                        <div className="p-3 rounded-full bg-muted text-muted-foreground">
                            <BookOpen className="h-5 w-5" />
                        </div>
                        <p className="text-sm font-semibold text-foreground">No lessons yet</p>
                        <p className="text-xs text-muted-foreground max-w-xs">{emptyHint}</p>
                    </div>
                ) : (
                    <ul className="divide-y divide-border/60">
                        {lessons.map((lesson) => {
                            const status = STATUS_MAP[lesson.status];
                            const reward = REWARD_MAP[lesson.TeacherReward];
                            const duration = DURATION_MAP[String(lesson.duration)];
                            const participant =
                                variant === 'admin'
                                    ? [lesson.teacher?.name, lesson.family?.name].filter(Boolean).join(' · ')
                                    : variant === 'teacher'
                                        ? lesson.family?.name
                                        : lesson.teacher?.name;

                            return (
                                <li key={lesson.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-foreground truncate">
                                            {lesson.student ?? 'Student'}
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                            {[participant, duration?.label ?? `${lesson.duration} min`, formatWhen(lesson.classDate)]
                                                .filter(Boolean)
                                                .join(' · ')}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        {status && (
                                            <span className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-bold ${status.color}`}>
                                                <status.icon className="h-3 w-3" />
                                                <span className="hidden sm:inline">{status.label}</span>
                                            </span>
                                        )}
                                        {status?.value === 'ATTENDED' && reward && (
                                            <span className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-bold ${reward.color}`}>
                                                <reward.icon className="h-3 w-3" />
                                                <span className="hidden sm:inline">{reward.label}</span>
                                            </span>
                                        )}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </CardContent>
        </Card>
    );
}
