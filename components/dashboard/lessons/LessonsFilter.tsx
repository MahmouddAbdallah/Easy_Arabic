'use client';

import React, { useState } from 'react';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Search, SlidersHorizontal, RotateCcw, CalendarIcon, DollarSign, Clock, ChevronDown, Award, Timer, Filter } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { format } from "date-fns";
import { useRouter, useSearchParams } from 'next/navigation';
import { DURATION_OPTIONS, REWARD_OPTIONS, STATUS_OPTIONS } from '@/components/lesson/LessonOptions';


interface FilterFormValues {
  search: string;
  status: string;
  teacherReward: string;
  duration: string;
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  minAmount: string;
  maxAmount: string;
}

export const LessonsFilter = () => {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  const { register, control, reset, handleSubmit } = useForm<FilterFormValues>({
    defaultValues: {
      search: '',
      status: 'ALL',
      teacherReward: 'ALL',
      duration: 'ALL',
      dateFrom: undefined,
      dateTo: undefined,
      minAmount: '',
      maxAmount: '',
    },
  });

  const dateFromValue = useWatch({ name: 'dateFrom', control });

  const onSubmit = handleSubmit((data) => {
    const params = new URLSearchParams(searchParams.toString());

    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '' && value !== 'ALL') {
        if (value instanceof Date) {
        } else {
          params.set(key, String(value));
        }
      } else {
        params.delete(key);
      }
    });

    router.push(`?${params.toString()}`);
  });

  const handleReset = () => {
    reset();
    router.push(window.location.pathname);
  };
  return (
    <form onSubmit={onSubmit}>
      <Card className="border border-border/80 shadow-sm mb-6 overflow-hidden rounded-lg bg-card transition-all duration-200 hover:border-border">
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <div className="p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3">

            <div className="relative flex-1 min-w-60">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                {...register('search')}
                placeholder="Search student, teacher, or family..."
                className="pl-9 h-9 text-xs bg-muted/30 focus-visible:bg-background border-border/70 focus-visible:border-primary rounded-md shadow-none transition-all"
              />
            </div>

            <CollapsibleTrigger >
              <Button
                type="button"
                variant={isOpen ? "secondary" : "outline"}
                size="sm"
                className={`h-9 text-xs font-medium gap-2 border-border/70 rounded-md transition-all ${isOpen ? 'bg-secondary font-semibold border-border' : 'hover:bg-muted/50'
                  }`}
              >
                <SlidersHorizontal className="h-3.5 w-3.5 text-primary" />
                <span>Filters</span>
                <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
          </div>

          <CollapsibleContent className="transition-all data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
            <CardContent className="p-4 sm:p-5 pt-3 border-t border-border/70 bg-muted/10 space-y-4">

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">

                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-foreground/80 flex items-center gap-1.5 px-0.5">
                    <Clock className="h-3.5 w-3.5 text-blue-500" /> Status
                  </label>
                  <Controller
                    name="status"
                    control={control}
                    render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger className="w-full h-9 text-xs bg-background border-border/70 rounded-md shadow-xs">
                          <SelectValue placeholder="All Statuses" />
                        </SelectTrigger>
                        <SelectContent className="rounded-md border-border/80">
                          <SelectItem value="ALL" className="text-xs font-medium">All Statuses</SelectItem>
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
                    )}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-foreground/80 flex items-center gap-1.5 px-0.5">
                    <Award className="h-3.5 w-3.5 text-amber-500" /> Teacher Reward
                  </label>
                  <Controller
                    name="teacherReward"
                    control={control}
                    render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger className="w-full h-9 text-xs bg-background border-border/70 rounded-md shadow-xs">
                          <SelectValue placeholder="All Rewards" />
                        </SelectTrigger>
                        <SelectContent className="rounded-md border-border/80 max-h-60">
                          <SelectItem value="ALL" className="text-xs font-medium">All Rewards</SelectItem>
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
                    )}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-foreground/80 flex items-center gap-1.5 px-0.5">
                    <Timer className="h-3.5 w-3.5 text-indigo-500" /> Duration
                  </label>
                  <Controller
                    name="duration"
                    control={control}
                    render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger className="w-full h-9 text-xs bg-background border-border/70 rounded-md shadow-xs">
                          <SelectValue placeholder="All Durations" />
                        </SelectTrigger>
                        <SelectContent className="rounded-md border-border/80">
                          <SelectItem value="ALL" className="text-xs font-medium">All Durations</SelectItem>
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
                    )}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-border/70">

                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-foreground/80 flex items-center gap-1.5 px-0.5">
                    <CalendarIcon className="h-3.5 w-3.5 text-emerald-500" /> Date From
                  </label>
                  <Controller
                    name="dateFrom"
                    control={control}
                    render={({ field }) => (
                      <Popover>
                        <PopoverTrigger className={'w-full'}>
                          <Button
                            variant="outline"
                            size="sm"
                            className={`w-full h-9 justify-start text-left font-normal text-xs bg-background border-border/70 rounded-md px-3 ${!field.value && "text-muted-foreground"
                              }`}
                          >
                            <CalendarIcon className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                            {field.value ? format(field.value, "PPP") : <span>From Date</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 rounded-md border-border/80" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            className="p-3"
                          />
                        </PopoverContent>
                      </Popover>
                    )}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-foreground/80 flex items-center gap-1.5 px-0.5">
                    <CalendarIcon className="h-3.5 w-3.5 text-emerald-500" /> Date To
                  </label>
                  <Controller
                    name="dateTo"
                    control={control}
                    render={({ field }) => (
                      <Popover>
                        <PopoverTrigger className={'w-full'}>
                          <Button
                            variant="outline"
                            size="sm"
                            className={`w-full h-9 justify-start text-left font-normal text-xs bg-background border-border/70 rounded-md px-3 ${!field.value && "text-muted-foreground"
                              }`}
                          >
                            <CalendarIcon className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                            {field.value ? format(field.value, "PPP") : <span>To Date</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 rounded-md border-border/80" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) => dateFromValue ? date < dateFromValue : false}
                            className="p-3"
                          />
                        </PopoverContent>
                      </Popover>
                    )}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-foreground/80 flex items-center gap-1.5 px-0.5">
                    <DollarSign className="h-3.5 w-3.5 text-emerald-500" /> Min Amount
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      type="number"
                      placeholder="0"
                      {...register('minAmount')}
                      className="pl-8 w-full h-9 text-xs bg-background border-border/70 focus-visible:border-primary rounded-md"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-foreground/80 flex items-center gap-1.5 px-0.5">
                    <DollarSign className="h-3.5 w-3.5 text-emerald-500" /> Max Amount
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      type="number"
                      placeholder="Max"
                      {...register('maxAmount')}
                      className="pl-8 w-full h-9 text-xs bg-background border-border/70 focus-visible:border-primary rounded-md"
                    />
                  </div>
                </div>

              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/70">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 text-xs font-medium gap-1.5 border-border/70 rounded-md px-3.5 hover:bg-muted"
                  onClick={handleReset}
                >
                  <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Reset</span>
                </Button>

                <Button
                  type="submit"
                  size="sm"
                  className="h-9 text-xs font-medium gap-1.5 rounded-md px-4 bg-primary text-primary-foreground shadow-xs hover:bg-primary/90"
                >
                  <Filter className="h-3.5 w-3.5" />
                  <span>Apply Filters</span>
                </Button>
              </div>

            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    </form>
  );
};

