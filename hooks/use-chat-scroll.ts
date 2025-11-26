import { useEffect, useState, useRef } from "react";

interface ChatScrollProps {
    chatRef: React.RefObject<HTMLDivElement | null>;
    bottomRef: React.RefObject<HTMLDivElement | null>;
    shouldLoadMore: boolean;
    loadMore: () => void;
    count: number;
    chatKey?: string; // Add chatKey to detect channel changes
}

export const useChatScroll = ({
    chatRef,
    bottomRef,
    shouldLoadMore,
    loadMore,
    count,
    chatKey,
}: ChatScrollProps) => {
    const [hasInitialized, setHasInitialized] = useState(false);
    const previousScrollHeight = useRef<number>(0);
    const previousScrollTop = useRef<number>(0);
    const previousChatKey = useRef<string | undefined>(chatKey);

    // Reset initialization when chat changes
    useEffect(() => {
        if (chatKey && chatKey !== previousChatKey.current) {
            console.log('[useChatScroll] Channel changed:', { 
                from: previousChatKey.current, 
                to: chatKey 
            });
            setHasInitialized(false);
            previousChatKey.current = chatKey;
            previousScrollHeight.current = 0; // Reset scroll tracking
        }
    }, [chatKey]);

    useEffect(() => {
        const topDiv = chatRef?.current;

        const handleScroll = () => {
            if (!topDiv) return;
            
            const scrollTop = topDiv.scrollTop;
            const scrollHeight = topDiv.scrollHeight;
            const clientHeight = topDiv.clientHeight;
            
            // Ước tính chiều cao trung bình của mỗi tin nhắn
            // Giả sử mỗi tin nhắn cao khoảng 80-100px
            const estimatedMessageHeight = 90;
            const loadThreshold = estimatedMessageHeight * 5; // 5 tin nhắn * ~90px
            
            // Load khi scroll gần đến đầu (còn cách khoảng 5 tin nhắn)
            if (scrollTop <= loadThreshold && shouldLoadMore) {
                // Save scroll position before loading more
                previousScrollHeight.current = scrollHeight;
                previousScrollTop.current = scrollTop;
                loadMore();
            }
        };

        topDiv?.addEventListener("scroll", handleScroll);

        return () => {
            topDiv?.removeEventListener("scroll", handleScroll);
        };
    }, [shouldLoadMore, loadMore, chatRef]);

    useEffect(() => {
        const bottomDiv = bottomRef?.current;
        const topDiv = chatRef?.current;

        const shouldAutoScroll = () => {
            if (!hasInitialized && bottomDiv) {
                console.log('[useChatScroll] First time initialization - scrolling to bottom');
                setHasInitialized(true);
                return true;
            }

            if (!topDiv) {
                return false;
            }

            const distanceFromBottom = topDiv.scrollHeight - topDiv.scrollTop - topDiv.clientHeight;
            const shouldScroll = distanceFromBottom <= 100;
            
            if (shouldScroll) {
                console.log('[useChatScroll] User near bottom - auto scrolling');
            }
            
            return shouldScroll;
        };

        if (shouldAutoScroll()) {
            setTimeout(() => {
                bottomRef.current?.scrollIntoView({
                    behavior: "instant", // Changed from "smooth" to "instant" for immediate scroll
                });
            }, 100);
        } else if (previousScrollHeight.current > 0 && topDiv) {
            // Restore scroll position after loading more messages
            const newScrollHeight = topDiv.scrollHeight;
            const heightDifference = newScrollHeight - previousScrollHeight.current;
            
            if (heightDifference > 0) {
                console.log('[useChatScroll] Restoring scroll after loading more messages');
                topDiv.scrollTop = heightDifference;
                previousScrollHeight.current = 0; // Reset
            }
        }
    }, [bottomRef, chatRef, count, hasInitialized]);
};
