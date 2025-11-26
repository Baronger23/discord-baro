/**
 * React Hook for WebRTC with Socket.IO signaling
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { useSocket } from "@/components/providers/socket-provider";
import { WebRTCClient } from "@/lib/webrtc/webrtc-client";
import { WebRTCSignaling } from "@/lib/webrtc/signaling";
import type { ConnectionState, RoomParticipant } from "@/lib/webrtc/types";

export interface UseWebRTCOptions {
  roomId: string;
  displayName: string;
  audio?: boolean;
  video?: boolean;
  autoJoin?: boolean;
}

export interface UseWebRTCReturn {
  // Media streams
  localStream: MediaStream | null;
  remoteStreams: Map<string, MediaStream>;
  participants: RoomParticipant[];

  // Connection state
  connectionState: ConnectionState;
  isConnected: boolean;

  // Media controls
  audioEnabled: boolean;
  videoEnabled: boolean;
  toggleAudio: () => void;
  toggleVideo: () => void;

  // Screen sharing
  isScreenSharing: boolean;
  startScreenShare: () => Promise<void>;
  stopScreenShare: () => void;

  // Room controls
  joinRoom: () => Promise<void>;
  leaveRoom: () => void;

  // Error handling
  error: Error | null;
}

export const useWebRTC = (options: UseWebRTCOptions): UseWebRTCReturn => {
  const { socket } = useSocket();

  // Refs for WebRTC client and signaling
  const webrtcClientRef = useRef<WebRTCClient | null>(null);
  const signalingRef = useRef<WebRTCSignaling | null>(null);

  // State
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [participants, setParticipants] = useState<RoomParticipant[]>([]);
  const [connectionState, setConnectionState] = useState<ConnectionState>("idle");
  const [audioEnabled, setAudioEnabled] = useState(options.audio !== false);
  const [videoEnabled, setVideoEnabled] = useState(options.video === true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [hasJoined, setHasJoined] = useState(false);

  /**
   * Initialize WebRTC client and signaling
   */
  const initialize = useCallback(() => {
    if (!socket || webrtcClientRef.current || signalingRef.current) return;

    console.log("[useWebRTC] Initializing WebRTC client");

    // Create WebRTC client
    const webrtcClient = new WebRTCClient();
    webrtcClientRef.current = webrtcClient;

    // Create signaling layer
    const signaling = new WebRTCSignaling(socket, webrtcClient);
    signalingRef.current = signaling;

    // Setup event listeners
    webrtcClient.on("local-stream", (stream: MediaStream) => {
      console.log("[useWebRTC] Local stream ready");
      setLocalStream(stream);
      
      // Sync media state from actual tracks
      const videoTrack = stream.getVideoTracks()[0];
      const audioTrack = stream.getAudioTracks()[0];
      if (videoTrack) {
        setVideoEnabled(videoTrack.enabled);
        console.log("[useWebRTC] Video track enabled:", videoTrack.enabled);
      }
      if (audioTrack) {
        setAudioEnabled(audioTrack.enabled);
        console.log("[useWebRTC] Audio track enabled:", audioTrack.enabled);
      }
    });

    webrtcClient.on("remote-stream", (peerId: string, stream: MediaStream) => {
      console.log("[useWebRTC] Remote stream received from:", peerId);
      setRemoteStreams((prev) => new Map(prev).set(peerId, stream));
    });

    webrtcClient.on("peer-joined", (participant: RoomParticipant) => {
      console.log("[useWebRTC] Peer joined:", participant.id, participant.displayName);
      setParticipants((prev) => {
        // Check if already exists
        const exists = prev.find((p) => p.id === participant.id);
        if (exists) {
          console.log("[useWebRTC] Peer already in list, updating");
          return prev.map((p) => (p.id === participant.id ? participant : p));
        }
        return [...prev, participant];
      });
    });

    webrtcClient.on("peer-left", (peerId: string) => {
      console.log("[useWebRTC] Peer left:", peerId);
      setParticipants((prev) => prev.filter((p) => p.id !== peerId));
      setRemoteStreams((prev) => {
        const next = new Map(prev);
        next.delete(peerId);
        return next;
      });
    });

    webrtcClient.on("peer-media-changed", (peerId: string, mediaState: Partial<any>) => {
      console.log("[useWebRTC] Peer media changed:", peerId, mediaState);
      setParticipants((prev) =>
        prev.map((p) => {
          if (p.id === peerId) {
            return {
              ...p,
              audioEnabled: mediaState.audioEnabled ?? p.audioEnabled,
              videoEnabled: mediaState.videoEnabled ?? p.videoEnabled,
              screenSharing: mediaState.screenSharing ?? p.screenSharing,
            };
          }
          return p;
        })
      );
    });

    webrtcClient.on("connection-state-change", (state: ConnectionState) => {
      console.log("[useWebRTC] Connection state changed:", state);
      setConnectionState(state);
    });

    webrtcClient.on("error", (err: Error) => {
      console.error("[useWebRTC] WebRTC error:", err);
      setError(err);
    });
  }, [socket]);

  /**
   * Join the WebRTC room
   */
  const joinRoom = useCallback(async () => {
    if (!webrtcClientRef.current || !signalingRef.current || hasJoined) return;

    try {
      console.log("[useWebRTC] Joining room:", options.roomId);
      console.log("[useWebRTC] Join options:", { 
        audio: options.audio, 
        video: options.video,
        displayName: options.displayName 
      });
      setConnectionState("connecting");

      // Join WebRTC room
      await webrtcClientRef.current.joinRoom({
        roomId: options.roomId,
        displayName: options.displayName,
        audio: options.audio,
        video: options.video,
      });

      console.log("[useWebRTC] WebRTC join completed");

      // Join signaling room
      signalingRef.current.joinRoom(options.roomId, options.displayName);

      setHasJoined(true);
      setConnectionState("connected");
      console.log("[useWebRTC] Successfully joined room");
    } catch (err) {
      console.error("[useWebRTC] Failed to join room:", err);
      setError(err as Error);
      setConnectionState("failed");
    }
  }, [options, hasJoined]);

  /**
   * Leave the WebRTC room
   */
  const leaveRoom = useCallback(() => {
    if (!webrtcClientRef.current || !signalingRef.current) return;

    console.log("[useWebRTC] Leaving room");

    // Leave signaling room first
    signalingRef.current.leaveRoom();
    
    // Leave WebRTC room and cleanup (this will stop all tracks)
    webrtcClientRef.current.leaveRoom();

    setHasJoined(false);
    setConnectionState("disconnected");
    setLocalStream(null);
    setRemoteStreams(new Map());
    setParticipants([]);
  }, []);

  /**
   * Toggle audio on/off
   */
  const toggleAudio = useCallback(() => {
    if (!webrtcClientRef.current) return;

    const newState = !audioEnabled;
    webrtcClientRef.current.setAudioEnabled(newState);
    setAudioEnabled(newState);
  }, [audioEnabled]);

  /**
   * Toggle video on/off
   */
  const toggleVideo = useCallback(() => {
    if (!webrtcClientRef.current) return;

    const newState = !videoEnabled;
    webrtcClientRef.current.setVideoEnabled(newState);
    setVideoEnabled(newState);
  }, [videoEnabled]);

  /**
   * Start screen sharing
   */
  const startScreenShare = useCallback(async () => {
    if (!webrtcClientRef.current) return;

    try {
      await webrtcClientRef.current.startScreenShare();
      setIsScreenSharing(true);
    } catch (err) {
      console.error("[useWebRTC] Failed to start screen share:", err);
      setError(err as Error);
    }
  }, []);

  /**
   * Stop screen sharing
   */
  const stopScreenShare = useCallback(() => {
    if (!webrtcClientRef.current) return;

    webrtcClientRef.current.stopScreenShare();
    setIsScreenSharing(false);
  }, []);

  /**
   * Initialize on mount
   */
  useEffect(() => {
    initialize();
  }, [initialize]);

  /**
   * Auto-join if enabled
   */
  useEffect(() => {
    if (options.autoJoin && webrtcClientRef.current && !hasJoined) {
      joinRoom();
    }
  }, [options.autoJoin, hasJoined, joinRoom]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (webrtcClientRef.current) {
        webrtcClientRef.current.destroy();
        webrtcClientRef.current = null;
      }
      if (signalingRef.current) {
        signalingRef.current.destroy();
        signalingRef.current = null;
      }
    };
  }, []);

  return {
    // Media streams
    localStream,
    remoteStreams,
    participants,

    // Connection state
    connectionState,
    isConnected: connectionState === "connected",

    // Media controls
    audioEnabled,
    videoEnabled,
    toggleAudio,
    toggleVideo,

    // Screen sharing
    isScreenSharing,
    startScreenShare,
    stopScreenShare,

    // Room controls
    joinRoom,
    leaveRoom,

    // Error handling
    error,
  };
};