/**
 * 'use client';
 
 import { useState, useEffect } from 'react';
 import { useForm, Controller, useWatch } from 'react-hook-form';
 import { Card } from "@/components/ui/card";
 import { Input } from "@/components/ui/input";
 import { Button } from "@/components/ui/button";
 import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
 import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
 import { Calendar } from "@/components/ui/calendar";
 import { RotateCcw, CalendarIcon, DollarSign, Clock, ChevronDown, Award, Timer, Filter, SlidersHorizontal } from "lucide-react";
 import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
 import { format } from "date-fns";
 import { useRouter, useSearchParams, usePathname } from 'next/navigation';
 import { DURATION_OPTIONS, REWARD_OPTIONS, STATUS_OPTIONS } from './LessonOptions';
 
 interface FilterFormValues {
   status: string;
   teacherReward: string;
   duration: string;
   dateFrom: Date | undefined;
   dateTo: Date | undefined;
   minAmount: string;
   maxAmount: string;
 }
 
 const EMPTY_VALUES: FilterFormValues = {
   status: 'ALL',
   teacherReward: 'ALL',
   duration: 'ALL',
   dateFrom: undefined,
   dateTo: undefined,
   minAmount: '',
   maxAmount: '',
 };
 
 export const LessonsFilter = () => {
   const router = useRouter();
   const pathname = usePathname();
   const searchParams = useSearchParams();
 
   // تحويل التواريخ من الـ URL إن وجدت
   const urlDateFrom = searchParams.get('dateFrom');
   const urlDateTo = searchParams.get('dateTo');
 
   const { register, control, reset, handleSubmit, formState: { isDirty } } = useForm<FilterFormValues>({
     defaultValues: {
       status: searchParams.get('status') || 'ALL',
       teacherReward: searchParams.get('teacherReward') || 'ALL',
       duration: searchParams.get('duration') || 'ALL',
       dateFrom: urlDateFrom ? new Date(urlDateFrom) : undefined,
       dateTo: urlDateTo ? new Date(urlDateTo) : undefined,
       minAmount: searchParams.get('minAmount') || '',
       maxAmount: searchParams.get('maxAmount') || '',
     },
   });
 
   // إعادة مزامنة قيم الـ Form مع تغيرات الـ searchParams (عند الـ Reset أو التصفح للخلف/الأمام)
   useEffect(() => {
     const from = searchParams.get('dateFrom');
     const to = searchParams.get('dateTo');
 
     reset({
       status: searchParams.get('status') || 'ALL',
       teacherReward: searchParams.get('teacherReward') || 'ALL',
       duration: searchParams.get('duration') || 'ALL',
       dateFrom: from ? new Date(from) : undefined,
       dateTo: to ? new Date(to) : undefined,
       minAmount: searchParams.get('minAmount') || '',
       maxAmount: searchParams.get('maxAmount') || '',
     });
   }, [searchParams, reset]);
 
   const formValues = useWatch({ control });
 
   // فحص إذا كانت الفلاتر المتقدمة (الخاصة بالـ Collapsible) موجودة سواء بالـ URL أو بالـ Form
   const hasAdvancedFilters = Boolean(
     searchParams.get('dateFrom') ||
     searchParams.get('dateTo') ||
     searchParams.get('minAmount') ||
     searchParams.get('maxAmount') ||
     formValues.dateFrom ||
     formValues.dateTo ||
     (formValues.minAmount && formValues.minAmount !== '') ||
     (formValues.maxAmount && formValues.maxAmount !== '')
   );
 
   // حالة الـ Collapsible - يفتح افتراضياً لو فيه فلاتر متقدمة بالـ URL
   const [isOpen, setIsOpen] = useState(hasAdvancedFilters);
 
   // تحديث حالة الفتح تلقائياً عند وجود فلاتر متقدمة
   useEffect(() => {
     if (hasAdvancedFilters) {
       setIsOpen(true);
     }
   }, [hasAdvancedFilters]);
 
   // فحص وجود أي فلاتر نشطة
   const hasActiveFilters = Boolean(
     (formValues.status && formValues.status !== 'ALL') ||
     (formValues.teacherReward && formValues.teacherReward !== 'ALL') ||
     (formValues.duration && formValues.duration !== 'ALL') ||
     hasAdvancedFilters ||
     searchParams.toString() !== ''
   );
 
   const dateFromValue = formValues.dateFrom;
   const showActionBar = isDirty || hasActiveFilters;
 
   const onSubmit = handleSubmit((data) => {
     const params = new URLSearchParams();
 
     Object.entries(data).forEach(([key, value]) => {
       if (value !== undefined && value !== null && value !== '' && value !== 'ALL') {
         if (value instanceof Date) {
           params.set(key, value.toISOString());
         } else {
           params.set(key, String(value));
         }
       }
     });
 
     router.push(`?${params.toString()}`);
   });
 
   const handleReset = () => {
     // 1. ترجيع قيم الـ Form للصفر فوراً
     reset(EMPTY_VALUES);
     // 2. تفريغ الـ URL
     router.push(pathname);
   };
 
   return (
     <form onSubmit={onSubmit} className="relative mb-4">
 
       <Card className="border border-border/80 shadow-xs rounded-lg bg-card transition-all">
         <Collapsible open={isOpen} onOpenChange={setIsOpen}>
 
           <div className="p-3 flex items-end gap-2.5">
 
             <div className="space-y-1 flex-1">
               <label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                 <Clock className="h-3 w-3 text-blue-500" /> Status
               </label>
               <Controller
                 name="status"
                 control={control}
                 render={({ field }) => (
                   <Select onValueChange={field.onChange} value={field.value || 'ALL'}>
                     <SelectTrigger className="w-full h-8 text-xs bg-background border-border/70 rounded-md">
                       <SelectValue placeholder="All Statuses" />
                     </SelectTrigger>
                     <SelectContent className="rounded-md border-border/80">
                       <SelectItem value="ALL" className="text-xs font-medium">All Statuses</SelectItem>
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
                 )}
               />
             </div>
 
             <div className="space-y-1 flex-1">
               <label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                 <Award className="h-3 w-3 text-amber-500" /> Teacher Reward
               </label>
               <Controller
                 name="teacherReward"
                 control={control}
                 render={({ field }) => (
                   <Select onValueChange={field.onChange} value={field.value || 'ALL'}>
                     <SelectTrigger className="w-full h-8 text-xs bg-background border-border/70 rounded-md">
                       <SelectValue placeholder="All Rewards" />
                     </SelectTrigger>
                     <SelectContent className="rounded-md border-border/80 max-h-60">
                       <SelectItem value="ALL" className="text-xs font-medium">All Rewards</SelectItem>
                       {REWARD_OPTIONS.map((reward) => {
                         const Icon = reward.icon;
                         return (
                           <SelectItem key={reward.value} value={reward.value} className="text-xs py-1.5">
                             <div className="flex items-center gap-2">
                               <div className={`p-1 rounded ${reward.color}`}>
                                 <Icon className="h-3 w-3" />
                               </div>
                               <span className="font-medium">{reward.label}</span>
                             </div>
                           </SelectItem>
                         );
                       })}
                     </SelectContent>
                   </Select>
                 )}
               />
             </div>
 
             <div className="space-y-1 flex-1">
               <label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                 <Timer className="h-3 w-3 text-indigo-500" /> Duration
               </label>
               <Controller
                 name="duration"
                 control={control}
                 render={({ field }) => (
                   <Select onValueChange={field.onChange} value={field.value || 'ALL'}>
                     <SelectTrigger className="w-full h-8 text-xs bg-background border-border/70 rounded-md">
                       <SelectValue placeholder="All Durations" />
                     </SelectTrigger>
                     <SelectContent className="rounded-md border-border/80">
                       <SelectItem value="ALL" className="text-xs font-medium">All Durations</SelectItem>
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
                 )}
               />
             </div>
 
             <CollapsibleTrigger >
               <Button
                 type="button"
                 variant={isOpen ? "secondary" : "outline"}
                 size="sm"
                 className="h-8 mb-1 px-2.5 text-xs font-medium gap-1 border-border/70 rounded-md shrink-0"
                 title="More filters"
               >
                 <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                 <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
               </Button>
             </CollapsibleTrigger>
 
           </div>
 
           <CollapsibleContent className="transition-all data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
             <div className="p-3 pt-2 border-t border-border/60 bg-muted/20">
               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
 
                 <div className="space-y-1">
                   <label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                     <CalendarIcon className="h-3 w-3 text-emerald-500" /> Date From
                   </label>
                   <Controller
                     name="dateFrom"
                     control={control}
                     render={({ field }) => (
                       <Popover>
                         <PopoverTrigger >
                           <Button
                             variant="outline"
                             size="sm"
                             className={`w-full h-8 justify-start text-left font-normal text-xs bg-background border-border/70 rounded-md px-2.5 ${!field.value && "text-muted-foreground"}`}
                           >
                             <CalendarIcon className="mr-1.5 h-3 w-3 text-muted-foreground" />
                             {field.value ? format(field.value, "PP") : <span>From Date</span>}
                           </Button>
                         </PopoverTrigger>
                         <PopoverContent className="w-auto p-0 rounded-md border-border/80" align="start">
                           <Calendar
                             mode="single"
                             selected={field.value}
                             onSelect={field.onChange}
                             className="p-2"
                           />
                         </PopoverContent>
                       </Popover>
                     )}
                   />
                 </div>
 
                 <div className="space-y-1">
                   <label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                     <CalendarIcon className="h-3 w-3 text-emerald-500" /> Date To
                   </label>
                   <Controller
                     name="dateTo"
                     control={control}
                     render={({ field }) => (
                       <Popover>
                         <PopoverTrigger >
                           <Button
                             variant="outline"
                             size="sm"
                             className={`w-full h-8 justify-start text-left font-normal text-xs bg-background border-border/70 rounded-md px-2.5 ${!field.value && "text-muted-foreground"}`}
                           >
                             <CalendarIcon className="mr-1.5 h-3 w-3 text-muted-foreground" />
                             {field.value ? format(field.value, "PP") : <span>To Date</span>}
                           </Button>
                         </PopoverTrigger>
                         <PopoverContent className="w-auto p-0 rounded-md border-border/80" align="start">
                           <Calendar
                             mode="single"
                             selected={field.value}
                             onSelect={field.onChange}
                             disabled={(date) => dateFromValue ? date < dateFromValue : false}
                             className="p-2"
                           />
                         </PopoverContent>
                       </Popover>
                     )}
                   />
                 </div>
 
                 <div className="space-y-1">
                   <label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                     <DollarSign className="h-3 w-3 text-emerald-500" /> Min Amount
                   </label>
                   <div className="relative">
                     <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                     <Input
                       type="number"
                       placeholder="0"
                       {...register('minAmount')}
                       className="pl-7 w-full h-8 text-xs bg-background border-border/70 rounded-md"
                     />
                   </div>
                 </div>
 
                 <div className="space-y-1">
                   <label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                     <DollarSign className="h-3 w-3 text-emerald-500" /> Max Amount
                   </label>
                   <div className="relative">
                     <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                     <Input
                       type="number"
                       placeholder="Max"
                       {...register('maxAmount')}
                       className="pl-7 w-full h-8 text-xs bg-background border-border/70 rounded-md"
                     />
                   </div>
                 </div>
 
               </div>
             </div>
           </CollapsibleContent>
 
         </Collapsible>
       </Card>
 
       <div
         className={`grid transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${showActionBar
           ? 'grid-rows-[1fr] opacity-100 translate-y-0 mt-2'
           : 'grid-rows-[0fr] opacity-0 -translate-y-2 pointer-events-none mt-0'
           }`}
       >
         <div className="overflow-hidden">
           <div className="flex items-center justify-between bg-card border border-border/80 shadow-xs rounded-md px-3 py-1.5">
             <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
               <Filter className="h-3 w-3 text-primary" /> Active Filters Pending
             </span>
             <div className="flex items-center gap-2">
               {hasActiveFilters && (
                 <Button
                   type="button"
                   variant="ghost"
                   size="sm"
                   className="h-7 px-2 text-[11px] font-medium hover:bg-muted text-muted-foreground rounded-md gap-1 transition-colors"
                   onClick={handleReset}
                 >
                   <RotateCcw className="h-3 w-3" />
                   <span>Reset</span>
                 </Button>
               )}
 
               {isDirty && (
                 <Button
                   type="submit"
                   size="sm"
                   className="h-7 text-[11px] font-medium gap-1 rounded-md px-3 bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 transition-transform active:scale-95"
                 >
                   <Filter className="h-3 w-3" />
                   <span>Apply Filter</span>
                 </Button>
               )}
             </div>
           </div>
         </div>
       </div>
 
     </form>
   );
 };
 */