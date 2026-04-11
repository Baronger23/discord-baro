import type { Channel, Member, MemberRole, Message, DirectMessage, Profile } from "@prisma/client";

export type MessageWithMember = Message & {
  member: Member & {
    profile: Profile;
  };
  channel: Channel;
  replyToMessage?: {
    id: string;
    content: string;
    fileUrl: string | null;
    deleted: boolean;
    member: Member & {
      profile: Profile;
    };
  } | null;
};

export type DirectMessageWithMember = DirectMessage & {
  member: Member & {
    profile: Profile;
  };
  replyToDirectMessage?: {
    id: string;
    content: string;
    fileUrl: string | null;
    deleted: boolean;
    member: Member & {
      profile: Profile;
    };
  } | null;
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
  "call:incoming": (payload: {
    callId: string;
    callerId: string;
    callerMemberId?: string;
    callerName: string;
    callerAvatar?: string;
    serverId: string;
    conversationId: string;
    timestamp: number;
  }) => void;
  "call:accepted": (payload: {
    callId: string;
    conversationId: string;
  }) => void;
  "call:declined": (payload: {
    callId: string;
    conversationId: string;
  }) => void;
  "call:cancelled": (payload: {
    callId: string;
    conversationId: string;
  }) => void;
  "call:ended": (payload: {
    conversationId: string;
    timestamp: number;
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
    timestamp: number;
  }) => void;
  "call:initiate": (payload: {
    conversationId: string;
    calleeId: string;
    callerName: string;
    callerAvatar?: string;
    timestamp: number;
  }) => void;
  "call:accept": (payload: {
    callId: string;
    conversationId: string;
  }) => void;
  "call:decline": (payload: {
    callId: string;
    conversationId: string;
  }) => void;
  "call:end": (payload: {
    conversationId: string;
    calleeId: string;
    timestamp: number;
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
