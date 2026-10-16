"use client";

import { UsersIcon } from "lucide-react";
import { cn } from "cn";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getGroupPhotoUrl } from "../lib/groups";
import { getInitials } from "../lib/initials";

interface GroupAvatarProps {
    imageUrl?: string | null;
    /** The size of the picture asked of the CDN, in px (about twice what is shown, for sharp screens). */
    pixels?: number;
    className?: string;
}

/**
 * A group's picture, or the people icon when it has none. Decorative (empty `alt`): the group's name is always
 * written next to it. Pass the size with a `size-*` class.
 */
export function GroupAvatar({ imageUrl, pixels = 96, className }: GroupAvatarProps) {
    return (
        <Avatar className={cn("size-10 bg-(--chat-accent-soft) ring-1 ring-(--chat-line)", className)}>
            <AvatarImage src={getGroupPhotoUrl(imageUrl, pixels)} alt="" referrerPolicy="no-referrer" className="object-cover" />
            <AvatarFallback className="bg-(--chat-accent-soft) text-(--chat-accent-text)">
                <UsersIcon className="size-1/2" strokeWidth={1.75} aria-hidden="true" />
            </AvatarFallback>
        </Avatar>
    );
}

interface PersonAvatarProps {
    name: string;
    imageUrl?: string | null;
    className?: string;
}

/** A person's photo, or their initials. Decorative: the name is always written next to it. */
export function PersonAvatar({ name, imageUrl, className }: PersonAvatarProps) {
    return (
        <Avatar className={cn("size-10 bg-(--chat-accent-soft) ring-1 ring-(--chat-line)", className)}>
            <AvatarImage src={imageUrl || undefined} alt="" referrerPolicy="no-referrer" className="object-cover" />
            <AvatarFallback className="bg-(--chat-accent-soft) text-[0.7em] font-semibold text-(--chat-accent-text)">
                {getInitials(name)}
            </AvatarFallback>
        </Avatar>
    );
}
