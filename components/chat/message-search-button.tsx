"use client";

import { Search } from "lucide-react";
import { ActionTooltip } from "@/components/ui/action-tooltip";
import { useModal } from "@/hooks/use-modal-store";

interface MessageSearchButtonProps {
  channelId?: string;
  conversationId?: string;
  type: "channel" | "conversation";
}

export const MessageSearchButton = ({
  channelId,
  conversationId,
  type,
}: MessageSearchButtonProps) => {
  const { onOpen } = useModal();

  return (
    <ActionTooltip label="Search Messages">
      <button
        title="search-messages"
        onClick={() =>
          onOpen("searchMessages", {
            channelId: type === "channel" ? channelId : undefined,
            conversationId: type === "conversation" ? conversationId : undefined,
            type,
          })
        }
        className="group p-2 rounded-md hover:bg-zinc-700/10 dark:hover:bg-zinc-700/50 transition"
      >
        <Search className="w-5 h-5 text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition" />
      </button>
    </ActionTooltip>
  );
};
