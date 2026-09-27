'use client';

import React, { useState } from 'react';
import { useForm, Controller, FormProvider } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Calendar as CalendarIcon, Clock, Award, Timer, Save, PlusCircle, Edit3, Loader2Icon } from "lucide-react";
import { format, startOfDay, subDays } from "date-fns";
import { clsx } from 'clsx';
import SelectFamilies from './SelectFamilies';
import ErrorMsg from '../ErrorMsg';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAppContext } from '../AppContext';
import { DURATION_OPTIONS, REWARD_OPTIONS, STATUS_OPTIONS } from './LessonOptions';
import { LessonItem } from '@/types/lessonTypes';
import { useLessonStore } from '@/stores/lessons';


export interface LessonFormValues {
    student: string;
    familyId: string;
    status: string;
    TeacherReward: string;
    duration: string;
    classDate: Date | undefined;
}

interface LessonFormProps {
    initialData?: Partial<LessonItem>;
    isEditing?: boolean;
    view?: 'VERTICAL' | 'HORIZONTAL',
    setOpen?: React.Dispatch<React.SetStateAction<boolean>>
}

const LessonForm: React.FC<LessonFormProps> = ({
    initialData,
    isEditing = false,
    view = 'HORIZONTAL',
    setOpen
}) => {
    const [isLoading, setIsLoading] = useState(false);
    const method = useForm<LessonFormValues>({
        defaultValues: initialData ? {
            familyId: initialData?.family?.id || '',
            student: initialData?.student || '',
            status: initialData?.status || '',
            TeacherReward: initialData?.TeacherReward || '',
            duration: initialData?.duration || '',
            classDate: new Date(initialData?.classDate as any) || undefined,
        } : {},
    });

    const { control, handleSubmit, formState: { errors }, reset } = method;

    const { user } = useAppContext();
    const updateLesson = useLessonStore(state => state.updateLesson);

    const onSubmit = handleSubmit(async (formData) => {
        try {
            setIsLoading(true);
            if (initialData && setOpen) {
                await axios.patch(`/api/teacher/${user?.id}/lesson/${initialData?.id}`, formData, {
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    }
                });
                updateLesson(initialData?.id as string, formData)
                toast.success('Update the lesson successfully');
                setOpen(false)
            }
            else {
                await axios.post(`/api/teacher/${user?.id}/lesson`, formData, {
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    }
                });
                reset();
                toast.success('Create new lesson successfully');

            }
        } catch (error: any) {
            toast.error(error?.response?.data?.error?.message || error?.response?.data?.message || 'Something went wrong');
        } finally {
            setIsLoading(false);
        }
    });

    return (
        <Card className={clsx(
            " rounded-lg bg-card",
            initialData ? 'w-full ring-0' : ' max-w-3xl mx-auto border border-border/80 shadow-sm',

        )}>
            <CardHeader className="border-b border-border/70 pb-4">
                <div className="flex items-center gap-2">
                    {isEditing ? (
                        <Edit3 className="h-5 w-5 text-primary" />
                    ) : (
                        <PlusCircle className="h-5 w-5 text-primary" />
                    )}
                    <div>
                        <CardTitle className="text-base font-semibold">
                            {isEditing ? 'Update Lesson' : 'Create New Lesson'}
                        </CardTitle>
                        <CardDescription className="text-xs">
                            {isEditing
                                ? 'Modify the details of the existing lesson.'
                                : 'Fill in the information below to schedule a new lesson.'}
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="py-5 sm:py-6">
                <FormProvider {...method}>
                    <form onSubmit={onSubmit} className="space-y-5">

                        <SelectFamilies />
                        <div className="space-y-1.5">
                            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                Lesson Details
                            </h3>
                            <div className={clsx(view === 'HORIZONTAL' ? "grid grid-cols-1 sm:grid-cols-3 gap-3" : '')}>

                                {/* Status Field */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium flex items-center gap-1.5">
                                        <Clock className="h-3.5 w-3.5 text-blue-500" /> Status
                                    </label>
                                    <Controller
                                        name="status"
                                        control={control}
                                        rules={{ required: 'Please select status' }}
                                        render={({ field }) => {
                                            const item = STATUS_OPTIONS.find((i => i.value == field.value));
                                            const Icon = item?.icon
                                            return (
                                                <Select onValueChange={field.onChange} value={field.value}>
                                                    <SelectTrigger className="w-full h-9 text-xs bg-background border-border/70 rounded-md">
                                                        <SelectValue >
                                                            {item ? <div className="flex items-center gap-2">
                                                                {Icon && <Icon className={`h-3.5 w-3.5 ${item?.color}`} />}
                                                                <span>{item?.label}</span>
                                                            </div>
                                                                : "Choose the Status"
                                                            }
                                                        </SelectValue>
                                                    </SelectTrigger>
                                                    <SelectContent className="rounded-md border-border/80">
                                                        {STATUS_OPTIONS.map((item) => {
                                                            const Icon = item.icon;
                                                            return (
                                                                <SelectItem key={item.value} value={item.value} className="text-xs">
                                                                    <div className="flex items-center gap-2">
                                                                        <Icon className={`h-3.5 w-3.5 ${item.color}`} />
                                                                        <span>{item.label}</span>
                                                                    </div>
                                                                </SelectItem>
                                                            );
                                                        })}
                                                    </SelectContent>
                                                </Select>
                                            )
                                        }}
                                    />
                                    <ErrorMsg message={errors.status?.message} />
                                </div>

                                {/* Teacher Reward Field */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium flex items-center gap-1.5">
                                        <Award className="h-3.5 w-3.5 text-amber-500" /> Teacher Reward
                                    </label>
                                    <Controller
                                        name="TeacherReward"
                                        control={control}
                                        rules={{ required: 'Please select reward' }}
                                        render={({ field }) => {
                                            const item = REWARD_OPTIONS.find((i => i.value == field.value));
                                            const Icon = item?.icon
                                            return (
                                                <Select onValueChange={field.onChange} value={field.value}>
                                                    <SelectTrigger className="w-full h-9 text-xs bg-background border-border/70 rounded-md">
                                                        <SelectValue>
                                                            {item ? <div className="flex items-center gap-2">
                                                                {Icon && <Icon className={`h-3.5 w-3.5 ${item?.color}`} />}
                                                                <span>{item?.label}</span>
                                                            </div>
                                                                : "Choose the Reward"
                                                            }
                                                        </SelectValue>
                                                    </SelectTrigger>
                                                    <SelectContent className="rounded-md border-border/80 max-h-60">
                                                        {REWARD_OPTIONS.map((reward) => {
                                                            const Icon = reward.icon;
                                                            return (
                                                                <SelectItem key={reward.value} value={reward.value} className="text-xs py-1.5">
                                                                    <div className="flex items-center gap-2">
                                                                        <div className={`p-1 rounded ${reward.color}`}>
                                                                            <Icon className="h-3.5 w-3.5" />
                                                                        </div>
                                                                        <span className="font-medium">{reward.label}</span>
                                                                    </div>
                                                                </SelectItem>
                                                            );
                                                        })}
                                                    </SelectContent>
                                                </Select>
                                            )
                                        }}
                                    />
                                    <ErrorMsg message={errors.TeacherReward?.message} />
                                </div>

                                {/* duration Field */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium flex items-center gap-1.5">
                                        <Timer className="h-3.5 w-3.5 text-indigo-500" /> duration
                                    </label>
                                    <Controller
                                        name="duration"
                                        control={control}
                                        rules={{ required: 'Please select duration' }}
                                        render={({ field }) => {
                                            const item = DURATION_OPTIONS.find((i => i.value == field.value));
                                            const Icon = item?.icon
                                            return (
                                                <Select onValueChange={field.onChange} value={field.value}>
                                                    <SelectTrigger className="w-full h-9 text-xs bg-background border-border/70 rounded-md">
                                                        <SelectValue  >
                                                            {item ? <div className="flex items-center gap-2">
                                                                {Icon && <Icon className={`h-3.5 w-3.5 ${item?.color}`} />}
                                                                <span>{item?.label}</span>
                                                            </div>
                                                                : "Choose the duration"
                                                            }
                                                        </SelectValue>
                                                    </SelectTrigger>
                                                    <SelectContent className="rounded-md border-border/80">
                                                        {DURATION_OPTIONS.map((item) => {
                                                            const Icon = item.icon;
                                                            return (
                                                                <SelectItem key={item.value} value={item.value} className="text-xs">
                                                                    <div className="flex items-center gap-2">
                                                                        <Icon className={`h-3.5 w-3.5 ${item.color}`} />
                                                                        <span>{item.label}</span>
                                                                    </div>
                                                                </SelectItem>
                                                            );
                                                        })}
                                                    </SelectContent>
                                                </Select>
                                            )
                                        }}
                                    />
                                    <ErrorMsg message={errors.duration?.message} />
                                </div>
                            </div>
                        </div>
                        <div className="border-t border-border/60 my-4" />

                        <div className="space-y-1.5">
                            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                Schedule
                            </h3>
                            <div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium flex items-center gap-1.5">
                                        <CalendarIcon className="h-3.5 w-3.5 text-emerald-500" /> Lesson Date
                                    </label>
                                    <Controller
                                        name="classDate"
                                        control={control}
                                        rules={{
                                            required: 'Please select a date',
                                            validate: (value) => {
                                                if (!value) return true;

                                                const today = startOfDay(new Date());
                                                const selectedDate = startOfDay(new Date(value));
                                                const threeDaysAgo = subDays(today, 3);

                                                if (selectedDate < threeDaysAgo) {
                                                    return 'Invalid date. You cannot select a date older than 3 days.';
                                                }

                                                return true;
                                            }
                                        }}
                                        render={({ field }) => (
                                            <Popover>
                                                <PopoverTrigger className={'w-full'}>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className={`w-full h-9 justify-start text-left font-normal text-xs bg-background border-border/70 rounded-md px-3 ${!field.value && "text-muted-foreground"}`}
                                                    >
                                                        <CalendarIcon className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                                                        {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-0 rounded-md border-border/80" align="start">
                                                    <Calendar
                                                        mode="single"
                                                        selected={field.value}
                                                        onSelect={field.onChange}
                                                        disabled={(date) => startOfDay(date) < subDays(startOfDay(new Date()), 3)}
                                                        className="p-3"
                                                    />
                                                </PopoverContent>
                                            </Popover>
                                        )}
                                    />
                                </div>
                                <ErrorMsg message={errors.classDate?.message} />
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-4 border-t border-border/70">
                            {setOpen && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => { setOpen(false) }}
                                    disabled={isLoading}
                                    className="h-9 text-xs font-medium border-border/70 rounded-md px-4"
                                >
                                    Cancel
                                </Button>
                            )}

                            <Button
                                type="submit"
                                size="sm"
                                disabled={isLoading}
                                className="h-9 text-xs font-medium gap-1.5 rounded-md px-5 bg-primary text-primary-foreground shadow-xs hover:bg-primary/90"
                            >
                                {
                                    isLoading ? <Loader2Icon className="h-3.5 w-3.5 animate-spin" /> :
                                        <Save className="h-3.5 w-3.5" />
                                }
                                <span>{isEditing ? 'Update Lesson' : 'Create Lesson'}</span>
                            </Button>
                        </div>

                    </form>
                </FormProvider>
            </CardContent>
        </Card>
    );
};

export default LessonForm;