import { useEffect, useState, useRef, useCallback } from "react";

interface ChatScrollProps {
    chatRef: React.RefObject<HTMLDivElement | null>;
    bottomRef: React.RefObject<HTMLDivElement | null>;
    shouldLoadMore: boolean;
    loadMore: () => void;
    count: number;
}

export const useChatScroll = ({
    chatRef,
    bottomRef,
    shouldLoadMore,
    loadMore,
    count,
}: ChatScrollProps) => {
    const [hasInitialized, setHasInitialized] = useState(false);
    const topTriggerRef = useRef<HTMLDivElement | null>(null);

    // ✅ OPTIMIZATION: Use Intersection Observer for better scroll performance
    // Instead of listening to scroll events (expensive), use IntersectionObserver
    const handleLoadMore = useCallback(() => {
        if (shouldLoadMore) {
            loadMore();
        }
    }, [shouldLoadMore, loadMore]);

    useEffect(() => {
        const topDiv = chatRef?.current;
        const trigger = topTriggerRef.current;

        if (!topDiv || !trigger) return;

        // ✅ Intersection Observer is more performant than scroll listeners
        const observer = new IntersectionObserver(
            (entries) => {
                const [entry] = entries;
                // When trigger element becomes visible, load more messages
                if (entry.isIntersecting) {
                    handleLoadMore();
                }
            },
            {
                root: topDiv,
                rootMargin: '100px', // Trigger 100px before reaching top
                threshold: 0,
            }
        );

        observer.observe(trigger);

        return () => {
            observer.disconnect();
        };
    }, [handleLoadMore, chatRef]);

    // ✅ Auto-scroll to bottom on new messages
    useEffect(() => {
        const bottomDiv = bottomRef?.current;
        const topDiv = chatRef?.current;

        const shouldAutoScroll = () => {
            // Always scroll on first load
            if (!hasInitialized && bottomDiv) {
                setHasInitialized(true);
                return true;
            }

            if (!topDiv) {
                return false;
            }

            // Auto-scroll if user is near bottom (within 100px)
            const distanceFromBottom = topDiv.scrollHeight - topDiv.scrollTop - topDiv.clientHeight;
            return distanceFromBottom <= 100;
        };

        if (shouldAutoScroll()) {
            setTimeout(() => {
                bottomRef.current?.scrollIntoView({
                    behavior: "smooth",
                });
            }, 100);
        }
    }, [bottomRef, chatRef, count, hasInitialized]);

    return { topTriggerRef };
};
