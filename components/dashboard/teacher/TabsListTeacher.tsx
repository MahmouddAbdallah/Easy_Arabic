'use client'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BookOpen, Users } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import React from 'react'

const StudentsTrigger = ({ children, totalStudents, totalLessons }: {
    children: React.ReactNode,
    totalStudents: number,
    totalLessons: number
}) => {
    const { push } = useRouter();
    const pathname = usePathname();

    const basePath = pathname.endsWith('/students')
        ? pathname.replace(/\/students$/, '')
        : pathname;

    const activeValue = pathname.endsWith('/students') ? 'students' : 'lessons';

    return (
        <Tabs defaultValue={activeValue} className="space-y-6">
            <TabsList className="bg-muted/50 p-1 border border-border/60">
                <TabsTrigger
                    onClick={() => push(basePath)}
                    value="lessons"
                    className="flex items-center gap-2"
                >
                    <BookOpen className="h-4 w-4" />
                    Lessons ({totalLessons})
                </TabsTrigger>
                <TabsTrigger
                    onClick={() => push(`${basePath}/students`)}
                    value="students"
                    className="flex items-center gap-2"
                >
                    <Users className="h-4 w-4" />
                    Students ({totalStudents})
                </TabsTrigger>
            </TabsList>
            {children}
        </Tabs>
    )
}

export default StudentsTrigger