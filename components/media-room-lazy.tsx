"use client";

import React from "react";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

// Loading fallback cho MediaRoom
const MediaRoomLoading = () => (
    <div className="flex flex-col flex-1 items-center justify-center">
        <Loader2 className="h-7 w-7 text-zinc-500 animate-spin my-4" />
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Loading video room...
        </p>
    </div>
);

// Lazy load MediaRoom với loading fallback
// LiveKit là thư viện rất nặng (~500KB), chỉ load khi cần
const MediaRoom = dynamic(
    () => import("@/components/media-room").then(mod => ({ default: mod.MediaRoom })),
    {
        ssr: false,
        loading: () => <MediaRoomLoading />
    }
);

interface MediaRoomLazyProps {
    chatId: string;
    video: boolean;
    audio: boolean;
}

// Wrap với React.memo để ngăn re-render không cần thiết
export const MediaRoomLazy = React.memo(({ chatId, video, audio }: MediaRoomLazyProps) => {
    console.log('[MediaRoomLazy] Rendering with chatId:', chatId);
    return <MediaRoom chatId={chatId} video={video} audio={audio} />;
});
