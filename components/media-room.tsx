"use client";

import { useEffect, useState } from "react";
import { LiveKitRoom, VideoConference } from "@livekit/components-react";
import "@livekit/components-styles";
import styles from "./media-room.module.css";
import { useUser } from "@clerk/nextjs";
import { Loader2 } from "lucide-react";

interface MediaRoomProps {
    chatId: string;
    video: boolean;
    audio: boolean;
};

export const MediaRoom = ({ chatId, video, audio }: MediaRoomProps) => {
    const { user } = useUser();
    const [token, setToken] = useState("");
    const [error, setError] = useState("");

    useEffect(() => {
        const name = `${user?.firstName ?? ""} ${user?.lastName ?? ""}`;
        (async () => {
            try {
                const resp = await fetch(`/api/livekit?room=${chatId}&username=${encodeURIComponent(name)}`);
                const data = await resp.json();
                setToken(data.token);

            } catch (error) {
                console.error("Failed to fetch LiveKit token:", error);
                setError("Failed to connect to video room");
            }
        })();
        
    }, [user?.firstName, user?.lastName, chatId]);
    
    if (error) {
        return (
            <div className="flex flex-col flex-1 items-center justify-center">
                <p className="text-sm text-red-500">{error}</p>
            </div>
        );
    }
    
    if (token === "") {
        return (
            <div className="flex flex-col flex-1 items-center justify-center">
                <Loader2 className="h-7 w-7 text-zinc-500 animate-spin my-4" />
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Connecting to video...</p>
            </div>
        );
    }


    return (
        <div className={`${styles.mediaRoom}`}>
            <LiveKitRoom
                data-lk-theme="default"
                serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL!}
                token={token}
                connect={true}
                video={video}
                audio={audio}
                onError={(error) => {
                    console.error("LiveKit error:", error);
                    setError("Video connection error. Please refresh the page.");
                }}
            >
                <VideoConference />
            </LiveKitRoom>
        </div>
    );
}
