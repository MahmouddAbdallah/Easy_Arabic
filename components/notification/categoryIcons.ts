import {
    Award,
    Bell,
    BookOpen,
    Calendar,
    Clock,
    CreditCard,
    FileText,
    Gift,
    GraduationCap,
    Heart,
    Info,
    Mail,
    Megaphone,
    MessageCircle,
    ShieldCheck,
    Star,
    Tag,
    TriangleAlert,
    UserRound,
    Users,
    type LucideIcon,
} from 'lucide-react';
import type { CategoryIconName } from './lib/config';

/**
 * The icon of each section of "What to be notified about". The configuration names an icon (lib/config.ts →
 * CATEGORY_ICON_NAMES) and this turns the name into the component. Typed as a complete record, so adding a name
 * there without an icon here — or the other way round — does not compile.
 */
export const CATEGORY_ICONS: Record<CategoryIconName, LucideIcon> = {
    bell: Bell,
    'message-circle': MessageCircle,
    'book-open': BookOpen,
    'user-round': UserRound,
    megaphone: Megaphone,
    'shield-check': ShieldCheck,
    calendar: Calendar,
    'credit-card': CreditCard,
    star: Star,
    gift: Gift,
    'graduation-cap': GraduationCap,
    clock: Clock,
    heart: Heart,
    info: Info,
    mail: Mail,
    award: Award,
    users: Users,
    'file-text': FileText,
    tag: Tag,
    'triangle-alert': TriangleAlert,
};
