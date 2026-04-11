"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Video, VideoOff } from "lucide-react";
import { ActionTooltip } from "@/components/ui/action-tooltip";
import { useSocket } from "@/components/providers/socket-provider";
import { useUser } from "@clerk/nextjs";

interface ChatVideoButtonProps {
  conversationId?: string;
  memberId?: string;
}

export const ChatVideoButton = ({ conversationId, memberId }: ChatVideoButtonProps) => {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { socket } = useSocket();
  const { user } = useUser();
  const [isLoading, setIsLoading] = useState(false);
  const hasEmittedEndRef = useRef(false);

  const isVideo = searchParams?.get("video");

  const emitEndCall = useCallback(() => {
    if (!socket || !conversationId || !memberId || hasEmittedEndRef.current) {
      return;
    }

    socket.emit("call:end", {
      conversationId,
      calleeId: memberId,
      timestamp: Date.now(),
    });
    hasEmittedEndRef.current = true;
  }, [socket, conversationId, memberId]);

  useEffect(() => {
    if (isVideo) {
      setIsLoading(false);
      hasEmittedEndRef.current = false;
    }
  }, [isVideo]);

  useEffect(() => {
    return () => {
      if (isVideo) {
        emitEndCall();
      }
    };
  }, [isVideo, emitEndCall]);

  useEffect(() => {
    if (!socket || !conversationId) {
      return;
    }

    const handleCallEnded = (payload: { conversationId: string; timestamp: number }) => {
      if (payload.conversationId !== conversationId || !isVideo) {
        return;
      }

      hasEmittedEndRef.current = true;

      const url = qs.stringifyUrl(
        {
          url: pathname || "",
          query: {
            video: undefined,
          },
        },
        { skipNull: true }
      );

      setIsLoading(false);
      router.push(url);
    };

    const handleCallDeclined = (payload: { callId: string; conversationId: string }) => {
      if (payload.conversationId !== conversationId || !isVideo) {
        return;
      }

      hasEmittedEndRef.current = true;

      const url = qs.stringifyUrl(
        {
          url: pathname || "",
          query: {
            video: undefined,
          },
        },
        { skipNull: true }
      );

      setIsLoading(false);
      router.push(url);
    };

    socket.on("call:ended", handleCallEnded);
    socket.on("call:declined", handleCallDeclined);

    return () => {
      socket.off("call:ended", handleCallEnded);
      socket.off("call:declined", handleCallDeclined);
    };
  }, [socket, conversationId, isVideo, pathname, router]);

  const onClick = useCallback(async () => {
    if (!isVideo && conversationId && memberId && socket && user) {
      // Initiating a call - emit call:incoming
      setIsLoading(true);

      try {
        socket.emit("call:initiate", {
          conversationId,
          calleeId: memberId,
          callerName:
            user.firstName ||
            user.primaryEmailAddress?.emailAddress ||
            "Unknown",
          callerAvatar: user.imageUrl,
          timestamp: Date.now(),
        });

        // Navigate to video room immediately
        const url = pathname + "?video=true";
        router.push(url);
        setIsLoading(false);
      } catch (error) {
        console.error("Failed to initiate call:", error);
        setIsLoading(false);
      }
    } else if (isVideo) {
      // Ending the call - notify the other user
      emitEndCall();
      
      // Remove video query param
      const url = qs.stringifyUrl(
        {
          url: pathname || "",
          query: {
            video: undefined,
          },
        },
        { skipNull: true }
      );
      setIsLoading(false);
      router.push(url);
    }
  }, [isVideo, conversationId, memberId, socket, user, pathname, router, emitEndCall]);

  const Icon = isVideo ? VideoOff : Video;
  const tooltipLabel = isVideo
    ? "End video call"
    : isLoading
      ? "Calling..."
      : "Start video call";

  return (
    <ActionTooltip side="bottom" label={tooltipLabel}>
      <button
        title={tooltipLabel}
        onClick={onClick}
        disabled={!isVideo && isLoading}
        className="hover:opacity-75 transition mr-4 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Icon className="h-6 w-6 text-zinc-500 dark:text-zinc-400" />
      </button>
    </ActionTooltip>
  );
};

// Helper: Query string utilities
const qs = {
  stringifyUrl: (
    obj: { url: string; query: any },
    options?: { skipNull?: boolean }
  ) => {
    const { url, query } = obj;
    const params = new URLSearchParams();

    Object.entries(query).forEach(([key, value]) => {
      if (options?.skipNull && value === undefined) {
        return;
      }
      if (value !== undefined) {
        params.append(key, String(value));
      }
    });

    const queryString = params.toString();
    return queryString ? `${url}?${queryString}` : url;
  },
};