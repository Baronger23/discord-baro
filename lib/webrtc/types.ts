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
  remoteStream: MediaStream | null;
  audioEnabled: boolean;
  videoEnabled: boolean;
  screenSharing: boolean;
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
  type: "offer" | "answer" | "ice-candidate" | "user-joined" | "user-left" | "media-state-changed";
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

// Events emitted by WebRTC client
export interface WebRTCEvents {
  "connection-state-change": (state: ConnectionState) => void;
  "local-stream": (stream: MediaStream) => void;
  "remote-stream": (peerId: string, stream: MediaStream) => void;
  "peer-joined": (participant: RoomParticipant) => void;
  "peer-left": (peerId: string) => void;
  "peer-media-changed": (peerId: string, mediaState: Partial<LocalMediaState>) => void;
  "ice-candidate": (payload: { peerId: string; candidate: IceCandidate }) => void;
  "need-offer": (payload: { peerId: string; displayName: string }) => void;
  "error": (error: Error) => void;
}
