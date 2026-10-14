"use client";

import { useEffect, useState } from "react";
import { Search, Loader2, X, User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useForm, useWatch } from "react-hook-form";
import axios from "axios";
import { useAppContext } from "@/components/AppContext";
import Link from "next/link";
import { cn } from "cn";
import { ui } from "../lib/chatTheme";

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
        <div className="relative space-y-2 px-3 pb-2 pt-1">
            <div className="group relative flex items-center">
                <Search className="pointer-events-none absolute start-3.5 z-10 size-[18px] text-(--chat-ink-3) transition-colors group-focus-within:text-(--chat-accent-text)" aria-hidden />

                <input
                    {...register("query")}
                    dir="auto"
                    aria-label="Search people"
                    placeholder="Search people"
                    autoComplete="off"
                    className={cn(ui.field, "ps-11 pe-11")}
                />

                <div className="absolute end-2 z-10 flex items-center">
                    {loading ? (
                        <Loader2 className="mx-2 size-4 animate-spin text-(--chat-accent-text)" aria-hidden />
                    ) : searchQuery ? (
                        <button
                            type="button"
                            onClick={handleClear}
                            aria-label="Clear search"
                            className="grid size-7 place-items-center rounded-full text-(--chat-ink-3) outline-none transition-colors hover:bg-(--chat-line) hover:text-(--chat-ink) focus-visible:ring-2 focus-visible:ring-(--chat-accent-ring)"
                        >
                            <X className="size-4" aria-hidden />
                        </button>
                    ) : null}
                </div>
            </div>

            {(hasSearched || loading) && (
                <div className="chat-rise rounded-2xl border border-(--chat-line) bg-(--chat-surface) p-1.5 shadow-(--chat-shadow-md)">
                    {loading ? (
                        <div className="space-y-2 p-4 text-center" role="status">
                            <Loader2 className="mx-auto size-5 animate-spin text-(--chat-accent-text)" aria-hidden />
                            <p className="text-sm text-(--chat-ink-2)">Searching people...</p>
                        </div>
                    ) : results.length > 0 ? (
                        <ul className="chat-scroll max-h-64 space-y-0.5 overflow-y-auto">
                            {results.map((person) => (
                                <li key={person.id}>
                                    <Link
                                        href={`/chat?receiverId=${person?.id}`}
                                        onClick={() => { setHasSearched(false) }}
                                        className="flex cursor-pointer items-center gap-3 rounded-xl p-2 outline-none transition-colors hover:bg-(--chat-surface-2) focus-visible:ring-2 focus-visible:ring-(--chat-accent-ring)"
                                    >
                                        <div className="relative shrink-0">
                                            <Avatar className="size-10 bg-(--chat-accent-soft) ring-1 ring-(--chat-line)">
                                                <AvatarImage src={person.avatar} alt={person.name} />
                                                <AvatarFallback className="bg-(--chat-accent-soft) text-xs font-semibold text-(--chat-accent-text)">
                                                    {person.name?.slice(0, 2).toUpperCase() || "U"}
                                                </AvatarFallback>
                                            </Avatar>
                                            {person.isOnline && (
                                                <span className="absolute -bottom-px -end-px size-3 rounded-full bg-(--chat-online) ring-2 ring-(--chat-surface)" />
                                            )}
                                        </div>
                                        <div className="flex min-w-0 flex-col">
                                            <span className="truncate text-[15px] font-medium text-(--chat-ink)">{person.name}</span>
                                            {person.role && <span className="truncate text-[13px] text-(--chat-ink-3)">{person.role}</span>}
                                        </div>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="p-5 text-center">
                            <User className="mx-auto mb-1.5 size-6 text-(--chat-ink-3)" aria-hidden />
                            <p className="text-sm font-medium text-(--chat-ink)">No people found</p>
                            <p className="text-[13px] text-(--chat-ink-3)">Try a different name</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default SearchPeople;
