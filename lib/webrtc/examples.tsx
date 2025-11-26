/**
 * WebRTC Usage Examples
 * 
 * This file demonstrates various ways to use the custom WebRTC library
 */

// ============================================================================
// Example 1: Simple Voice-Only Room
// ============================================================================

import { MediaRoom } from "@/components/media-room";

export function VoiceChannel({ channelId }: { channelId: string }) {
  return (
    <div className="h-screen w-full">
      <MediaRoom
        chatId={channelId}
        video={false}
        audio={true}
      />
    </div>
  );
}

// ============================================================================
// Example 2: Video Call Room
// ============================================================================

export function VideoCallRoom({ roomId }: { roomId: string }) {
  return (
    <div className="h-screen w-full">
      <MediaRoom
        chatId={roomId}
        video={true}
        audio={true}
      />
    </div>
  );
}

// ============================================================================
// Example 3: Custom UI with useWebRTC Hook
// ============================================================================

import { useWebRTC } from "@/hooks/use-webrtc";
import { Mic, MicOff, Video, VideoOff } from "lucide-react";

export function CustomVideoCall({ roomId, displayName }: { roomId: string; displayName: string }) {
  const {
    localStream,
    remoteStreams,
    participants,
    audioEnabled,
    videoEnabled,
    isConnected,
    toggleAudio,
    toggleVideo,
    leaveRoom,
  } = useWebRTC({
    roomId,
    displayName,
    audio: true,
    video: true,
    autoJoin: true,
  });

  return (
    <div className="flex flex-col h-screen bg-gray-900">
      {/* Video Grid */}
      <div className="flex-1 grid grid-cols-2 gap-4 p-4">
        {/* Local Video */}
        <div className="relative bg-gray-800 rounded-lg overflow-hidden">
          <video
            ref={(el) => {
              if (el && localStream) {
                el.srcObject = localStream;
              }
            }}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          <span className="absolute bottom-4 left-4 text-white bg-black/50 px-2 py-1 rounded">
            {displayName} (You)
          </span>
        </div>

        {/* Remote Videos */}
        {Array.from(remoteStreams.entries()).map(([peerId, stream]) => {
          const participant = participants.find((p) => p.id === peerId);
          return (
            <div key={peerId} className="relative bg-gray-800 rounded-lg overflow-hidden">
              <video
                ref={(el) => {
                  if (el) {
                    el.srcObject = stream;
                  }
                }}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
              <span className="absolute bottom-4 left-4 text-white bg-black/50 px-2 py-1 rounded">
                {participant?.displayName || "Unknown"}
              </span>
            </div>
          );
        })}
      </div>

      {/* Controls */}
      <div className="flex justify-center gap-4 p-6 bg-gray-950">
        <button
          onClick={toggleAudio}
          className={`p-4 rounded-full ${
            audioEnabled ? "bg-gray-700" : "bg-red-600"
          } hover:opacity-80`}
        >
          {audioEnabled ? <Mic className="w-6 h-6 text-white" /> : <MicOff className="w-6 h-6 text-white" />}
        </button>

        <button
          onClick={toggleVideo}
          className={`p-4 rounded-full ${
            videoEnabled ? "bg-gray-700" : "bg-red-600"
          } hover:opacity-80`}
        >
          {videoEnabled ? <Video className="w-6 h-6 text-white" /> : <VideoOff className="w-6 h-6 text-white" />}
        </button>

        <button
          onClick={leaveRoom}
          className="p-4 rounded-full bg-red-600 hover:opacity-80"
        >
          <span className="text-white">Leave</span>
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Example 4: Direct WebRTCClient Usage (Advanced)
// ============================================================================

import { WebRTCClient, WebRTCSignaling } from "@/lib/webrtc";
import { useSocket } from "@/components/providers/socket-provider";
import { useEffect, useRef } from "react";

export function AdvancedWebRTCExample() {
  const { socket } = useSocket();
  const clientRef = useRef<WebRTCClient | null>(null);
  const signalingRef = useRef<WebRTCSignaling | null>(null);

  useEffect(() => {
    if (!socket) return;

    // Initialize WebRTC client
    const client = new WebRTCClient();
    clientRef.current = client;

    // Initialize signaling
    const signaling = new WebRTCSignaling(socket, client);
    signalingRef.current = signaling;

    // Listen for local stream
    client.on("local-stream", (stream) => {
      console.log("Got local stream:", stream);
      // Attach to video element
    });

    // Listen for remote streams
    client.on("remote-stream", (peerId, stream) => {
      console.log("Got remote stream from:", peerId);
      // Attach to video element
    });

    // Join room
    const joinRoom = async () => {
      await client.joinRoom({
        roomId: "my-room",
        displayName: "John Doe",
        audio: true,
        video: true,
      });

      signaling.joinRoom("my-room", "John Doe");
    };

    joinRoom();

    // Cleanup
    return () => {
      signaling.destroy();
      client.destroy();
    };
  }, [socket]);

  return <div>Advanced WebRTC Example</div>;
}

// ============================================================================
// Example 5: Screen Sharing Feature
// ============================================================================

import { useState } from "react";
import { Monitor, MonitorOff } from "lucide-react";

export function ScreenShareExample({ roomId, displayName }: { roomId: string; displayName: string }) {
  const { isScreenSharing, startScreenShare, stopScreenShare } = useWebRTC({
    roomId,
    displayName,
    audio: true,
    video: false,
    autoJoin: true,
  });

  const handleScreenShare = async () => {
    if (isScreenSharing) {
      stopScreenShare();
    } else {
      try {
        await startScreenShare();
      } catch (error) {
        console.error("Failed to start screen share:", error);
        alert("Screen sharing not available or permission denied");
      }
    }
  };

  return (
    <button
      onClick={handleScreenShare}
      className={`flex items-center gap-2 px-4 py-2 rounded ${
        isScreenSharing ? "bg-indigo-600" : "bg-gray-700"
      } text-white hover:opacity-80`}
    >
      {isScreenSharing ? (
        <>
          <MonitorOff className="w-5 h-5" />
          Stop Sharing
        </>
      ) : (
        <>
          <Monitor className="w-5 h-5" />
          Share Screen
        </>
      )}
    </button>
  );
}

// ============================================================================
// Example 6: Device Selection
// ============================================================================

import { MediaManager } from "@/lib/webrtc";

export function DeviceSelector() {
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [videoInputs, setVideoInputs] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudio, setSelectedAudio] = useState<string>("");
  const [selectedVideo, setSelectedVideo] = useState<string>("");
  const mediaManagerRef = useRef<MediaManager>(new MediaManager());

  useEffect(() => {
    // Get available devices
    const loadDevices = async () => {
      const allDevices = await mediaManagerRef.current.getDevices();
      setAudioInputs(allDevices.audioInputs);
      setVideoInputs(allDevices.videoInputs);
    };

    loadDevices();
  }, []);

  const handleAudioChange = async (deviceId: string) => {
    setSelectedAudio(deviceId);
    await mediaManagerRef.current.switchAudioInput(deviceId);
  };

  const handleVideoChange = async (deviceId: string) => {
    setSelectedVideo(deviceId);
    await mediaManagerRef.current.switchVideoInput(deviceId);
  };

  return (
    <div className="p-4 space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">Microphone</label>
        <select
          value={selectedAudio}
          onChange={(e) => handleAudioChange(e.target.value)}
          className="w-full p-2 border rounded"
        >
          <option value="">Select Microphone</option>
          {audioInputs.map((device) => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label || `Microphone ${device.deviceId.slice(0, 8)}`}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Camera</label>
        <select
          value={selectedVideo}
          onChange={(e) => handleVideoChange(e.target.value)}
          className="w-full p-2 border rounded"
        >
          <option value="">Select Camera</option>
          {videoInputs.map((device) => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label || `Camera ${device.deviceId.slice(0, 8)}`}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

// ============================================================================
// Example 7: Connection Status Indicator
// ============================================================================

export function ConnectionStatus({ roomId, displayName }: { roomId: string; displayName: string }) {
  const { connectionState, isConnected, error } = useWebRTC({
    roomId,
    displayName,
    audio: true,
    video: false,
    autoJoin: true,
  });

  return (
    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-gray-800 text-sm">
      <div
        className={`w-2 h-2 rounded-full ${
          connectionState === "connected"
            ? "bg-green-500"
            : connectionState === "connecting"
            ? "bg-yellow-500 animate-pulse"
            : connectionState === "failed"
            ? "bg-red-500"
            : "bg-gray-500"
        }`}
      />
      <span className="text-white">
        {connectionState === "connected" && "Connected"}
        {connectionState === "connecting" && "Connecting..."}
        {connectionState === "disconnected" && "Disconnected"}
        {connectionState === "failed" && "Connection Failed"}
        {connectionState === "idle" && "Idle"}
      </span>
      {error && <span className="text-red-400 text-xs ml-2">{error.message}</span>}
    </div>
  );
}

// ============================================================================
// Example 8: Participant List
// ============================================================================

export function ParticipantList({ roomId, displayName }: { roomId: string; displayName: string }) {
  const { participants, localStream } = useWebRTC({
    roomId,
    displayName,
    audio: true,
    video: false,
    autoJoin: true,
  });

  return (
    <div className="bg-gray-900 p-4 rounded-lg">
      <h3 className="text-white font-semibold mb-4">
        Participants ({participants.length + 1})
      </h3>

      <div className="space-y-2">
        {/* Local user */}
        <div className="flex items-center gap-3 p-2 bg-gray-800 rounded">
          <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white font-semibold">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <span className="text-white">{displayName} (You)</span>
        </div>

        {/* Remote participants */}
        {participants.map((participant) => (
          <div key={participant.id} className="flex items-center gap-3 p-2 bg-gray-800 rounded">
            <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white font-semibold">
              {participant.displayName.charAt(0).toUpperCase()}
            </div>
            <span className="text-white">{participant.displayName}</span>
            {!participant.audioEnabled && (
              <MicOff className="w-4 h-4 text-red-500 ml-auto" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
