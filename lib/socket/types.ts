import type { Channel, Member, MemberRole, Message, DirectMessage, Profile } from "@prisma/client";

export type MessageWithMember = Message & {
  member: Member & {
    profile: Profile;
  };
  channel: Channel;
};

export type DirectMessageWithMember = DirectMessage & {
  member: Member & {
    profile: Profile;
  };
};

export type PresenceUser = {
  profileId: string;
  memberId: string;
  serverId: string;
  channelId?: string;
  displayName: string;
  avatarUrl: string | null;
  role: MemberRole;
  lastSeenAt: number;
};

export type ServerToClientEvents = {
  "chat:message": (payload: {
    channelId: string;
    message: MessageWithMember;
  }) => void;
  "chat:typing": (payload: {
    channelId: string;
    profileId: string;
    displayName: string;
    isTyping: boolean;
    emittedAt: number;
  }) => void;
  "presence:update": (payload: {
    channelId: string;
    users: PresenceUser[];
  }) => void;
  "notification:new": (payload: {
    serverId: string;
    channelId: string;
    messageId: string;
    preview: string;
    senderName?: string; // Tên người gửi
  }) => void;
  
  // WebRTC Signaling Events
  "webrtc:offer": (payload: {
    from: string;
    to: string;
    roomId: string;
    offer: RTCSessionDescriptionInit;
    displayName: string;
  }) => void;
  "webrtc:answer": (payload: {
    from: string;
    to: string;
    roomId: string;
    answer: RTCSessionDescriptionInit;
    displayName: string;
  }) => void;
  "webrtc:ice-candidate": (payload: {
    from: string;
    to: string;
    roomId: string;
    candidate: {
      candidate: string;
      sdpMid: string | null;
      sdpMLineIndex: number | null;
    };
  }) => void;
  "webrtc:user-joined": (payload: {
    roomId: string;
    peerId: string;
    displayName: string;
    peers: Array<{ peerId: string; displayName: string }>;
  }) => void;
  "webrtc:user-left": (payload: {
    roomId: string;
    peerId: string;
  }) => void;
  "webrtc:media-state": (payload: {
    roomId: string;
    peerId: string;
    audioEnabled?: boolean;
    videoEnabled?: boolean;
    screenSharing?: boolean;
  }) => void;
};

export type ClientToServerEvents = {
  "chat:join": (payload: {
    serverId: string;
    channelId: string;
  }) => void;
  "chat:leave": (payload: {
    serverId: string;
    channelId: string;
  }) => void;
  "conversation:join": (payload: {
    conversationId: string;
  }) => void;
  "chat:typing": (payload: {
    channelId: string;
    isTyping: boolean;
  }) => void;
  "chat:message:delivered": (payload: {
    channelId: string;
    messageId: string;
  }) => void;
  "presence:ping": (payload: {
    channels: string[];
  }) => void;
  // WebRTC Signaling Events (Client to Server)
  "webrtc:join-room": (payload: {
    roomId: string;
    peerId: string;
    displayName: string;
  }) => void;
  "webrtc:leave-room": (payload: {
    roomId: string;
    peerId: string;
  }) => void;
  "webrtc:offer": (payload: {
    to: string;
    roomId: string;
    offer: RTCSessionDescriptionInit;
    displayName: string;
  }) => void;
  "webrtc:answer": (payload: {
    to: string;
    roomId: string;
    answer: RTCSessionDescriptionInit;
  }) => void;
  "webrtc:ice-candidate": (payload: {
    to: string;
    roomId: string;
    candidate: {
      candidate: string;
      sdpMid: string | null;
      sdpMLineIndex: number | null;
    };
  }) => void;
  "webrtc:media-state": (payload: {
    roomId: string;
    audioEnabled?: boolean;
    videoEnabled?: boolean;
    screenSharing?: boolean;
  }) => void;
};

export type InterServerEvents = Record<string, never>;

export type SocketData = {
  profileId: string;
  memberId?: string;
  displayName?: string;
  avatarUrl?: string | null;
  serverIds: Set<string>;
  channelIds: Set<string>;
};
