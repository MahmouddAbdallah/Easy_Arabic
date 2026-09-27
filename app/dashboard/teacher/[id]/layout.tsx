import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BookOpen, Users, Award, Mail } from "lucide-react";
import TabsListTeacher from "@/components/dashboard/teacher/TabsListTeacher";
import { getUser } from "@/lib/data/users";
import { getMoney, getTeacherFamilies } from "@/lib/data/families";
import TeacherRateBadge from '@/components/dashboard/teacher/MoneyPerLessonView';

const RootLayout = async ({ children, params }: {
    params: Promise<{ id: string }>,
    children: React.ReactNode;
}) => {
    const { id } = await params;
    const { data } = await getUser(id,
        ['id', 'name', 'email', 'subject']
    );

    const totalFamilies = await getTeacherFamilies({
        filter: {
            where: [
                {
                    key: "teacherId",
                    value: id,
                }
            ],
            justCount: true
        }
    });

    const { money } = await getMoney(id);
    console.log(money);


    return (
        <div className="p-6 md:p-10 space-y-8 max-w-7xl mx-auto">
            {/* 1. Profile Header Section */}
            <Card className="border-border/60 bg-linear-to-r from-background to-muted/20">
                <CardContent className="p-6 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-4 text-left">
                        <Avatar className="h-20 w-20 border-2 border-primary/20 shadow-sm">
                            <AvatarImage src={data?.avatar} alt={data?.name} />
                            <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">
                                {data?.name?.slice(0, 2)}
                            </AvatarFallback>
                        </Avatar>

                        <div className="space-y-1.5">
                            <h1 className="text-2xl font-bold text-foreground">{data?.name}</h1>

                            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                                <p className="flex items-center gap-1.5">
                                    <Award className="h-4 w-4 text-primary" />
                                    {data?.subject} Teacher
                                </p>
                                <span className="text-border">•</span>
                                <p className="flex items-center gap-1.5">
                                    <Mail className="h-3.5 w-3.5" />
                                    {data?.email}
                                </p>
                            </div>

                            {/* Stylish Rate Badge Under Name/Info */}
                            <div className="pt-0.5">
                                <TeacherRateBadge
                                    teacherId={id}
                                    initialMoney={money as any}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Quick Stats */}
                    <div className="flex items-center gap-6 bg-background/80 p-4 rounded-xl border border-border/50 shadow-sm">
                        <div className="text-center px-2">
                            <div className="flex items-center justify-center gap-1.5 text-primary">
                                <Users className="h-4 w-4" />
                                <span className="text-xl font-bold">{totalFamilies?.count}</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">Families</p>
                        </div>
                        <div className="h-8 w-px bg-border/60" />
                        <div className="text-center px-2">
                            <div className="flex items-center justify-center gap-1.5 text-primary">
                                <BookOpen className="h-4 w-4" />
                                <span className="text-xl font-bold">{data?.totalLessons}</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">Lessons</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* 2. Tabs Section */}
            <TabsListTeacher
                totalLessons={100}
                totalStudents={totalFamilies.count}
            >
                {children}
            </TabsListTeacher>
        </div>
    );
};

export default RootLayout;