import {
    Star,
    Sparkles,
    ThumbsUp,
    Meh,
    ThumbsDown,
    Frown,
    Flame,
    Skull,
    UserCheck,
    UserX,
    XCircle,
    Zap,
    Timer,
    Clock,
    Hourglass,
    History,
    CalendarClock,
    LucideIcon
} from "lucide-react";

export interface OptionItem {
    value: string;
    label: string;
    icon: LucideIcon;
    color: string;
}

export const REWARD_OPTIONS: OptionItem[] = [
    { value: 'EXCELLENT', label: 'Excellent', icon: Star, color: 'text-amber-500 bg-amber-500/10 border-amber-500/20' },
    { value: 'VERY_GOOD', label: 'Very Good', icon: Sparkles, color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' },
    { value: 'GOOD', label: 'Good', icon: ThumbsUp, color: 'text-blue-500 bg-blue-500/10 border-blue-500/20' },
    { value: 'NEUTRAL', label: 'Neutral', icon: Meh, color: 'text-slate-400 bg-slate-400/10 border-slate-400/20' },
    { value: 'NOT_BAD', label: 'Not Bad', icon: ThumbsDown, color: 'text-orange-400 bg-orange-400/10 border-orange-400/20' },
    { value: 'POOR', label: 'Poor', icon: Frown, color: 'text-orange-500 bg-orange-500/10 border-orange-500/20' },
    { value: 'VERY_POOR', label: 'Very Poor', icon: Flame, color: 'text-rose-500 bg-rose-500/10 border-rose-500/20' },
    { value: 'TERRIBLE', label: 'Terrible', icon: Skull, color: 'text-red-600 bg-red-600/10 border-red-600/20' },
];

/**
 * Planned, not yet happened: only the planner creates these (lib/planner). It is deliberately NOT in
 * STATUS_OPTIONS, so the "log a lesson" form can't hand-pick it (that would skip the planner's conflict checks).
 */
export const SCHEDULED_OPTION: OptionItem = { value: 'SCHEDULED', label: 'Scheduled', icon: CalendarClock, color: 'text-sky-600 dark:text-sky-400 bg-sky-500/10 border-sky-500/20' };

/** What a lesson's outcome can be set to. */
export const STATUS_OPTIONS: OptionItem[] = [
    { value: 'ATTENDED', label: 'Attended', icon: UserCheck, color: 'text-teal-600 dark:text-teal-400 bg-teal-500/10 border-teal-500/20' },
    { value: 'ABSENT', label: 'Absent', icon: UserX, color: 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20' },
    { value: 'CANCELLED', label: 'Cancelled', icon: XCircle, color: 'text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/20' },
];

export const DURATION_OPTIONS: OptionItem[] = [
    { value: '15', label: '15 mins', icon: Zap, color: 'text-amber-500' },
    { value: '30', label: '30 mins', icon: Timer, color: 'text-blue-500' },
    { value: '45', label: '45 mins', icon: Clock, color: 'text-indigo-500' },
    { value: '60', label: '60 mins (1 hr)', icon: Hourglass, color: 'text-emerald-500' },
    { value: '75', label: '75 mins', icon: Clock, color: 'text-purple-500' },
    { value: '90', label: '90 mins (1.5 hrs)', icon: History, color: 'text-rose-500' },
    { value: '120', label: '120 mins (2 hrs)', icon: Sparkles, color: 'text-amber-600' },
];

export const REWARD_MAP = RecordFromOptions(REWARD_OPTIONS);
/** Every status a lesson can be shown with (including SCHEDULED), e.g. for the list filter. */
export const ALL_STATUS_OPTIONS: OptionItem[] = [SCHEDULED_OPTION, ...STATUS_OPTIONS];
export const STATUS_MAP = RecordFromOptions(ALL_STATUS_OPTIONS);
export const DURATION_MAP = RecordFromOptions(DURATION_OPTIONS);

function RecordFromOptions(options: OptionItem[]): Record<string, OptionItem> {
    return options.reduce((acc, item) => {
        acc[item.value] = item;
        return acc;
    }, {} as Record<string, OptionItem>);
}