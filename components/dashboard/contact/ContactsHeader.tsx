import { Search, Mail, MailOpen, Inbox, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

export function ContactsHeader() {
    return (
        <div className="space-y-4 sm:space-y-6">
            {/* Title & Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/40 pb-4">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                        <span>Contact Messages</span>
                    </h1>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                        Manage, review, and respond to incoming messages from your contact form.
                    </p>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 lg:grid-cols-3 gap-3 sm:gap-4">
                <Card className="border-border/60 shadow-none">
                    <CardContent className="sm:px-3 flex items-center justify-between">
                        <div className="space-y-0.5">
                            <p className="text-[11px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                Total
                            </p>
                            <p className="text-lg sm:text-2xl font-bold text-foreground">128</p>
                        </div>
                        <div className="h-9 w-9 sm:h-11 sm:w-11 bg-primary/10 text-primary rounded-xl flex items-center justify-center shrink-0">
                            <Inbox className="h-4 w-4 sm:h-5 sm:w-5" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-border/60 shadow-none">
                    <CardContent className="sm:px-3 flex items-center justify-between">
                        <div className="space-y-0.5">
                            <p className="text-[11px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                Unread
                            </p>
                            <p className="text-lg sm:text-2xl font-bold text-blue-600 dark:text-blue-400">14</p>
                        </div>
                        <div className="h-9 w-9 sm:h-11 sm:w-11 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center shrink-0">
                            <Mail className="h-4 w-4 sm:h-5 sm:w-5" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="col-span-1 lg:col-span-1 border-border/60 shadow-none">
                    <CardContent className="sm:px-3 flex items-center justify-between">
                        <div className="space-y-0.5">
                            <p className="text-[11px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                Read
                            </p>
                            <p className="text-lg sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400">114</p>
                        </div>
                        <div className="h-9 w-9 sm:h-11 sm:w-11 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center shrink-0">
                            <MailOpen className="h-4 w-4 sm:h-5 sm:w-5" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Search & Filter Toolbar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-muted/20 p-2 sm:p-2.5 rounded-xl border border-border/50">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by name, email, or subject..."
                        className="pl-9 bg-background text-xs sm:text-sm h-9 border-border/60"
                    />
                </div>

                <div className="flex items-center gap-2">
                    <Select defaultValue="all">
                        <SelectTrigger className="w-full sm:w-40 bg-background text-xs sm:text-sm h-9 border-border/60">
                            <Filter className="h-3.5 w-3.5 text-muted-foreground mr-1.5 shrink-0" />
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent align="end">
                            <SelectItem value="all">All Messages</SelectItem>
                            <SelectItem value="unread">Unread Only</SelectItem>
                            <SelectItem value="read">Read Only</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
        </div>
    );
}