"use client";

import { Pin } from "lucide-react";
import { ActionTooltip } from "@/components/ui/action-tooltip";
import { useModal } from "@/hooks/use-modal-store";
import { useEffect, useState } from "react";
import axios from "axios";

interface PinnedMessagesButtonProps {
  channelId: string;
}

export const PinnedMessagesButton = ({ channelId }: PinnedMessagesButtonProps) => {
  const { onOpen } = useModal();
  const [pinnedCount, setPinnedCount] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchPinnedCount();
    // Poll every 10 seconds
    const interval = setInterval(fetchPinnedCount, 10000);
    return () => clearInterval(interval);
  }, [channelId]);

  const fetchPinnedCount = async () => {
    if (loading) return;

    try {
      setLoading(true);
      const response = await axios.get(`/api/channels/${channelId}/pinned`);
      setPinnedCount(response.data.length);
    } catch (error) {
      console.error("Failed to fetch pinned count:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ActionTooltip label={pinnedCount > 0 ? `${pinnedCount} Pinned Messages` : "No Pinned Messages"}>
      <button
        onClick={() => onOpen("viewPinnedMessages", { channelId })}
        className="relative group p-2 rounded-md hover:bg-zinc-700/10 dark:hover:bg-zinc-700/50 transition"
      >
        <Pin className="w-5 h-5 text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition" />
        {pinnedCount > 0 && (
          <span className="absolute -top-1 -right-1 h-4 w-4 bg-indigo-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {pinnedCount > 9 ? '9+' : pinnedCount}
          </span>
        )}
      </button>
    </ActionTooltip>
  );
};
