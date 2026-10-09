'use client'

import { useId, useState } from 'react'
import { format, startOfDay } from 'date-fns'
import { Calendar as CalendarIcon, Clock } from 'lucide-react'
import { Calendar } from '@/components/ui/calendar'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from 'cn'
import { MAX_HORIZON_DAYS } from '@/lib/planner/constants'
import { combineDayAndTime, MS_DAY, toTimeInputValue } from '@/lib/planner/time'

/** A calendar day plus an "HH:mm" time, in the viewer's own time zone. */
export type DateTimeValue = { date: Date | undefined; time: string }

/** The instant this value means, or null while it is incomplete. */
export const toInstant = (value: DateTimeValue): Date | null => (value.date ? combineDayAndTime(value.date, value.time) : null)

export const fromInstant = (date: Date): DateTimeValue => ({ date: startOfDay(date), time: toTimeInputValue(date) })

/** A reason this value can't be booked, or null. (The server checks again; this is only so the form can say it first.) */
export function dateTimeProblem(value: DateTimeValue, now = Date.now()): string | null {
    if (!value.date) return 'Choose a date.'
    const at = toInstant(value)
    if (!at) return 'Enter a valid time.'
    if (at.getTime() <= now) return 'Choose a time in the future.'
    if (at.getTime() > now + MAX_HORIZON_DAYS * MS_DAY) return 'Choose a date within the next year.'
    return null
}

interface DateTimeFieldsProps {
    value: DateTimeValue
    onChange: (next: DateTimeValue) => void
    dateLabel?: string
    timeLabel?: string
    disabled?: boolean
    invalid?: boolean
}

/** Date (shadcn Calendar in a Popover) + time (native time input, 5-minute steps). */
const DateTimeFields = ({ value, onChange, dateLabel = 'Date', timeLabel = 'Start time', disabled, invalid }: DateTimeFieldsProps) => {
    const id = useId()
    const [open, setOpen] = useState(false)

    return (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
                <Label htmlFor={`${id}-date`} className="text-xs font-medium">
                    <CalendarIcon className="size-3.5 text-emerald-500" aria-hidden /> {dateLabel}
                </Label>
                <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger
                        id={`${id}-date`}
                        // Announce the field AND its value ("Date: Sat, Oct 15, 2026"), not just "Date".
                        aria-label={`${dateLabel}: ${value.date ? format(value.date, 'EEE, MMM d, yyyy') : 'Pick a date'}`}
                        disabled={disabled}
                        aria-invalid={invalid || undefined}
                        className={cn(
                            'flex h-9 w-full items-center justify-start rounded-md border border-border/70 bg-background px-3 text-start text-xs font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:opacity-50',
                            !value.date && 'text-muted-foreground',
                            invalid && 'border-destructive/60'
                        )}
                    >
                        <CalendarIcon className="me-2 size-3.5 text-muted-foreground" aria-hidden />
                        {value.date ? format(value.date, 'EEE, MMM d, yyyy') : <span>Pick a date</span>}
                    </PopoverTrigger>
                    <PopoverContent className="w-auto rounded-md border-border/80 p-0" align="start">
                        <Calendar
                            mode="single"
                            selected={value.date}
                            defaultMonth={value.date}
                            onSelect={(picked) => {
                                if (picked) onChange({ ...value, date: startOfDay(picked) })
                                setOpen(false)
                            }}
                            disabled={(day) => startOfDay(day) < startOfDay(new Date())}
                            className="p-3"
                        />
                    </PopoverContent>
                </Popover>
            </div>

            <div className="space-y-1.5">
                <Label htmlFor={`${id}-time`} className="text-xs font-medium">
                    <Clock className="size-3.5 text-blue-500" aria-hidden /> {timeLabel}
                </Label>
                <Input
                    id={`${id}-time`}
                    type="time"
                    step={300}
                    value={value.time}
                    disabled={disabled}
                    aria-invalid={invalid || undefined}
                    onChange={(e) => onChange({ ...value, time: e.target.value })}
                    className="h-9 bg-background text-xs"
                />
            </div>
        </div>
    )
}

export default DateTimeFields
