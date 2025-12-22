/**
 * WebRTC TypeScript Types
 */

export type ConnectionState = 
  | "idle" 
  | "connecting" 
  | "connected" 
  | "reconnecting"
  | "disconnected" 
  | "failed";

export type MediaType = "audio" | "video" | "screen";

export interface MediaDevices {
  audioInputs: MediaDeviceInfo[];
  audioOutputs: MediaDeviceInfo[];
  videoInputs: MediaDeviceInfo[];
}

export interface PeerConnection {
  peerId: string;
  displayName: string;
  connection: RTCPeerConnection;
  remoteCameraStream: MediaStream | null;  // Camera stream
  remoteScreenStream: MediaStream | null;  // Screen share stream
  audioEnabled: boolean;
  videoEnabled: boolean;
  screenSharing: boolean;
  isInitialSetupComplete: boolean;  // Track if initial negotiation is done
  reconnectAttempts?: number;  // Track reconnection attempts
  reconnecting?: boolean;  // Currently reconnecting flag
}

export interface LocalMediaState {
  audioEnabled: boolean;
  videoEnabled: boolean;
  screenSharing: boolean;
  audioDeviceId?: string;
  videoDeviceId?: string;
}

export interface WebRTCRoomOptions {
  roomId: string;
  displayName: string;
  audio?: boolean;
  video?: boolean;
}

export interface SignalingMessage {
  type: "offer" | "answer" | "ice-candidate" | "user-joined" | "user-left" | "media-state-changed" | "renegotiate-offer" | "renegotiate-answer";
  from: string;
  to?: string;
  data?: any;
}

export interface IceCandidate {
  candidate: string;
  sdpMid: string | null;
  sdpMLineIndex: number | null;
}

export interface RoomParticipant {
  id: string;
  displayName: string;
  audioEnabled: boolean;
  videoEnabled: boolean;
  screenSharing: boolean;
  joinedAt: Date;
}

// Stream type identifier
export type StreamType = "camera" | "screen";

// Events emitted by WebRTC client
export interface WebRTCEvents {
  "connection-state-change": (state: ConnectionState) => void;
  "local-stream": (stream: MediaStream) => void;
  "local-screen-stream": (stream: MediaStream) => void;  // New: separate screen stream event
  "remote-stream": (peerId: string, stream: MediaStream, streamType: StreamType) => void;  // Updated: add streamType
  "peer-joined": (participant: RoomParticipant) => void;
  "peer-left": (peerId: string) => void;
  "peer-media-changed": (peerId: string, mediaState: Partial<LocalMediaState>) => void;
  "ice-candidate": (payload: { peerId: string; candidate: IceCandidate }) => void;
  "need-offer": (payload: { peerId: string; displayName: string }) => void;
  "renegotiation-needed": (peerId: string) => void;  // New: trigger renegotiation
  "error": (error: Error) => void;
}
