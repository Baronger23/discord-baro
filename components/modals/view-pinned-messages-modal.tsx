"use client";

import axios from "axios";
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useModal } from "@/hooks/use-modal-store";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Pin, X, Loader2, FileIcon } from "lucide-react";
import { format } from "date-fns";
import Image from "next/image";
import { useRouter } from "next/navigation";

interface PinnedMessage {
  id: string;
  content: string;
  fileUrl: string | null;
  pinned: boolean;
  pinnedAt: Date | null;
  createdAt: Date;
  member: {
    id: string;
    role: string;
    profile: {
      id: string;
      name: string;
      imageUrl: string;
    };
  };
}

export const ViewPinnedMessagesModal = () => {
  const { isOpen, onClose, type, data } = useModal();
  const router = useRouter();

  const isModalOpen = isOpen && type === "viewPinnedMessages";
  const { channelId, conversationId, type: chatType = "channel" } = data;

  const [loading, setLoading] = useState(false);
  const [pinnedMessages, setPinnedMessages] = useState<PinnedMessage[]>([]);

  const targetId = chatType === "channel" ? channelId : conversationId;

  useEffect(() => {
    if (isModalOpen && targetId) {
      fetchPinnedMessages();
    }
  }, [isModalOpen, targetId]);

  const fetchPinnedMessages = async () => {
    if (!targetId) return;

    try {
      setLoading(true);
      const endpoint = chatType === "channel"
        ? `/api/channels/${targetId}/pinned`
        : `/api/conversations/${targetId}/pinned`;
      
      const response = await axios.get(endpoint);
      setPinnedMessages(response.data);
    } catch (error) {
      console.error("Failed to fetch pinned messages:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUnpin = async (messageId: string) => {
    try {
      const endpoint = chatType === "channel"
        ? `/api/messages/${messageId}/pin`
        : `/api/direct-messages/${messageId}/pin`;
      
      await axios.delete(endpoint);
      await fetchPinnedMessages(); // Refresh list
      router.refresh();
    } catch (error) {
      console.error("Failed to unpin message:", error);
    }
  };

  const handleScrollToMessage = (messageId: string) => {
    // Close modal first
    onClose();
    
    // Wait for modal animation to complete, then scroll
    setTimeout(() => {
      const messageElement = document.getElementById(`message-${messageId}`);
      if (messageElement) {
        messageElement.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center' 
        });
        
        // Highlight the message briefly
        messageElement.classList.add('bg-indigo-100', 'dark:bg-indigo-900/30');
        setTimeout(() => {
          messageElement.classList.remove('bg-indigo-100', 'dark:bg-indigo-900/30');
        }, 2000);
      }
    }, 300);
  };

  const handleClose = () => {
    setPinnedMessages([]);
    onClose();
  };

  const isImage = (url: string | null) => {
    if (!url) return false;
    return /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
  };

  const isPDF = (url: string | null) => {
    if (!url) return false;
    return /\.pdf$/i.test(url);
  };

  return (
    <Dialog open={isModalOpen} onOpenChange={handleClose}>
      <DialogContent className="bg-white dark:bg-[#313338] text-black dark:text-white p-0 overflow-hidden max-w-3xl">
        <DialogHeader className="pt-8 px-6">
          <DialogTitle className="text-2xl text-center font-bold flex items-center justify-center gap-x-2">
            <Pin className="h-6 w-6 text-indigo-500" />
            Pinned Messages
          </DialogTitle>
          <DialogDescription className="text-center text-zinc-500 dark:text-zinc-400">
            {pinnedMessages.length} pinned message{pinnedMessages.length !== 1 ? "s" : ""}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
          </div>
        ) : pinnedMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <Pin className="h-12 w-12 text-zinc-400 mb-2" />
            <p className="text-zinc-500 dark:text-zinc-400">No pinned messages in this channel</p>
          </div>
        ) : (
          <ScrollArea className="max-h-[500px] px-6 pb-6">
            <div className="space-y-4">
              {pinnedMessages.map((message) => (
                <div
                  key={message.id}
                  onClick={() => handleScrollToMessage(message.id)}
                  className="flex gap-x-3 p-4 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition group cursor-pointer"
                >
                  {/* Avatar */}
                  <div className="flex-shrink-0">
                    <div className="relative h-10 w-10 rounded-full overflow-hidden">
                      <Image
                        src={message.member.profile.imageUrl}
                        alt={message.member.profile.name}
                        fill
                        className="object-cover"
                      />
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-x-2 mb-1">
                      <span className="font-semibold text-sm text-zinc-800 dark:text-zinc-200">
                        {message.member.profile.name}
                      </span>
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">
                        {format(new Date(message.createdAt), "MMM d, yyyy 'at' h:mm a")}
                      </span>
                    </div>

                    <p className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap break-words">
                      {message.content}
                    </p>

                    {/* File attachment */}
                    {message.fileUrl && (
                      <div className="mt-2">
                        {isImage(message.fileUrl) ? (
                          <a
                            href={message.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="relative block max-w-sm rounded-md overflow-hidden"
                          >
                            <Image
                              src={message.fileUrl}
                              alt="Attachment"
                              width={400}
                              height={300}
                              className="object-cover"
                            />
                          </a>
                        ) : (
                          <a
                            href={message.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-x-2 p-2 rounded-md bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 transition w-fit"
                          >
                            <FileIcon className="h-5 w-5 text-indigo-500" />
                            <span className="text-sm text-indigo-500 hover:underline">
                              {isPDF(message.fileUrl) ? "PDF File" : "File Attachment"}
                            </span>
                          </a>
                        )}
                      </div>
                    )}

                    {message.pinnedAt && (
                      <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-2 flex items-center gap-x-1">
                        <Pin className="h-3 w-3" />
                        Pinned {format(new Date(message.pinnedAt), "MMM d, yyyy")}
                      </p>
                    )}
                  </div>

                  {/* Unpin button */}
                  <div className="flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation(); // Prevent scroll when clicking unpin
                        handleUnpin(message.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 transition h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                      title="Unpin message"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
};
