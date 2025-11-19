"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

const WhiteboardCanvas = dynamic(
  () => import("./whiteboard-canvas").then((mod) => ({ default: mod.WhiteboardCanvas })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full w-full">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
        <span className="ml-2 text-zinc-500">Loading whiteboard...</span>
      </div>
    ),
  }
);

interface WhiteboardProps {
  channelId: string;
  serverId: string;
}

export const Whiteboard = ({ channelId, serverId }: WhiteboardProps) => {
  return <WhiteboardCanvas channelId={channelId} serverId={serverId} />;
};
