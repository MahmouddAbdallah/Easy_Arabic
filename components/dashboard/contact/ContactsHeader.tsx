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
        <div className="space-y-6">
            {/* Title & Description */}
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Contact Messages</h1>
                <p className="text-muted-foreground text-sm">
                    Manage, review, and respond to incoming messages from your contact form.
                </p>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card className="shadow-sm">
                    <CardContent className="p-6 flex items-center justify-between">
                        <div className="space-y-1">
                            <p className="text-sm font-medium text-muted-foreground">Total Messages</p>
                            <p className="text-2xl font-bold">128</p>
                        </div>
                        <div className="p-3 bg-primary/10 text-primary rounded-xl">
                            <Inbox className="h-5 w-5" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-sm">
                    <CardContent className="p-6 flex items-center justify-between">
                        <div className="space-y-1">
                            <p className="text-sm font-medium text-muted-foreground">Unread</p>
                            <p className="text-2xl font-bold text-blue-500">14</p>
                        </div>
                        <div className="p-3 bg-blue-500/10 text-blue-500 rounded-xl">
                            <Mail className="h-5 w-5" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-sm">
                    <CardContent className="p-6 flex items-center justify-between">
                        <div className="space-y-1">
                            <p className="text-sm font-medium text-muted-foreground">Read</p>
                            <p className="text-2xl font-bold text-emerald-500">114</p>
                        </div>
                        <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl">
                            <MailOpen className="h-5 w-5" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Search & Filter Toolbar */}
            <div className="flex flex-col sm:flex-row items-center gap-4 justify-between">
                <div className="relative w-full sm:w-80">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search by name, email, or subject..." className="pl-9" />
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    <Select defaultValue="all">
                        <SelectTrigger className="w-40">
                            <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
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