import qs from "query-string";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useSocket } from "@/components/providers/socket-provider";

interface ChatQueryProps { 
    queryKey: string;
    apiUrl: string;
    paramKey: "channelId" | "conversationId";
    paramValue: string;
}

export const useChatQuery = ({
    queryKey,
    apiUrl,
    paramKey,
    paramValue
}: ChatQueryProps) => {
    const { isConnected } = useSocket();
    
    const fetchMessages = async ({ pageParam = undefined }) => {
        const url = qs.stringifyUrl({
            url: apiUrl,
            query: {
                cursor: pageParam,
                [paramKey]: paramValue,
            }
        }, { skipNull: true });

        const res = await fetch(url);
        
        if (!res.ok) {
            throw new Error('Failed to fetch messages');
        }
        
        return res.json();
    };
    
    const { 
        data,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        status,
    } = useInfiniteQuery({
        queryKey: [queryKey],
        queryFn: fetchMessages,
        getNextPageParam: (lastPage) => lastPage?.nextCursor,
        
        // ✅ OPTIMIZATION: Smart refetch strategy
        // When socket connected: No polling (real-time updates via socket)
        // When socket disconnected: Poll every 1s as fallback
        refetchInterval: isConnected ? false : 1000,
        
        // ✅ OPTIMIZATION: Only refetch on window focus if disconnected
        refetchOnWindowFocus: !isConnected,
        
        // ✅ OPTIMIZATION: Keep data fresh but reduce network requests
        staleTime: 1000 * 60, // Data fresh for 1 minute
        
        initialPageParam: undefined,
    });

    return {
        data,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        status,
    };
}; 