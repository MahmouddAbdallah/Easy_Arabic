'use client';

import { useState, useEffect } from 'react';
import { useForm, Controller, useWatch, FormProvider } from 'react-hook-form';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { RotateCcw, CalendarIcon, Clock, ChevronDown, Award, Timer, Filter, SlidersHorizontal } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { format } from "date-fns";
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { DURATION_OPTIONS, REWARD_OPTIONS, STATUS_OPTIONS } from './LessonOptions';
import SelectFamilies from './SelectFamilies';
import clsx from 'clsx';
import { useAppContext } from '../AppContext';

interface FilterFormValues {
  status: string;
  teacherReward: string;
  duration: string;
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  familyId: string | undefined;
}

const EMPTY_VALUES: FilterFormValues = {
  status: 'ALL',
  teacherReward: 'ALL',
  duration: 'ALL',
  dateFrom: undefined,
  dateTo: undefined,
  familyId: undefined,
};

export const LessonsFilter = () => {
  const { user } = useAppContext();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const urlDateFrom = searchParams.get('dateFrom');
  const urlDateTo = searchParams.get('dateTo');

  const urlFamilyId = searchParams.get('familyId');

  const method = useForm<FilterFormValues>({
    defaultValues: {
      status: searchParams.get('status') || 'ALL',
      teacherReward: searchParams.get('teacherReward') || 'ALL',
      duration: searchParams.get('duration') || 'ALL',
      dateFrom: urlDateFrom ? new Date(urlDateFrom) : undefined,
      dateTo: urlDateTo ? new Date(urlDateTo) : undefined,
      familyId: urlFamilyId || '',
    },
  });
  const { control, reset, handleSubmit, formState: { isDirty } } = method
  useEffect(() => {
    const from = searchParams.get('dateFrom');
    const to = searchParams.get('dateTo');
    reset({
      status: searchParams.get('status') || 'ALL',
      teacherReward: searchParams.get('teacherReward') || 'ALL',
      duration: searchParams.get('duration') || 'ALL',
      dateFrom: from ? new Date(from) : undefined,
      dateTo: to ? new Date(to) : undefined,
      familyId: urlFamilyId || '',
    });
  }, [searchParams, reset]);

  const formValues = useWatch({ control });

  const hasAdvancedFilters = Boolean(
    searchParams.get('dateFrom') ||
    searchParams.get('dateTo') ||
    searchParams.get('familyId') ||
    formValues.dateFrom ||
    formValues.dateTo
  );

  const [isOpen, setIsOpen] = useState(hasAdvancedFilters);

  useEffect(() => {
    if (hasAdvancedFilters) {
      setIsOpen(true);
    }
  }, [hasAdvancedFilters]);

  const hasActiveFilters = Boolean(
    (formValues.status && formValues.status !== 'ALL') ||
    (formValues.teacherReward && formValues.teacherReward !== 'ALL') ||
    (formValues.duration && formValues.duration !== 'ALL') ||
    hasAdvancedFilters
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
    reset(EMPTY_VALUES);
    router.push(pathname);
  };

  return (
    <FormProvider {...method}>
      <form onSubmit={onSubmit} className="relative mb-4">

        {/* Main Filter Card */}
        <Card className="border border-border/80 shadow-xs rounded-lg bg-card transition-all">
          <Collapsible open={isOpen} onOpenChange={setIsOpen}>

            {/* Main Controls Row */}
            <div className="p-3 flex items-end gap-2.5">

              {/* 1. Status */}
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

              {/* 2. Teacher Reward */}
              <div className="space-y-1 flex-1">
                <label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                  <Award className="h-3 w-3 text-amber-500" /> <span className='hidden md:block'>Teacher</span> Reward
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

              {/* 3. Duration */}
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

              {/* More Filters Icon Button */}
              <CollapsibleTrigger
                className={clsx(
                  "flex justify-center items-center border h-8 mb-1 px-2.5 text-xs font-medium gap-1 border-border/70 rounded-md shrink-0",
                )}
                title="More filters"
              >
                <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
              </CollapsibleTrigger>

            </div>

            {/* Collapsible Section for Additional Filters */}
            <CollapsibleContent className="transition-all data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
              <div className="p-3 pt-2 border-t border-border/60 bg-muted/20">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {/* Select Family */}
                  {
                    user?.role != 'family' &&
                    <SelectFamilies isFilter={true} />}
                  {/* Date From */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                      <CalendarIcon className="h-3 w-3 text-emerald-500" /> Date From
                    </label>
                    <Controller
                      name="dateFrom"
                      control={control}
                      render={({ field }) => (
                        <Popover>
                          <PopoverTrigger className={`flex justify-start items-center border w-full h-8 text-left font-normal text-xs bg-background border-border/70 rounded-md px-2.5 ${!field.value && "text-muted-foreground"}`} >
                            <CalendarIcon className="mr-1.5 h-3 w-3 text-muted-foreground" />
                            {field.value ? format(field.value, "PP") : <span>From Date</span>}
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

                  {/* Date To */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                      <CalendarIcon className="h-3 w-3 text-emerald-500" /> Date To
                    </label>
                    <Controller
                      name="dateTo"
                      control={control}
                      render={({ field }) => (
                        <Popover>
                          <PopoverTrigger className={`flex justify-start items-center border w-full h-8 text-left font-normal text-xs bg-background border-border/70 rounded-md px-2.5 ${!field.value && "text-muted-foreground"}`} >
                            <CalendarIcon className="mr-1.5 h-3 w-3 text-muted-foreground" />
                            {field.value ? format(field.value, "PP") : <span>To Date</span>}
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
                </div>
              </div>
            </CollapsibleContent>

          </Collapsible>
        </Card>

        {/* Smooth Animated Action Bar */}
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
    </FormProvider>
  );
};