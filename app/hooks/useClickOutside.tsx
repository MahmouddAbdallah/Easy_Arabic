import { useCallback, useEffect, useRef } from 'react';

function useClickOutside(close: () => void) {
    const ref = useRef<HTMLDivElement>(null);

    const handleClickOutside = (event: MouseEvent) => {
        const element = ref.current;
        if (element && !element.contains(event.target as Node)) {
            close()
        }
    }

    useEffect(() => {
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    return ref;
}
export default useClickOutside