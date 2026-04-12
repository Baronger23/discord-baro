"use client";
import { Fragment, useCallback, useEffect, useRef } from "react";
import type { Member, Profile, Message } from "@prisma/client";
import { ChatWelcome } from "@/components/chat/chat-welcome";
import { useChatQuery } from "@/hooks/use-chat-query";
import { useChatSocket } from "@/hooks/use-chat-socket";
import { useChatScroll } from "@/hooks/use-chat-scroll";
import { Loader2, ServerCrash } from "lucide-react";
import { ChatItem } from "@/components/chat/chat-item";
import { format } from "date-fns";
import { useModal } from "@/hooks/use-modal-store";

const DATE_FORMAT = "d MMM, yyyy HH:mm";

type MessageWithMemberWithProfile = Message & {
    member: Member & {
        profile: Profile
    };
    replyToMessage?: {
        id: string;
        content: string;
        fileUrl: string | null;
        deleted: boolean;
        member: {
            profile: {
                name: string;
            };
        };
    } | null;
    replyToDirectMessage?: {
        id: string;
        content: string;
        fileUrl: string | null;
        deleted: boolean;
        member: {
            profile: {
                name: string;
            };
        };
    } | null;
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
    const { onOpen } = useModal();
    const queryKey = `chat:${chatId}`;
    const chatRef = useRef<HTMLDivElement>(null);
    const bottomRef = useRef<HTMLDivElement>(null);
    const hasNextPageRef = useRef(false);
    const isFetchingNextPageRef = useRef(false);

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

    useEffect(() => {
        hasNextPageRef.current = !!hasNextPage;
    }, [hasNextPage]);

    useEffect(() => {
        isFetchingNextPageRef.current = isFetchingNextPage;
    }, [isFetchingNextPage]);

    const jumpToMessage = useCallback(async (messageId: string) => {
        const selector = `message-${messageId}`;
        const highlight = (el: HTMLElement) => {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
            el.classList.add("bg-indigo-100", "dark:bg-indigo-900/30");
            setTimeout(() => {
                el.classList.remove("bg-indigo-100", "dark:bg-indigo-900/30");
            }, 1800);
        };

        let target = document.getElementById(selector);
        if (target) {
            highlight(target);
            return;
        }

        let attempts = 0;
        const maxAttempts = 30;

        while (!target && hasNextPageRef.current && attempts < maxAttempts) {
            if (!isFetchingNextPageRef.current) {
                await fetchNextPage();
            }

            attempts += 1;
            await new Promise((resolve) => setTimeout(resolve, 80));
            target = document.getElementById(selector);
        }

        if (target) {
            highlight(target);
        }
    }, [fetchNextPage]);

    useEffect(() => {
        const handleJump = (event: Event) => {
            const customEvent = event as CustomEvent<{
                chatType: "channel" | "conversation";
                chatId: string;
                messageId: string;
            }>;

            const detail = customEvent.detail;
            if (!detail) {
                return;
            }

            if (detail.chatType !== type || detail.chatId !== paramValue) {
                return;
            }

            void jumpToMessage(detail.messageId);
        };

        window.addEventListener("chat:jump-to-message", handleJump);

        return () => {
            window.removeEventListener("chat:jump-to-message", handleJump);
        };
    }, [jumpToMessage, type, paramValue]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "f") {
                return;
            }

            event.preventDefault();

            onOpen("searchMessages", {
                channelId: type === "channel" ? paramValue : undefined,
                conversationId: type === "conversation" ? paramValue : undefined,
                type,
            });
        };

        window.addEventListener("keydown", handleKeyDown);

        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [onOpen, type, paramValue]);

    useChatSocket({
        queryKey,
        channelId: paramValue,
        serverId: socketQuery.serverId,
    });

    // Auto-scroll to bottom on new messages
    useChatScroll({
        chatRef,
        bottomRef,
        loadMore: fetchNextPage,
        shouldLoadMore: !isFetchingNextPage && !!hasNextPage,
        count: data?.pages?.[0]?.items?.length ?? 0,
        chatKey: paramValue,
    });

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
            <ChatWelcome
                type={type}
                name={name}
            />
            {!hasNextPage && <div className="flex-1"/>}
            {hasNextPage && (
                <div className="flex justify-center">
                    {isFetchingNextPage ? (
                        <Loader2 className="h-6 w-6 text-zinc-500 animate-spin my-4" />
                    ) : (
                        <button
                            onClick={() => fetchNextPage()}
                            className="text-zinc-500 hover:text-zinc-600 dark:text-zinc-400 text-xs my-4 hover:underline transition"
                        >
                            Load previous messages
                        </button>
                    )}
                </div>
            )}
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
                                isUpdated={
                                    message.updatedAt !== message.createdAt && 
                                    // Don't show "edited" if update was just for pinning
                                    (!message.pinnedAt || 
                                     Math.abs(new Date(message.updatedAt).getTime() - new Date(message.pinnedAt).getTime()) > 1000)
                                }
                                socketUrl={socketUrl}
                                socketQuery={socketQuery}
                                pinned={message.pinned}
                                pinnedAt={message.pinnedAt}
                                type={type}
                                replyTo={(message.replyToMessage || message.replyToDirectMessage)
                                    ? {
                                        id: (message.replyToMessage || message.replyToDirectMessage)!.id,
                                        content: (message.replyToMessage || message.replyToDirectMessage)!.content,
                                        fileUrl: (message.replyToMessage || message.replyToDirectMessage)!.fileUrl,
                                        deleted: (message.replyToMessage || message.replyToDirectMessage)!.deleted,
                                        authorName: (message.replyToMessage || message.replyToDirectMessage)!.member.profile.name,
                                    }
                                    : null
                                }
                                onJumpToMessage={jumpToMessage}
                            />
                        ))}
                    </Fragment>
                ))}
            </div>
            <div ref={bottomRef} />
        </div>
    );
};