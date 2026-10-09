import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';


export const usePushParams = () => {
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const { replace, } = useRouter();

    const pushQuery = useCallback((key: string, value: string | null | undefined) => {
        const params = new URLSearchParams(searchParams.toString());
        if (value) {
            const finalValue = value;
            params.set(key, finalValue);
        } else {
            params.delete(key);
        }

        replace(`${pathname}?${params.toString()}`, { scroll: false });
    }, [searchParams, pathname, replace]);

    const clearQueryByKey = useCallback((key: string) => {
        const params = new URLSearchParams(searchParams.toString());
        if (key) {
            params.delete(key);
        }
        replace(`${pathname}?${params.toString()}`, { scroll: false });
    }, [searchParams, pathname, replace]);

    return { pushQuery, clearQueryByKey, searchParams, };
};

