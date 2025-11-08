export const SOCKET_PATH = "/api/socket/io";

export const channelRoom = (channelId: string) => `channel:${channelId}`;
export const serverRoom = (serverId: string) => `server:${serverId}`;

export const SOCKET_EVENTS = {
  CHAT_MESSAGE: "chat:message" as const,
  CHAT_MESSAGE_UPDATE: "chat:message:update" as const,
  CHAT_TYPING: "chat:typing" as const,
  CHAT_JOIN: "chat:join" as const,
  CHAT_LEAVE: "chat:leave" as const,
  CHAT_DELIVERED: "chat:message:delivered" as const,
  PRESENCE_UPDATE: "presence:update" as const,
  PRESENCE_PING: "presence:ping" as const,
  NOTIFICATION: "notification:new" as const,
};

type Values<T> = T[keyof T];
export type SocketEvent = Values<typeof SOCKET_EVENTS>;
