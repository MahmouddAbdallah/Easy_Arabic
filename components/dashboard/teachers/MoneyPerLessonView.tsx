'use client';

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, } from "@/components/ui/dialog";
import { Banknote, Pencil, Check, DollarSign, Loader2Icon } from "lucide-react";
import { useForm } from 'react-hook-form';
import axios from 'axios';
import toast from 'react-hot-toast';

interface TeacherRateBadgeProps {
    teacherId: string;
    initialMoney?: {
        id: string;
        money: number
    };
}

export default function TeacherRateBadge({
    initialMoney = {
        id: '',
        money: 50
    },
    teacherId
}: TeacherRateBadgeProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [money, setMoney] = useState<number>(initialMoney.money == 0 ? 50 : initialMoney.money);
    const { handleSubmit, register, formState: { isSubmitting }, } = useForm({
        defaultValues: { money }
    });

    const onSubmit = handleSubmit(async (formData) => {
        try {
            const { data } = await axios.put(`/api/teacher/${teacherId}/add-money`, formData, {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            });
            setMoney(formData.money)
            setIsOpen(false)
            toast.success(data.message || 'update money successfully successfully');
        } catch (error: any) {
            toast.error(error?.response?.data?.error?.message || error?.response?.data?.message || 'Something went wrong');
        }
    })
    return (
        <>
            {/* Sleek Rate Badge */}
            <div
                onClick={() => {
                    setIsOpen(true);
                }}
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary hover:bg-primary/15 transition-all cursor-pointer group shadow-2xs"
                title="Click to edit rate"
            >
                <Banknote className="h-3.5 w-3.5" />
                <span className="text-xs font-semibold">
                    ${money} <span className="text-primary/70 font-normal">/ lesson</span>
                </span>
                <div className="h-3 w-px bg-primary/20 mx-0.5" />
                <Pencil className="h-3 w-3 opacity-60 group-hover:opacity-100 group-hover:scale-110 transition-all" />
            </div>

            {/* Edit Dialog */}
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="sm:max-w-95">
                    <DialogHeader>
                        <DialogTitle>Edit Rate Per Lesson</DialogTitle>
                        <DialogDescription>
                            Set the price per lesson for this teacher.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={onSubmit} className="space-y-4 pt-2">
                        <div className="space-y-2">
                            <Label htmlFor="rate-input" className="text-sm font-medium">
                                Amount per lesson ($)
                            </Label>
                            <div className="relative">
                                <Input
                                    id="rate-input"
                                    type="number"
                                    min="0"
                                    {...register('money')}
                                    placeholder="e.g. 50"
                                    className="pl-9 pr-3"
                                    required
                                />
                                <DollarSign className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => setIsOpen(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={isSubmitting}
                                className="gap-2"
                            >
                                {isSubmitting ?
                                    <Loader2Icon className="size-4 animate-spin" /> :
                                    <Check className="size-4" />
                                }
                                <span>Save</span>
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}