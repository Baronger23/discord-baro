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
  "chat:message:update": (payload: {
    channelId: string;
    message: MessageWithMember | DirectMessageWithMember;
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
