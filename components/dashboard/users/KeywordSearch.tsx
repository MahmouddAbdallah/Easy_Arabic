"use client";

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, Loader2, X } from 'lucide-react';
import clsx from 'clsx';
import { Input } from '@/components/ui/input';

const KeywordSearch = ({ placeholder }: { placeholder: string }) => {
    const router = useRouter();
    const searchParams = useSearchParams();


    const [keyword, setKeyword] = useState(searchParams.get('query') || '');
    const [isTyping, setIsTyping] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setKeyword(e.target.value);
        setIsTyping(true);
    };

    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            const currentKeyword = searchParams.get('keyword') || '';

            if (keyword === currentKeyword) {
                setIsTyping(false);
                return;
            }
            const params = new URLSearchParams(searchParams.toString());
            if (keyword) {
                params.set('keyword', keyword);
            } else {
                params.delete('keyword');
            }
            router.push(`?${params.toString()}`, { scroll: false });
            setIsTyping(false);
        }, 1500);

        return () => clearTimeout(delayDebounceFn);
    }, [keyword, router, searchParams]);


    return (
        <div className="relative w-full sm:w-80">
            {isTyping ? (
                <Loader2 className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground animate-spin" />
            ) : (
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            )}
            <Input
                placeholder={placeholder}
                value={keyword}
                onChange={handleChange}
                className="pl-9 h-9 text-xs bg-background/50 focus:bg-background transition-colors"
            />
            {keyword && (
                <button
                    onClick={() => {
                        setKeyword('');
                        setIsTyping(true);
                    }}
                    className={clsx("absolute inset-y-0 pr-3 flex items-center text-muted-foreground/70 hover:text-muted-foreground",
                        'right-2'
                    )}
                >
                    <X className="h-4 w-4" />
                </button>
            )}
        </div>

    );
};

export default KeywordSearch;