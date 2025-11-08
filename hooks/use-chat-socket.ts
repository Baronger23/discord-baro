import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSocket } from "@/components/providers/socket-provider";
import { SOCKET_EVENTS } from "@/lib/socket/constants";
import type { MessageWithMember, DirectMessageWithMember } from "@/lib/socket/types";

interface ChatSocketProps {
    queryKey: string;
    channelId?: string;
    serverId?: string;
}

type MessagePages = {
    pages: Array<{
        items: (MessageWithMember | DirectMessageWithMember)[];
        nextCursor?: string;
    }>;
    pageParams: unknown[];
};

export const useChatSocket = ({
    queryKey,
    channelId,
    serverId,
}: ChatSocketProps) => {
    const { socket, isConnected } = useSocket();
    const queryClient = useQueryClient();

    useEffect(() => {
        if (!socket || !isConnected || !channelId) {
            console.log('[useChatSocket] Skipping setup:', { socket: !!socket, isConnected, channelId });
            return;
        }

        // Emit custom event to join room on server side
        // For channels: use chat:join event
        // For conversations: directly join via socket.io room
        const roomName = serverId ? `channel:${channelId}` : `conversation:${channelId}`;
        
        console.log(`[useChatSocket] Joining room: ${roomName}`);
        console.log(`[useChatSocket] serverId: ${serverId}, channelId: ${channelId}`);
        console.log(`[useChatSocket] queryKey: ${queryKey}`);
        
        // Join room directly via Socket.IO
        // Server will receive this via socket.join() in io.on('connection')
        // But we need to emit an event to tell server to add us to room
        if (serverId) {
            socket.emit(SOCKET_EVENTS.CHAT_JOIN, { serverId, channelId });
            console.log(`[useChatSocket] Emitted CHAT_JOIN for channel`);
        } else {
            // For conversation, emit with fake serverId or create new event
            // For now, let's use low-level socket.io.join
            socket.emit("conversation:join", { conversationId: channelId });
            console.log(`[useChatSocket] Emitted conversation:join for conversationId: ${channelId}`);
        }

        // Listen for new messages
        const handleNewMessage = (payload: { channelId: string; message: MessageWithMember | DirectMessageWithMember }) => {
            const { channelId: messageChannelId, message } = payload;

            // Only update if message is for this channel/conversation
            if (channelId && messageChannelId !== channelId) {
                return;
            }

            queryClient.setQueryData([queryKey], (oldData: MessagePages | undefined) => {
                if (!oldData || !oldData.pages || oldData.pages.length === 0) {
                    return {
                        pages: [{
                            items: [message],
                        }],
                        pageParams: [undefined],
                    };
                }

                const newData = [...oldData.pages];
                
                // Check if message already exists (prevent duplicates)
                const messageExists = newData.some(page => 
                    page.items.some(item => item.id === message.id)
                );

                if (!messageExists) {
                    // Add new message to the first page (most recent)
                    newData[0] = {
                        ...newData[0],
                        items: [message, ...newData[0].items],
                    };
                }

                return {
                    ...oldData,
                    pages: newData,
                };
            });
        };

        // Listen for updated messages (edit/delete)
        const handleUpdateMessage = (payload: { channelId: string; message: MessageWithMember | DirectMessageWithMember }) => {
            const { channelId: messageChannelId, message } = payload;

            console.log('[useChatSocket] Received message update:', message.id);

            // Only update if message is for this channel/conversation
            if (channelId && messageChannelId !== channelId) {
                console.log('[useChatSocket] Update ignored - different channel');
                return;
            }

            let messageUpdated = false;

            queryClient.setQueryData([queryKey], (oldData: MessagePages | undefined) => {
                if (!oldData || !oldData.pages || oldData.pages.length === 0) {
                    console.log('[useChatSocket] No data to update');
                    return oldData;
                }

                // Create completely new objects to trigger React re-render
                const newPages = oldData.pages.map((page) => {
                    const newItems = page.items.map((item) => {
                        if (item.id === message.id) {
                            console.log('[useChatSocket] Updated message found and replaced');
                            messageUpdated = true;
                            // Return new message object
                            return { ...message };
                        }
                        return item;
                    });

                    // Return new page object if items changed
                    return {
                        ...page,
                        items: newItems,
                    };
                });

                // Return completely new data object
                return {
                    ...oldData,
                    pages: newPages,
                    pageParams: [...oldData.pageParams],
                };
            });

            if (messageUpdated) {
                // Force re-render by invalidating the query
                queryClient.invalidateQueries({ 
                    queryKey: [queryKey],
                    refetchType: 'none' // Don't refetch from server, just trigger re-render
                });
                
                console.log('[useChatSocket] ✅ Message updated and query invalidated');
            } else {
                console.log('[useChatSocket] ⚠️ Message not found in cache');
            }
        };

        // Register event listeners
        console.log('[useChatSocket] Registering event listeners...');
        socket.on(SOCKET_EVENTS.CHAT_MESSAGE, handleNewMessage);
        socket.on(SOCKET_EVENTS.CHAT_MESSAGE_UPDATE, handleUpdateMessage);
        console.log('[useChatSocket] ✅ Event listeners registered');

        // Cleanup
        return () => {
            console.log('[useChatSocket] Cleaning up event listeners...');
            socket.off(SOCKET_EVENTS.CHAT_MESSAGE, handleNewMessage);
            socket.off(SOCKET_EVENTS.CHAT_MESSAGE_UPDATE, handleUpdateMessage);
        };
    }, [socket, isConnected, queryClient, queryKey, channelId, serverId]);
};
