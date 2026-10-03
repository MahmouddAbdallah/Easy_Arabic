"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { getBreadcrumbs } from "./navigation";

/**
 * Where the user is. Full trail from `md` up; on phones only the current page name,
 * which is all that fits next to the menu button.
 */
export function Breadcrumbs() {
    const pathname = usePathname();
    const crumbs = getBreadcrumbs(pathname);
    const current = crumbs[crumbs.length - 1];

    return (
        <nav aria-label="Breadcrumb" className="min-w-0">
            <p className="truncate text-sm font-semibold md:hidden">{current.label}</p>

            <ol className="hidden items-center gap-1.5 text-sm md:flex">
                {crumbs.map((crumb, index) => {
                    const isLast = index === crumbs.length - 1;
                    return (
                        <li key={`${index}-${crumb.label}`} className="flex min-w-0 items-center gap-1.5">
                            {index > 0 && (
                                <ChevronRight aria-hidden className="size-3.5 shrink-0 text-muted-foreground/60" />
                            )}
                            {crumb.href && !isLast ? (
                                <Link
                                    href={crumb.href}
                                    className="truncate rounded-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-brand/50"
                                >
                                    {crumb.label}
                                </Link>
                            ) : (
                                <span
                                    aria-current={isLast ? "page" : undefined}
                                    className={isLast ? "truncate font-semibold text-foreground" : "truncate text-muted-foreground"}
                                >
                                    {crumb.label}
                                </span>
                            )}
                        </li>
                    );
                })}
            </ol>
        </nav>
    );
}
