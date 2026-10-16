import { useState, useEffect, useRef } from "react";

const MOBILE_MAX_WIDTH = 700;

// Builds the height string for the current visual viewport.
// Returns '' when there is no window / visualViewport (e.g. during SSR).
const getViewHeight = (): string => {
    if (typeof window === 'undefined') return '';
    const viewport = window.visualViewport as any;

    return viewport?.width <= MOBILE_MAX_WIDTH
        ? `100%`
        : `${viewport?.height ? viewport?.height + 'px' : '100%'}`;
};

export const useViewportHeight = () => {
    // Lazy initializer: runs once, so the first render already has the right value
    const [viewHeight, setViewHeight] = useState<string>(getViewHeight);
    const messagesTopRef = useRef<any | null>(null);

    useEffect(() => {
        const handleResize = () => setViewHeight(getViewHeight());
        handleResize(); // sync once on mount

        window.visualViewport?.addEventListener('resize', handleResize);
        window.visualViewport?.addEventListener('scroll', handleResize);
        return () => {
            window.visualViewport?.removeEventListener('resize', handleResize);
            window.visualViewport?.removeEventListener('scroll', handleResize);
        };
    }, []);

    useEffect(() => {
        const handleScrollTop = () => {
            messagesTopRef.current?.scrollIntoView();
        }
        window.visualViewport?.addEventListener('scroll', handleScrollTop);
        return () => {
            window.visualViewport?.removeEventListener('scroll', handleScrollTop);
        };
    }, [])

    return { viewHeight, messagesTopRef };
};