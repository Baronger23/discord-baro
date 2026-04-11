import { Hash } from "lucide-react";
import { MobileToggle } from "@/components/ui/mobile-toggle";
import { UserAvatar } from "@/components/user-avatar";
import { SocketIndicator } from "@/components/socket-indicator";
import { ChatVideoButton } from "@/components/chat/chat-video-button";
import { PinnedMessagesButton } from "@/components/chat/pinned-messages-button";
import { MessageSearchButton } from "@/components/chat/message-search-button";

interface ChatHeaderProps {
    serverId: string;
    name: string;
    type: "channel" | "conversation";
    imageUrl?: string;
    channelId?: string;
    conversationId?: string;
    memberId?: string;
}

export const ChatHeader = ({
    serverId,
    name,
    type,
    imageUrl,
    channelId,
    conversationId,
    memberId
}: ChatHeaderProps) => {
    
    return (
        <div className="text-md font-semibold px-3 flex items-center h-12
        border-neutral-200 dark:border-neutral-800 border-b">
            <MobileToggle serverId={serverId} />
            {
                type === "channel" && (
                    <Hash className="w-5 h-5 text-zinc-500 dark:text-zinc-400 mr-2"/>
                )
            }
            {type === "conversation" && imageUrl && (
                <UserAvatar 
                    src={imageUrl}
                    className="w-8 h-8 md:h-8 md:w-8 mr-2"
                />
            )}
            <p className="font-semibold text-md text-black dark:text-white">
                {name}
            </p>
            <div className="ml-auto flex items-center gap-x-2">
                {type === "channel" && channelId && (
                    <PinnedMessagesButton channelId={channelId} type="channel" />
                )}
                {type === "conversation" && conversationId && (
                    <PinnedMessagesButton conversationId={conversationId} type="conversation" />
                )}
                {type === "channel" && channelId && (
                    <MessageSearchButton channelId={channelId} type="channel" />
                )}
                {type === "conversation" && conversationId && (
                    <MessageSearchButton conversationId={conversationId} type="conversation" />
                )}
                {type === "conversation" && (
                  <ChatVideoButton conversationId={conversationId} memberId={memberId} />  
                )}
                <SocketIndicator />
            </div>
        </div>
    );
}