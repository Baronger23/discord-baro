"use client";
import { Fragment, useRef, useMemo } from "react";
import { Member, Profile, Message } from "@prisma/client";
import { ChatWelcome } from "@/components/chat/chat-welcome";
import { useChatQuery } from "@/hooks/use-chat-query";
import { useChatSocket } from "@/hooks/use-chat-socket";
import { useChatScroll } from "@/hooks/use-chat-scroll";
import { Loader2, ServerCrash } from "lucide-react";
import { ChatItem } from "@/components/chat/chat-item";
import { format } from "date-fns";

const DATE_FORMAT = "d MMM, yyyy HH:mm";

type MessageWithMemberWithProfile = Message & {
    member: Member & {
        profile: Profile
    }
}

interface ChatMessagesProps {
    name: string;
    member: Member;
    chatId: string;
    apiUrl: string;
    socketUrl: string;
    socketQuery: Record<string, string>;
    paramKey: "channelId" | "conversationId";
    paramValue: string;
    type: "channel" | "conversation";
}

export const ChatMessages = ({
    name,
    member,
    chatId,
    apiUrl,
    socketUrl,
    socketQuery,
    paramKey,
    paramValue,
    type
}: ChatMessagesProps) => {
    const queryKey = `chat:${chatId}`;
    const chatRef = useRef<HTMLDivElement>(null);
    const bottomRef = useRef<HTMLDivElement>(null);

    const {
        data,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        status,
    } = useChatQuery({
        queryKey,
        apiUrl,
        paramKey,
        paramValue,
    });

    // Listen for real-time messages via Socket.IO
    useChatSocket({
        queryKey,
        channelId: paramValue,
        serverId: socketQuery.serverId,
    });

    // Auto-scroll to bottom on new messages with Intersection Observer
    const { topTriggerRef } = useChatScroll({
        chatRef,
        bottomRef,
        loadMore: fetchNextPage,
        shouldLoadMore: !isFetchingNextPage && !!hasNextPage,
        count: data?.pages?.[0]?.items?.length ?? 0,
    });

    // ✅ OPTIMIZATION: Memoize total message count to avoid recalculation
    const totalMessages = useMemo(() => {
        return data?.pages?.reduce((acc, page) => acc + page.items.length, 0) ?? 0;
    }, [data]);

    if (status === "pending") {
        return (
            <div className="flex flex-col flex-1 justify-center items-center">
                <Loader2 className="h-7 w-7 text-zinc-500 animate-spin my-4" />
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Loading messages...
                </p>
            </div>
        );
    }

    if (status === "error") {
        return (
            <div className="flex flex-col flex-1 justify-center items-center">
                <ServerCrash className="h-7 w-7 text-zinc-500 my-4" />
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Something went wrong!
                </p>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col py-4 overflow-y-auto" ref={chatRef}>
            {/* ✅ OPTIMIZATION: Intersection Observer trigger for loading more */}
            {hasNextPage && (
                <div ref={topTriggerRef} className="h-1" />
            )}
            
            {/* Loading indicator at top */}
            {isFetchingNextPage && (
                <div className="flex justify-center py-4">
                    <Loader2 className="h-6 w-6 text-zinc-500 animate-spin" />
                </div>
            )}
            
            <div className="flex-1"/>
            <ChatWelcome
                type={type}
                name={name}
            />
            <div className="flex flex-col-reverse mt-auto">
                {data?.pages?.map((group, i) => (
                    <Fragment key={i}>
                        {group.items.map((message: MessageWithMemberWithProfile) => (
                            <ChatItem
                                key={message.id}
                                id={message.id} 
                                currentMember={member}
                                member={message.member}
                                content={message.content}
                                fileUrl={message.fileUrl}
                                deleted={message.deleted}
                                timestamp={format(new Date(message.createdAt), DATE_FORMAT)}
                                isUpdated={message.updatedAt !== message.createdAt}
                                socketUrl={socketUrl}
                                socketQuery={socketQuery}
                            />
                        ))}
                    </Fragment>
                ))}
            </div>
            
            {/* ✅ Show message count for debugging/info */}
            {totalMessages > 0 && (
                <div className="text-center text-xs text-zinc-500 dark:text-zinc-400 py-2">
                    {totalMessages} messages loaded
                </div>
            )}
            
            <div ref={bottomRef} />
        </div>
    );
};