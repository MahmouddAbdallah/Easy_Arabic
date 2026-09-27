"use client";

import { useEffect, useState } from "react";
import { Search, Loader2, X, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useForm, useWatch } from "react-hook-form";
import axios from "axios";
import { useAppContext } from "@/components/AppContext";
import Link from "next/link";

interface SearchFormValues {
    query: string;
}

interface Person {
    id: string;
    name: string;
    avatar?: string;
    role?: string;
    isOnline?: boolean;
}

const SearchPeople = () => {
    const { register, control, setValue } = useForm<SearchFormValues>({
        defaultValues: { query: "" },
    });

    const [results, setResults] = useState<Person[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [hasSearched, setHasSearched] = useState<boolean>(false);

    const searchQuery = useWatch({ name: "query", control });
    const { user } = useAppContext()

    useEffect(() => {
        setLoading(true);
        if (!searchQuery?.trim()) {
            setResults([]);
            setLoading(false);
            setHasSearched(false);
            return;
        }
        const fetchPeople = async (term: string) => {
            if (!term.trim()) {
                setResults([]);
                setLoading(false);
                setHasSearched(false);
                return;
            }

            try {
                const { data } = await axios.get(`/api/chat/sidebar/search?keyword=${searchQuery}`);
                console.log(data?.users);
                setResults(data?.users || []);
            } catch (error) {
                console.error("Error fetching people:", error);
                setResults([]);
            } finally {
                setLoading(false);
                setHasSearched(true);
            }
        };

        const timer = setTimeout(() => {
            fetchPeople(searchQuery);
        }, 500);

        return () => clearTimeout(timer);
    }, [searchQuery, user?.role]);

    const handleClear = () => {
        setValue("query", "");
        setResults([]);
        setHasSearched(false);
    };

    return (
        <div className="p-3 space-y-2.5 relative">
            <div className="relative flex items-center group">
                <Search className="absolute left-3 h-3.5 w-3.5 text-muted-foreground/60 group-focus-within:text-primary transition-colors pointer-events-none z-10" />

                <Input
                    {...register("query")}
                    placeholder="Search people..."
                    className="pl-8 pr-8 bg-muted/30 border-border/40 h-9 text-xs shadow-none focus-visible:ring-1 focus-visible:ring-primary/40 focus-visible:bg-background/80 transition-all rounded-xl placeholder:text-muted-foreground/50 font-medium"
                />

                <div className="absolute right-2.5 flex items-center gap-1 z-10">
                    {loading ? (
                        <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />
                    ) : searchQuery ? (
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={handleClear}
                            className="h-5 w-5 rounded-full hover:bg-muted text-muted-foreground/70 hover:text-foreground"
                        >
                            <X className="h-3 w-3" />
                        </Button>
                    ) : null}
                </div>
            </div>

            {(hasSearched || loading) && (
                <div className="space-y-1 mt-1 bg-card/60 backdrop-blur-xl border border-border/50 rounded-2xl p-2 shadow-xl shadow-black/5 animate-in fade-in-50 zoom-in-95 duration-200">
                    {loading ? (
                        <div className="p-4 text-center space-y-2">
                            <Loader2 className="h-5 w-5 text-primary animate-spin mx-auto opacity-70" />
                            <p className="text-[11px] text-muted-foreground/80 font-medium">
                                Searching across directory...
                            </p>
                        </div>
                    ) : results.length > 0 ? (
                        <div className="max-h-56 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                            {results.map((person) => (
                                <Link
                                    href={`/chat?receiverId=${person?.id}`}
                                    key={person.id}
                                    onClick={() => { setHasSearched(false) }}
                                    className="flex items-center justify-between p-2 rounded-xl hover:bg-accent/80 hover:text-accent-foreground transition-all duration-200 group cursor-pointer"
                                >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <div className="relative shrink-0">
                                            <Avatar className="h-8 w-8 ring-1 ring-border/40 shadow-xs">
                                                <AvatarImage src={person.avatar} alt={person.name} />
                                                <AvatarFallback className="text-[10px] bg-muted font-bold">
                                                    {person.name?.slice(0, 2).toUpperCase() || "U"}
                                                </AvatarFallback>
                                            </Avatar>
                                            {person.isOnline && (
                                                <span className="absolute bottom-0 right-0 w-2 h-2 bg-emerald-500 rounded-full ring-2 ring-background" />
                                            )}
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                            <span className="text-xs font-semibold truncate text-foreground group-hover:text-accent-foreground">
                                                {person.name}
                                            </span>
                                            {person.role && (
                                                <span className="text-[10px] text-muted-foreground/70 truncate">
                                                    {person.role}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    ) : (
                        <div className="p-4 text-center">
                            <User className="h-5 w-5 text-muted-foreground/40 mx-auto mb-1" />
                            <p className="text-xs font-medium text-muted-foreground">
                                No people found
                            </p>
                            <p className="text-[10px] text-muted-foreground/60">
                                Try searching with a different name
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default SearchPeople;