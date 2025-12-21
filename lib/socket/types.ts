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

// Whiteboard types
export type DrawPoint = {
  x: number;
  y: number;
};

export type DrawCommand = {
  id: string;
  type: "draw" | "erase";
  points: DrawPoint[];
  color: string;
  width: number;
  timestamp: number;
  profileId: string;
  displayName: string;
};

export type WhiteboardState = {
  commands: DrawCommand[];
  version: number;
};

// Whiteboard cursor tracking
export type CursorPosition = {
  x: number;
  y: number;
};

export type WhiteboardUser = {
  peerId: string; // socket.id
  profileId: string;
  displayName: string;
  avatarUrl: string | null;
  cursor?: CursorPosition;
  color: string; // unique color for cursor
  lastUpdate: number;
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
  
  // Whiteboard events (server -> client)
  "whiteboard:draw": (payload: {
    channelId: string;
    command: DrawCommand;
  }) => void;
  "whiteboard:state": (payload: {
    channelId: string;
    state: WhiteboardState;
  }) => void;
  "whiteboard:clear": (payload: {
    channelId: string;
    clearedBy: string;
  }) => void;
  "whiteboard:undo": (payload: {
    channelId: string;
    commandId: string;
  }) => void;
  "whiteboard:cursor": (payload: {
    channelId: string;
    user: WhiteboardUser;
  }) => void;
  "whiteboard:users": (payload: {
    channelId: string;
    users: WhiteboardUser[];
  }) => void;
  "whiteboard:user-joined": (payload: {
    channelId: string;
    user: WhiteboardUser;
  }) => void;
  "whiteboard:user-left": (payload: {
    channelId: string;
    peerId: string;
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
  
  // Whiteboard events (client -> server)
  "whiteboard:join": (payload: {
    serverId: string;
    channelId: string;
  }) => void;
  "whiteboard:leave": (payload: {
    channelId: string;
  }) => void;
  "whiteboard:draw": (payload: {
    channelId: string;
    command: Omit<DrawCommand, "id" | "timestamp">;
  }) => void;
  "whiteboard:clear": (payload: {
    channelId: string;
  }) => void;
  "whiteboard:undo": (payload: {
    channelId: string;
    commandId: string;
  }) => void;
  "whiteboard:cursor": (payload: {
    channelId: string;
    cursor: CursorPosition;
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
