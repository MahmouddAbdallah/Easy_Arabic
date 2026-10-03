"use client";

import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ContactInfoError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
            <div role="alert" className="flex flex-col items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 px-6 py-14 text-center">
                <AlertTriangle className="h-8 w-8 text-destructive" />
                <h1 className="text-lg font-bold">Couldn’t load the Contact page settings</h1>
                <p className="max-w-sm text-sm text-muted-foreground">
                    The database didn’t respond. Nothing was changed. Check your connection and try again.
                </p>
                <Button onClick={reset} variant="outline" className="rounded-lg">
                    <RotateCw className="h-4 w-4" />
                    Try again
                </Button>
            </div>
        </div>
    );
}
