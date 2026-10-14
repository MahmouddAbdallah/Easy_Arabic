import { useState, useEffect, useRef } from "react";

export const useViewportHeight = () => {
    const [viewHeight, setViewHeight] = useState('100dvh');
    const messagesTopRef = useRef<any | null>(null);

    useEffect(() => {
        const handleResize = () => {
            if (window.visualViewport) {
                setViewHeight(`${window.visualViewport.height}px`);
            }
        };
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
