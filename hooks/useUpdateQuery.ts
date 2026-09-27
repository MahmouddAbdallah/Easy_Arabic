import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';


export const useUpdateQuery = () => {
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const { replace, back, push } = useRouter();

    const updateQuery = useCallback((key: string, value: string | null | undefined) => {
        const params = new URLSearchParams(searchParams.toString());

        if (value) {
            const finalValue = value;
            params.set(key, finalValue);
        } else {
            params.delete(key);
        }

        replace(`${pathname}?${params.toString()}`, { scroll: false });
    }, [searchParams, pathname, replace]);

    return { updateQuery, searchParams, push, back };
};

