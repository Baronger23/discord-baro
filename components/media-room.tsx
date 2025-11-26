/**
 * MediaRoom Component - Custom WebRTC Implementation
 * Replaces LiveKit with Socket.IO + WebRTC
 */

"use client";

import { useEffect, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { useWebRTC } from "@/hooks/use-webrtc";
import { Mic, MicOff, Video, VideoOff, Monitor, MonitorOff, PhoneOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Instance counter for debugging
let instanceCounter = 0;

// Track all active instances to force cleanup on HMR
const activeInstances = new Set<number>();

interface MediaRoomProps {
  chatId: string;
  video: boolean;
  audio: boolean;
}

export const MediaRoom = ({ chatId, video, audio }: MediaRoomProps) => {
  const { user } = useUser();
  const displayName = `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim() || "User";

  const instanceId = useRef(++instanceCounter);
  
  // Track this instance
  useEffect(() => {
    activeInstances.add(instanceId.current);
    console.log(`[MediaRoom #${instanceId.current}] 🆕 Instance created - Total active:`, activeInstances.size);
    
    return () => {
      activeInstances.delete(instanceId.current);
      console.log(`[MediaRoom #${instanceId.current}] 💀 Instance destroyed - Remaining:`, activeInstances.size);
    };
  }, []);

  console.log(`[MediaRoom #${instanceId.current}] Component created`);

  console.log(`[MediaRoom #${instanceId.current}] Props:`, { chatId, video, audio, displayName });

  const {
    localStream,
    remoteStreams,
    participants,
    connectionState,
    isConnected,
    audioEnabled,
    videoEnabled,
    isScreenSharing,
    toggleAudio,
    toggleVideo,
    startScreenShare,
    stopScreenShare,
    joinRoom,
    leaveRoom,
    error,
  } = useWebRTC({
    roomId: chatId,
    displayName,
    audio,
    video,
    autoJoin: false,
  });

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const hasJoinedRef = useRef(false);

  console.log(`[MediaRoom #${instanceId.current}] Render - hasJoined:`, hasJoinedRef.current);

  /**
   * Join room on mount and cleanup on unmount
   */
  useEffect(() => {
    console.log(`[MediaRoom #${instanceId.current}] useEffect running - hasJoined:`, hasJoinedRef.current);

    if (hasJoinedRef.current) {
      console.log(`[MediaRoom #${instanceId.current}] Already joined, skipping`);
      return;
    }

    console.log(`[MediaRoom #${instanceId.current}] 🚀 Starting joinRoom()`);
    hasJoinedRef.current = true;
    
    joinRoom().catch(err => {
      console.error(`[MediaRoom #${instanceId.current}] joinRoom error:`, err);
      hasJoinedRef.current = false;
    });

    return () => {
      console.log(`[MediaRoom #${instanceId.current}] 🧹 Cleanup - leaving room`);
      
      // Clear video element srcObject FIRST
      if (localVideoRef.current) {
        console.log(`[MediaRoom #${instanceId.current}] 🎥 Clearing local video srcObject`);
        const stream = localVideoRef.current.srcObject as MediaStream;
        if (stream) {
          stream.getTracks().forEach(track => {
            track.stop();
            console.log(`[MediaRoom #${instanceId.current}] 🛑 Force stopped track from video element:`, track.kind);
          });
        }
        localVideoRef.current.srcObject = null;
        localVideoRef.current.load(); // Force reload video element
      }
      
      // Clear all remote video srcObjects
      remoteVideoRefs.current.forEach((videoEl, peerId) => {
        if (videoEl) {
          console.log(`[MediaRoom #${instanceId.current}] 🎥 Clearing remote video srcObject for:`, peerId);
          const stream = videoEl.srcObject as MediaStream;
          if (stream) {
            stream.getTracks().forEach(track => track.stop());
          }
          videoEl.srcObject = null;
          videoEl.load();
        }
      });
      remoteVideoRefs.current.clear();
      
      // Then leave room
      leaveRoom();
      hasJoinedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - only run on mount/unmount

  /**
   * Attach local stream to video element
   */
  useEffect(() => {
    console.log("[MediaRoom] Local stream update:", {
      hasVideoRef: !!localVideoRef.current,
      hasStream: !!localStream,
      videoTracks: localStream?.getVideoTracks().length,
      audioTracks: localStream?.getAudioTracks().length,
    });

    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
      console.log("[MediaRoom] Attached local stream to video element");
      
      // Log track states
      localStream.getTracks().forEach(track => {
        console.log(`[MediaRoom] Local track: ${track.kind} enabled=${track.enabled} readyState=${track.readyState}`);
      });
    }
  }, [localStream]);

  /**
   * Attach remote streams to video elements
   */
  useEffect(() => {
    console.log("[MediaRoom] Remote streams:", remoteStreams.size, "Participants:", participants.length);
    participants.forEach(p => console.log("[MediaRoom] Participant:", p.id, p.displayName));
    
    remoteStreams.forEach((stream, peerId) => {
      const videoElement = remoteVideoRefs.current.get(peerId);
      if (videoElement && videoElement.srcObject !== stream) {
        videoElement.srcObject = stream;
        console.log("[MediaRoom] Attached remote stream for peer:", peerId);
      }
    });
  }, [remoteStreams]);

  /**
   * Handle screen share toggle
   */
  const handleScreenShare = () => {
    if (isScreenSharing) {
      stopScreenShare();
    } else {
      startScreenShare();
    }
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-zinc-900 text-white p-8">
        <div className="text-red-500 text-xl font-semibold mb-4">Connection Error</div>
        <p className="text-zinc-400 text-center">{error.message}</p>
        <button
          onClick={joinRoom}
          className="mt-6 px-6 py-2 bg-indigo-600 rounded-md hover:bg-indigo-700 transition"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  if (connectionState === "connecting" || connectionState === "idle") {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-zinc-900 text-white">
        <Loader2 className="w-12 h-12 animate-spin text-indigo-500 mb-4" />
        <p className="text-zinc-400">Connecting to room...</p>
      </div>
    );
  }

  // Calculate grid layout based on participant count
  const totalParticipants = 1 + remoteStreams.size; // local + remote
  const gridCols = totalParticipants === 1 ? 1 : totalParticipants === 2 ? 2 : totalParticipants <= 4 ? 2 : 3;

  // Debug log
  console.log("[MediaRoom] Render state:", {
    videoEnabled,
    audioEnabled,
    hasLocalStream: !!localStream,
    isScreenSharing,
  });

  return (
    <div className="flex flex-col h-full bg-zinc-900">
      {/* Video Grid */}
      <div className="flex-1 p-2">
        <div
          className={cn(
            "grid gap-2 h-full w-full",
            gridCols === 1 && "grid-cols-1",
            gridCols === 2 && "grid-cols-2",
            gridCols === 3 && "grid-cols-3"
          )}
          style={{
            gridAutoRows: '1fr',
          }}
        >
          {/* Local Video */}
          <div className="relative bg-zinc-800 rounded-lg overflow-hidden flex items-center justify-center">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              style={{ display: 'block' }}
            />
            <div className="absolute bottom-4 left-4 bg-black/60 px-3 py-1 rounded-full text-white text-sm z-10">
              {displayName} (You){isScreenSharing && " - Sharing Screen"}
            </div>
            {/* Temporarily disable avatar overlay to debug
            {(!videoEnabled || !localStream?.getVideoTracks().find(t => t.enabled)) && !isScreenSharing && (
              <div className="absolute inset-0 flex items-center justify-center bg-zinc-800">
                <div className="w-20 h-20 rounded-full bg-indigo-600 flex items-center justify-center text-white text-3xl font-bold">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              </div>
            )}
            */}
            {isScreenSharing && (
              <div className="absolute top-4 left-4 bg-indigo-600/90 px-3 py-1 rounded-full text-white text-xs font-semibold flex items-center gap-2">
                <Monitor className="w-4 h-4" />
                Sharing Screen
              </div>
            )}
            {!audioEnabled && (
              <div className="absolute top-4 right-4">
                <MicOff className="w-5 h-5 text-red-500" />
              </div>
            )}
          </div>

          {/* Remote Videos */}
          {Array.from(remoteStreams.entries()).map(([peerId, stream]) => {
            const participant = participants.find((p) => p.id === peerId);
            const participantName = participant?.displayName || "Unknown";

            return (
              <div key={peerId} className="relative bg-zinc-800 rounded-lg overflow-hidden flex items-center justify-center">
                <video
                  ref={(el) => {
                    if (el) {
                      remoteVideoRefs.current.set(peerId, el);
                    } else {
                      remoteVideoRefs.current.delete(peerId);
                    }
                  }}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-4 left-4 bg-black/60 px-3 py-1 rounded-full text-white text-sm">
                  {participantName}
                </div>
                {participant && !participant.videoEnabled && !participant.screenSharing && (
                  <div className="absolute inset-0 flex items-center justify-center bg-zinc-800">
                    <div className="w-20 h-20 rounded-full bg-indigo-600 flex items-center justify-center text-white text-3xl font-bold">
                      {participantName.charAt(0).toUpperCase()}
                    </div>
                  </div>
                )}
                {participant?.screenSharing && (
                  <div className="absolute top-4 left-4 bg-indigo-600/90 px-3 py-1 rounded-full text-white text-xs font-semibold flex items-center gap-2">
                    <Monitor className="w-4 h-4" />
                    Sharing Screen
                  </div>
                )}
                {participant && !participant.audioEnabled && (
                  <div className="absolute top-4 right-4">
                    <MicOff className="w-5 h-5 text-red-500" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Control Bar */}
      <div className="flex items-center justify-center gap-3 px-6 py-4 bg-zinc-950 border-t border-zinc-800/50">
        {/* Audio Toggle */}
        <button
          onClick={toggleAudio}
          className={cn(
            "p-3 rounded-full transition-all duration-200",
            audioEnabled
              ? "bg-zinc-700/80 hover:bg-zinc-600 text-white"
              : "bg-red-600 hover:bg-red-700 text-white"
          )}
          title={audioEnabled ? "Mute" : "Unmute"}
        >
          {audioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
        </button>

        {/* Video Toggle */}
        <button
          onClick={toggleVideo}
          className={cn(
            "p-3 rounded-full transition-all duration-200",
            videoEnabled
              ? "bg-zinc-700/80 hover:bg-zinc-600 text-white"
              : "bg-red-600 hover:bg-red-700 text-white"
          )}
          title={videoEnabled ? "Stop Video" : "Start Video"}
        >
          {videoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
        </button>

        {/* Screen Share Toggle */}
        <button
          onClick={handleScreenShare}
          className={cn(
            "p-3 rounded-full transition-all duration-200",
            isScreenSharing
              ? "bg-green-600 hover:bg-green-700 text-white"
              : "bg-zinc-700/80 hover:bg-zinc-600 text-white"
          )}
          title={isScreenSharing ? "Stop Sharing" : "Share Screen"}
        >
          {isScreenSharing ? <MonitorOff className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
        </button>

        {/* Leave Call */}
        <button
          onClick={leaveRoom}
          className="p-3 rounded-full bg-red-600 hover:bg-red-700 text-white transition-all duration-200"
          title="Leave Call"
        >
          <PhoneOff className="w-5 h-5" />
        </button>
      </div>

      {/* Participant Count */}
      <div className="absolute top-4 left-4 bg-black/60 px-4 py-2 rounded-full text-white text-sm">
        {totalParticipants} {totalParticipants === 1 ? "participant" : "participants"}
      </div>
    </div>
  );
};
