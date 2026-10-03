import { Bell, BookOpen, User2, LogInIcon, MessageCircle, type LucideIcon } from 'lucide-react';
import type { NotificationType } from './lib/contract';

/** One icon per notification type — add yours here when you add a type to NOTIFICATION_TYPES. */
export const TYPE_ICONS: Record<NotificationType, LucideIcon> = {
    general: Bell,
    chat_message: MessageCircle,
    lesson: BookOpen,
    create_account: User2,
    sign_in: LogInIcon
};
