/**
 * MediaRoom Component - Custom WebRTC Implementation
 * Replaces LiveKit with Socket.IO + WebRTC
 */

"use client";

import { useEffect, useRef, useState } from "react";
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
    localScreenStream,
    remoteStreams,
    remoteScreenStreams,
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
  const localScreenVideoRef = useRef<HTMLVideoElement | null>(null);
  const localCameraThumbnailRef = useRef<HTMLVideoElement | null>(null); // Separate ref for thumbnail
  const remoteVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const remoteScreenVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const hasJoinedRef = useRef(false);
  const [hasLeft, setHasLeft] = useState(false);

  console.log(`[MediaRoom #${instanceId.current}] Render - hasJoined:`, hasJoinedRef.current);

  /**
   * Join room on mount and cleanup on unmount
   */
  useEffect(() => {
    console.log(`[MediaRoom #${instanceId.current}] useEffect running - hasJoined:`, hasJoinedRef.current, "hasLeft:", hasLeft);

    // Don't join if user has manually left
    if (hasLeft) {
      console.log(`[MediaRoom #${instanceId.current}] User has left, skipping join`);
      return;
    }

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

      // Clear local screen video
      if (localScreenVideoRef.current) {
        console.log(`[MediaRoom #${instanceId.current}] 🎥 Clearing local screen video srcObject`);
        const stream = localScreenVideoRef.current.srcObject as MediaStream;
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
        localScreenVideoRef.current.srcObject = null;
        localScreenVideoRef.current.load();
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

      // Clear all remote screen video srcObjects
      remoteScreenVideoRefs.current.forEach((videoEl, peerId) => {
        if (videoEl) {
          console.log(`[MediaRoom #${instanceId.current}] 🎥 Clearing remote screen video srcObject for:`, peerId);
          const stream = videoEl.srcObject as MediaStream;
          if (stream) {
            stream.getTracks().forEach(track => track.stop());
          }
          videoEl.srcObject = null;
          videoEl.load();
        }
      });
      remoteScreenVideoRefs.current.clear();
      
      // Then leave room
      leaveRoom();
      hasJoinedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasLeft]); // Add hasLeft to re-run when user reconnects

  /**
   * Attach local stream to video element
   */
  useEffect(() => {
    console.log("[MediaRoom] 📹 Local stream update:", {
      hasVideoRef: !!localVideoRef.current,
      hasStream: !!localStream,
      videoTracks: localStream?.getVideoTracks().length,
      audioTracks: localStream?.getAudioTracks().length,
      isScreenSharing,
      currentSrcObject: localVideoRef.current?.srcObject,
    });

    if (localVideoRef.current && localStream) {
      // Always re-attach, especially when transitioning from dual stream mode
      if (localVideoRef.current.srcObject !== localStream) {
        localVideoRef.current.srcObject = localStream;
        console.log("[MediaRoom] ✅ Attached local stream to video element");
        
        // Force play when metadata is loaded
        localVideoRef.current.onloadedmetadata = () => {
          localVideoRef.current?.play().catch(e => {
            console.error("[MediaRoom] ❌ Local video play error:", e);
          });
        };
      }
      
      // Log track states
      localStream.getTracks().forEach(track => {
        console.log(`[MediaRoom] Local track: ${track.kind} enabled=${track.enabled} readyState=${track.readyState}`);
      });
    }
  }, [localStream, isScreenSharing]); // Add isScreenSharing as dependency to re-attach when mode changes

  /**
   * Attach local screen stream to video element
   */
  useEffect(() => {
    console.log("[MediaRoom] 📺 Local screen stream update:", {
      hasScreenVideoRef: !!localScreenVideoRef.current,
      hasScreenStream: !!localScreenStream,
      videoTracks: localScreenStream?.getVideoTracks().length,
      isScreenSharing,
    });

    if (localScreenVideoRef.current) {
      if (localScreenStream) {
        // Set screen stream
        localScreenVideoRef.current.srcObject = localScreenStream;
        console.log("[MediaRoom] 📺 Attached local screen stream to video element");
        
        // Force play when metadata is loaded
        localScreenVideoRef.current.onloadedmetadata = () => {
          localScreenVideoRef.current?.play().catch(e => {
            console.error("[MediaRoom] ❌ Screen video play error:", e);
          });
        };
        
        // Log track info
        localScreenStream.getVideoTracks().forEach(track => {
          console.log(`[MediaRoom] Screen track: ${track.kind} label=${track.label} readyState=${track.readyState}`);
        });
      } else {
        // Clear when stopping screen share
        console.log("[MediaRoom] 🧹 Clearing local screen video element (no screen stream)");
        localScreenVideoRef.current.srcObject = null;
      }
    }
  }, [localScreenStream, isScreenSharing]);

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
        console.log("[MediaRoom] 🎥 Attached remote camera stream for peer:", peerId);
        
        // Force play when metadata is loaded
        videoElement.onloadedmetadata = () => {
          videoElement.play().catch(e => {
            console.error(`[MediaRoom] ❌ Remote video play error for ${peerId}:`, e);
          });
        };
      }
    });
  }, [remoteStreams, participants]);

  /**
   * Attach remote screen streams to video elements
   */
  useEffect(() => {
    console.log("[MediaRoom] Remote screen streams:", remoteScreenStreams.size);
    
    remoteScreenStreams.forEach((stream, peerId) => {
      const videoElement = remoteScreenVideoRefs.current.get(peerId);
      if (videoElement && videoElement.srcObject !== stream) {
        videoElement.srcObject = stream;
        console.log("[MediaRoom] 📺 Attached remote screen stream for peer:", peerId);
        
        // Force play when metadata is loaded
        videoElement.onloadedmetadata = () => {
          videoElement.play().catch(e => {
            console.error(`[MediaRoom] ❌ Remote screen video play error for ${peerId}:`, e);
          });
        };
      }
    });
  }, [remoteScreenStreams]);

  /**
   * Handle leave room
   */
  const handleLeaveRoom = () => {
    leaveRoom();
    setHasLeft(true);
    hasJoinedRef.current = false;
  };

  /**
   * Handle reconnect
   */
  const handleReconnect = () => {
    setHasLeft(false);
    hasJoinedRef.current = false;
    joinRoom().catch(err => {
      console.error("Reconnect error:", err);
    });
  };

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

  // Show disconnected state if user has left
  if (hasLeft) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-zinc-900 text-white p-8">
        <div className="max-w-md w-full bg-zinc-800 rounded-lg p-8 text-center">
          <div className="mb-6">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-zinc-700 flex items-center justify-center">
              <PhoneOff className="w-10 h-10 text-red-500" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Đã rời khỏi phòng</h2>
            <p className="text-zinc-400">Bạn đã thoát khỏi cuộc gọi video</p>
          </div>
          <button
            onClick={handleReconnect}
            className="w-full px-6 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-lg font-semibold transition-colors duration-200"
          >
            Kết nối lại
          </button>
        </div>
      </div>
    );
  }

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
  const hasAnyScreenShare = isScreenSharing || remoteScreenStreams.size > 0;
  // Better grid logic: 1→1col, 2→2cols, 3→3cols, 4→2cols (2x2), 5+→3cols
  const gridCols = 
    totalParticipants === 1 ? 1 : 
    totalParticipants === 2 ? 2 : 
    totalParticipants === 3 ? 3 :
    totalParticipants === 4 ? 2 : 3;

  // Debug log - track state changes
  console.log("[MediaRoom] 🎬 Render state:", {
    videoEnabled,
    audioEnabled,
    hasLocalStream: !!localStream,
    isScreenSharing,
    hasLocalScreenStream: !!localScreenStream,
    remoteScreenStreamsCount: remoteScreenStreams.size,
    hasAnyScreenShare,
    localStreamTracks: localStream?.getTracks().length,
    localScreenStreamTracks: localScreenStream?.getTracks().length,
  });

  // Render function for camera thumbnail (small overlay)
  const renderCameraThumbnail = (
    stream: MediaStream | null,
    name: string,
    isLocal: boolean = false,
    videoEnabled: boolean = true,
    audioEnabled: boolean = true
  ) => {
    // Create a ref callback to set srcObject
    const videoRefCallback = (el: HTMLVideoElement | null) => {
      if (el && stream && el.srcObject !== stream) {
        el.srcObject = stream;
        console.log(`[MediaRoom] 📹 Set camera thumbnail srcObject for ${name}`);
      }
      // Save to separate thumbnail ref if local (don't override main localVideoRef)
      if (isLocal && el) {
        localCameraThumbnailRef.current = el;
      }
    };

    return (
      <div className="absolute bottom-4 right-4 w-48 h-36 bg-zinc-800 rounded-lg overflow-hidden border-2 border-zinc-700 z-20 shadow-2xl">
        <video
          ref={videoRefCallback}
          autoPlay
          playsInline
          muted={isLocal}
          className="w-full h-full object-cover"
          style={isLocal ? { transform: 'scaleX(-1)' } : undefined}
        />
        {!videoEnabled && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-800">
            <div className="w-12 h-12 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xl font-bold">
              {name.charAt(0).toUpperCase()}
            </div>
          </div>
        )}
        <div className="absolute bottom-2 left-2 bg-black/80 px-2 py-1 rounded text-white text-xs">
          {name}{isLocal && " (You)"}
        </div>
        {!audioEnabled && (
          <div className="absolute top-2 right-2">
            <MicOff className="w-3 h-3 text-red-500" />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-zinc-900">
      {/* Video Grid */}
      <div className="flex-1 p-2 overflow-hidden flex items-center justify-center">
        {hasAnyScreenShare ? (
          /* DUAL STREAM MODE: Screen share layout (Discord style) */
          <div className="w-full flex flex-col gap-2" style={{ maxHeight: '100%' }}>
            {/* Main screen share area - limited height to keep bottom bar visible */}
            <div className="flex gap-2" style={{ height: '65vh', maxHeight: '65vh' }}>
              {/* Local screen share (if active) */}
              {isScreenSharing && localScreenStream && (
                <div className="relative flex-1 bg-zinc-800 rounded-lg overflow-hidden flex items-center justify-center">
                  <video
                    ref={localScreenVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-contain"
                  />
                  <div className="absolute top-4 left-4 bg-indigo-600/90 px-3 py-1 rounded-full text-white text-sm font-semibold flex items-center gap-2 z-10">
                    <Monitor className="w-4 h-4" />
                    Your Screen
                  </div>
                  {/* Camera thumbnail overlay - always show */}
                  {localStream && (
                    renderCameraThumbnail(localStream, displayName, true, videoEnabled, audioEnabled)
                  )}
                </div>
              )}

              {/* Remote screen shares */}
              {Array.from(remoteScreenStreams.entries()).map(([peerId, screenStream]) => {
                const participant = participants.find((p) => p.id === peerId);
                const participantName = participant?.displayName || "Unknown";
                const cameraStream = remoteStreams.get(peerId);

                return (
                  <div 
                    key={`screen-${peerId}-${screenStream.id}`} 
                    className="relative flex-1 bg-zinc-800 rounded-lg overflow-hidden flex items-center justify-center"
                  >
                    <video
                      ref={(el) => {
                        if (el) {
                          // Set srcObject immediately
                          if (el.srcObject !== screenStream) {
                            el.srcObject = screenStream;
                            console.log(`[MediaRoom] 🖥️ Set remote SCREEN srcObject for ${participantName}`);
                          }
                          remoteScreenVideoRefs.current.set(peerId, el);
                        } else {
                          remoteScreenVideoRefs.current.delete(peerId);
                        }
                      }}
                      autoPlay
                      playsInline
                      className="w-full h-full object-contain"
                    />
                    <div className="absolute top-4 left-4 bg-green-600/90 px-3 py-1 rounded-full text-white text-sm font-semibold flex items-center gap-2 z-10">
                      <Monitor className="w-4 h-4" />
                      {participantName}'s Screen
                    </div>
                    {/* Camera thumbnail overlay - always show if camera stream exists */}
                    {cameraStream && (
                      <div className="absolute bottom-4 right-4 w-48 h-36 bg-zinc-800 rounded-lg overflow-hidden border-2 border-zinc-700 z-20 shadow-2xl">
                        <video
                          ref={(el) => {
                            if (el && cameraStream && el.srcObject !== cameraStream) {
                              el.srcObject = cameraStream;
                              remoteVideoRefs.current.set(peerId, el);
                            }
                          }}
                          autoPlay
                          playsInline
                          className="w-full h-full object-cover"
                        />
                        {participant && !participant.videoEnabled && (
                          <div className="absolute inset-0 flex items-center justify-center bg-zinc-800">
                            <div className="w-12 h-12 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xl font-bold">
                              {participantName.charAt(0).toUpperCase()}
                            </div>
                          </div>
                        )}
                        <div className="absolute bottom-2 left-2 bg-black/80 px-2 py-1 rounded text-white text-xs">
                          {participantName}
                        </div>
                        {participant && !participant.audioEnabled && (
                          <div className="absolute top-2 right-2">
                            <MicOff className="w-3 h-3 text-red-500" />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Bottom bar with other participants (who are NOT screen sharing) */}
            {(!isScreenSharing || remoteStreams.size > remoteScreenStreams.size) && (
              <div className="flex-shrink-0 h-36 flex gap-2 overflow-x-auto">
                {/* Local camera (if not screen sharing) */}
                {!isScreenSharing && localStream && (
                  <div className="relative w-48 flex-shrink-0 bg-zinc-800 rounded-lg overflow-hidden">
                    <video
                      ref={localVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                      style={{ transform: 'scaleX(-1)' }}
                    />
                    {!videoEnabled && (
                      <div className="absolute inset-0 flex items-center justify-center bg-zinc-800">
                        <div className="w-12 h-12 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xl font-bold">
                          {displayName.charAt(0).toUpperCase()}
                        </div>
                      </div>
                    )}
                    <div className="absolute bottom-2 left-2 bg-black/80 px-2 py-1 rounded text-white text-xs">
                      {displayName} (You)
                    </div>
                    {!audioEnabled && (
                      <div className="absolute top-2 right-2">
                        <MicOff className="w-3 h-3 text-red-500" />
                      </div>
                    )}
                  </div>
                )}

                {/* Remote cameras (who are NOT screen sharing) */}
                {Array.from(remoteStreams.entries())
                  .filter(([peerId]) => !remoteScreenStreams.has(peerId))
                  .map(([peerId, stream]) => {
                    const participant = participants.find((p) => p.id === peerId);
                    const participantName = participant?.displayName || "Unknown";

                    return (
                      <div 
                        key={`camera-${peerId}-${stream.id}`} 
                        className="relative w-48 flex-shrink-0 bg-zinc-800 rounded-lg overflow-hidden"
                      >
                        <video
                          ref={(el) => {
                            if (el) {
                              // Set srcObject immediately
                              if (el.srcObject !== stream) {
                                el.srcObject = stream;
                                console.log(`[MediaRoom] 📹 Set remote camera srcObject for ${participantName} in bottom bar`);
                              }
                              remoteVideoRefs.current.set(peerId, el);
                            } else {
                              remoteVideoRefs.current.delete(peerId);
                            }
                          }}
                          autoPlay
                          playsInline
                          className="w-full h-full object-cover"
                        />
                        {participant && !participant.videoEnabled && (
                          <div className="absolute inset-0 flex items-center justify-center bg-zinc-800">
                            <div className="w-12 h-12 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xl font-bold">
                              {participantName.charAt(0).toUpperCase()}
                            </div>
                          </div>
                        )}
                        <div className="absolute bottom-2 left-2 bg-black/80 px-2 py-1 rounded text-white text-xs">
                          {participantName}
                        </div>
                        {participant && !participant.audioEnabled && (
                          <div className="absolute top-2 right-2">
                            <MicOff className="w-3 h-3 text-red-500" />
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        ) : (
          /* NORMAL MODE: Grid layout (no screen share) */
          <div
            className="h-full w-full p-4 flex items-center justify-center"
            style={{ maxHeight: '80vh' }}
          >
            <div
              className={cn(
                "grid gap-4 w-full",
                gridCols === 1 && "grid-cols-1",
                gridCols === 2 && "grid-cols-2",
                gridCols === 3 && "grid-cols-3"
              )}
              style={{
                maxHeight: '100%',
                maxWidth: '100%',
                // Better height management for 3 columns
                gridAutoRows: gridCols === 3 ? 'minmax(0, 1fr)' : 'auto',
              }}
            >
            {/* Local Video */}
            <div className="relative bg-zinc-800 rounded-lg overflow-hidden flex items-center justify-center" style={{ aspectRatio: '16/9', minHeight: 0 }}>
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-contain"
                style={{ transform: 'scaleX(-1)' }}
              />
              <div className="absolute bottom-4 left-4 bg-black/60 px-3 py-1 rounded-full text-white text-sm z-10">
                {displayName} (You)
              </div>
              {!videoEnabled && (
                <div className="absolute inset-0 flex items-center justify-center bg-zinc-800">
                  <div className="w-20 h-20 rounded-full bg-indigo-600 flex items-center justify-center text-white text-3xl font-bold">
                    {displayName.charAt(0).toUpperCase()}
                  </div>
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
                <div 
                  key={`${peerId}-${stream.id}`} 
                  className="relative bg-zinc-800 rounded-lg overflow-hidden flex items-center justify-center" 
                  style={{ aspectRatio: '16/9', minHeight: 0 }}
                >
                  <video
                    ref={(el) => {
                      if (el) {
                        // Set srcObject immediately
                        if (el.srcObject !== stream) {
                          el.srcObject = stream;
                          console.log(`[MediaRoom] 📹 Set remote camera srcObject for ${participantName} in grid layout`);
                        }
                        remoteVideoRefs.current.set(peerId, el);
                      } else {
                        remoteVideoRefs.current.delete(peerId);
                      }
                    }}
                    autoPlay
                    playsInline
                    className="w-full h-full object-contain"
                  />
                  <div className="absolute bottom-4 left-4 bg-black/60 px-3 py-1 rounded-full text-white text-sm">
                    {participantName}
                  </div>
                  {participant && !participant.videoEnabled && (
                    <div className="absolute inset-0 flex items-center justify-center bg-zinc-800">
                      <div className="w-20 h-20 rounded-full bg-indigo-600 flex items-center justify-center text-white text-3xl font-bold">
                        {participantName.charAt(0).toUpperCase()}
                      </div>
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
        )}
      </div>

      {/* Control Bar */}
      <div className="flex-shrink-0 flex items-center justify-center gap-3 px-6 py-4 bg-zinc-950 border-t border-zinc-800/50">
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
          onClick={handleLeaveRoom}
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
