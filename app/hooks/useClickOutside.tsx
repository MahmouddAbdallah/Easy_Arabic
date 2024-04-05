import { useCallback, useEffect, useRef } from 'react';

function useClickOutside(close: () => void) {
    const ref = useRef<HTMLDivElement>(null);

    const handleClickOutside = useCallback((event: MouseEvent) => {
        const element = ref.current;
        if (element && !element.contains(event.target as Node)) {
            close()
        }
    }, [close]);

    useEffect(() => {
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [handleClickOutside]);

    return ref;
}
export default useClickOutside