import {
    BookOpen,
    GraduationCap,
    MessageSquare,
    PhoneCall,
    Users,
    type LucideIcon,
} from "lucide-react";

/**
 * Single source of truth for the dashboard's navigation. The sidebar, the navbar
 * breadcrumbs and the ⌘K quick-jump menu all read from here, so a new page only has
 * to be added once.
 */

export interface NavSubItem {
    title: string;
    href: string;
}

export interface NavItem {
    title: string;
    /** Landing page of the item. For groups this is the first sub-page. */
    href: string;
    icon: LucideIcon;
    /** Shows a live unread counter next to the item. */
    counter?: "chat";
    subItems?: NavSubItem[];
}

export const navigationItems: NavItem[] = [
    {
        title: "Families",
        href: "/dashboard/families",
        icon: Users,
    },
    {
        title: "Teachers",
        href: "/dashboard/teacher",
        icon: GraduationCap,
    },
    {
        title: "Lessons",
        href: "/lesson",
        icon: BookOpen,
        subItems: [
            { title: "All Lessons", href: "/lesson" },
            { title: "Create Lesson", href: "/lesson/new-lesson" },
        ],
    },
    {
        title: "Chat",
        href: "/chat",
        icon: MessageSquare,
        counter: "chat",
    },
    {
        title: "Contact",
        href: "/dashboard/contact",
        icon: PhoneCall,
        subItems: [
            { title: "Messages", href: "/dashboard/contact" },
            { title: "Contact Page", href: "/dashboard/contact/contact-info" },
        ],
    },
];

/** `/a/b` matches `/a/b` and anything below it, but not `/a/bc`. */
export function matchesPath(pathname: string, href: string): boolean {
    return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * The sub-page that best matches the current URL. The longest href wins, so
 * `/dashboard/contact/contact-info` selects "Contact Page" rather than "Messages",
 * even though "Messages" (`/dashboard/contact`) is also a prefix of it.
 */
export function getActiveSubHref(item: NavItem, pathname: string): string | null {
    const match = item.subItems
        ?.filter((sub) => matchesPath(pathname, sub.href))
        .sort((a, b) => b.href.length - a.href.length)[0];
    return match?.href ?? null;
}

export function isItemActive(item: NavItem, pathname: string): boolean {
    if (item.subItems?.length) return getActiveSubHref(item, pathname) !== null;
    return matchesPath(pathname, item.href);
}

/** Human-readable name for a URL segment the navigation doesn't know about. */
function labelFromSegment(segment: string): string {
    let decoded = segment;
    try {
        decoded = decodeURIComponent(segment);
    } catch {
        // malformed escape sequence: show the raw segment
    }
    // Database ids (cuid, uuid, ObjectId …) read as noise in a breadcrumb.
    if (decoded.length >= 16 || (decoded.length >= 8 && /\d/.test(decoded))) return "Details";
    const spaced = decoded.replace(/[-_]+/g, " ").trim();
    return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export interface Crumb {
    label: string;
    /** Missing on the last crumb (the current page) and on non-navigable groups. */
    href?: string;
}

/** Breadcrumb trail for the current URL, derived from the navigation config. */
export function getBreadcrumbs(pathname: string): Crumb[] {
    const root: Crumb = { label: "Dashboard", href: "/dashboard" };
    if (pathname === "/dashboard") return [{ label: "Overview" }];

    // The most specific nav entry (item or sub-page) that contains this URL.
    let best: { item: NavItem; sub?: NavSubItem; length: number } | null = null;
    for (const item of navigationItems) {
        const candidates: Array<{ href: string; sub?: NavSubItem }> = item.subItems?.length
            ? item.subItems.map((sub) => ({ href: sub.href, sub }))
            : [{ href: item.href }];
        for (const { href, sub } of candidates) {
            if (matchesPath(pathname, href) && (!best || href.length > best.length)) {
                best = { item, sub, length: href.length };
            }
        }
    }

    const crumbs: Crumb[] = [root];
    let consumed = "/dashboard";

    if (best) {
        const { item, sub, length } = best;
        const matchedHref = sub?.href ?? item.href;
        const trail: Crumb[] = [{ label: item.title, href: item.subItems?.[0]?.href ?? item.href }];
        // The first sub-page is the group's index, so it would only repeat the group's name.
        if (sub && sub.href !== item.subItems?.[0]?.href) trail.push({ label: sub.title, href: sub.href });
        crumbs.push(...trail);
        consumed = matchedHref.slice(0, length);
    }

    const rest = pathname.startsWith(`${consumed}/`) ? pathname.slice(consumed.length + 1) : "";
    if (rest) {
        for (const segment of rest.split("/").filter(Boolean)) {
            crumbs.push({ label: labelFromSegment(segment) });
        }
    } else if (!best) {
        // A page the navigation doesn't list, under /dashboard.
        const unknown = pathname.replace(/^\/dashboard\/?/, "").split("/").filter(Boolean);
        for (const segment of unknown) crumbs.push({ label: labelFromSegment(segment) });
    }

    // The current page is never a link.
    const last = crumbs[crumbs.length - 1];
    crumbs[crumbs.length - 1] = { label: last.label };
    return crumbs;
}
