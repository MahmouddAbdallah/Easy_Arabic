import { Inbox, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContactQuery } from "./contactUtils";

interface ContactsEmptyStateProps {
    hasFilters: boolean;
    query: Pick<ContactQuery, "keyword" | "status">;
    onClear: () => void;
}

export function ContactsEmptyState({ hasFilters, query, onClear }: ContactsEmptyStateProps) {
    if (!hasFilters) {
        return (
            <div className="flex flex-col items-center px-6 py-16 text-center">
                <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <Inbox className="size-6" />
                </div>
                <h2 className="text-base font-semibold text-foreground">No messages yet</h2>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                    Messages sent through the public contact form will show up here.
                </p>
            </div>
        );
    }

    const parts = [
        query.keyword && `“${query.keyword}”`,
        query.status && `${query.status} messages`,
    ].filter(Boolean);

    return (
        <div className="flex flex-col items-center px-6 py-16 text-center">
            <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <SearchX className="size-6" />
            </div>
            <h2 className="text-base font-semibold text-foreground">No matching messages</h2>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Nothing found for {parts.join(" in ")}. Try a different search or clear the filters.
            </p>
            <Button variant="outline" size="lg" className="mt-5" onClick={onClear}>
                Clear filters
            </Button>
        </div>
    );
}
