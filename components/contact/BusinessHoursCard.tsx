'use client';

import { useEffect, useState } from 'react';
import { Clock3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DAY_NAMES, formatHoursRange, isOpenNow } from '@/lib/contact/helpers';
import type { BusinessHourRecord } from '@/lib/contact/types';

type Props = { hours: BusinessHourRecord[]; timezone: string; note: string };

export default function BusinessHoursCard({ hours, timezone, note }: Props) {
  // Computed after mount: "now" differs between server render and the visitor's clock.
  const [status, setStatus] = useState<{ dayOfWeek: number; open: boolean } | null>(null);

  useEffect(() => {
    const update = () => setStatus(isOpenNow(hours, timezone));
    update();
    const timer = setInterval(update, 60_000);
    return () => clearInterval(timer);
  }, [hours, timezone]);

  return (
    <div className="rounded-[28px] border border-border/80 bg-card/40 backdrop-blur-2xl shadow-xl p-6 h-full flex flex-col">
      <div className="flex items-start justify-between gap-3 pb-4 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20">
            <Clock3 className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Business hours</h3>
            <p className="text-xs text-muted-foreground">{timezone.replace(/_/g, ' ')} time</p>
          </div>
        </div>

        {status && (
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold border',
              status.open
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                : 'bg-muted text-muted-foreground border-border'
            )}
          >
            <span className={cn('size-1.5 rounded-full', status.open ? 'bg-emerald-500' : 'bg-muted-foreground/50')} aria-hidden />
            {status.open ? 'Open now' : 'Closed now'}
          </span>
        )}
      </div>

      <ul className="divide-y divide-border/40 py-2 flex-1">
        {hours.map((day) => {
          const isToday = status?.dayOfWeek === day.dayOfWeek;
          return (
            <li
              key={day.dayOfWeek}
              className={cn('flex items-center justify-between gap-4 py-2.5 text-sm', isToday && 'font-semibold')}
            >
              <span className={cn('flex items-center gap-2', isToday ? 'text-foreground' : 'text-muted-foreground')}>
                {DAY_NAMES[day.dayOfWeek]}
                {isToday && <span className="rounded-md bg-primary/10 text-primary px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide">Today</span>}
              </span>
              <span className={cn('tabular-nums text-right', day.isOpen ? 'text-foreground' : 'text-muted-foreground')}>
                {formatHoursRange(day)}
              </span>
            </li>
          );
        })}
      </ul>

      {note && <p className="text-xs text-muted-foreground leading-relaxed pt-3 border-t border-border/50">{note}</p>}
    </div>
  );
}
