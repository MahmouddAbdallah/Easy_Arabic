import { useEffect, useState } from 'react';
import { LessonItem } from '@/types/lessonTypes';
import { useLessonStore } from '@/stores/lessons';

/**
 * The lessons the table shows. LessonForm and DeleteLesson change lessons through
 * the zustand store, so once the server's page has been copied into it the store is
 * the source of truth. Until then (the first paint, and the moment new pages arrive)
 * the server's rows are shown directly, so the table never flashes "No lessons found"
 * or the previous page's rows.
 */
export function useSyncedLessons(data: LessonItem[], count: number) {
    const setLessons = useLessonStore((state) => state.setLessons);
    const setCount = useLessonStore((state) => state.setCount);
    const storedLessons = useLessonStore((state) => state.lessons);
    const storedCount = useLessonStore((state) => state.count);

    const [syncedFrom, setSyncedFrom] = useState<LessonItem[] | null>(null);

    useEffect(() => {
        setLessons(data);
        setCount(count);
        setSyncedFrom(data);
    }, [setLessons, setCount, data, count]);

    const isSynced = syncedFrom === data;
    return {
        lessons: isSynced ? storedLessons : data,
        total: isSynced ? storedCount : count,
    };
}
