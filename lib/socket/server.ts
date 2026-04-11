import { Server as NetServer } from "http";
import { Server as IOServer, Socket } from "socket.io";
import type { NextApiRequest } from "next";
import { currentProfilePages } from "@/lib/current-profile-pages";
import { db } from "@/lib/db";
import { Member, Profile } from "@prisma/client";
import { channelRoom, serverRoom, SOCKET_EVENTS, SOCKET_PATH } from "./constants";
import type {
  ClientToServerEvents,
  InterServerEvents,
  MessageWithMember,
  PresenceUser,
  ServerToClientEvents,
  SocketData,
} from "./types";
import { presenceManager } from "./presence";

export type TypedIOServer = IOServer<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

export type TypedSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

let ioInstance: TypedIOServer | null = null;

type MemberWithProfile = Member & { profile: Profile };

type ChatJoinPayload = Parameters<ClientToServerEvents["chat:join"]>[0];
type ChatLeavePayload = Parameters<ClientToServerEvents["chat:leave"]>[0];
type ChatTypingPayload = Parameters<ClientToServerEvents["chat:typing"]>[0];
type PresencePingPayload = Parameters<ClientToServerEvents["presence:ping"]>[0];
type NotificationPayload = Parameters<ServerToClientEvents["notification:new"]>[0];
type PresenceUpdatePayload = Parameters<ServerToClientEvents["presence:update"]>[0];
type TypingBroadcastPayload = Parameters<ServerToClientEvents["chat:typing"]>[0];
type ChatMessagePayload = Parameters<ServerToClientEvents["chat:message"]>[0];

const buildPresenceUser = (member: MemberWithProfile | null): PresenceUser | null => {
  if (!member) return null;
  return {
    profileId: member.profileId,
    memberId: member.id,
    serverId: member.serverId,
    channelId: undefined,
    displayName: member.profile.name ?? member.profile.email,
    avatarUrl: member.profile.imageUrl,
    role: member.role,
    lastSeenAt: Date.now(),
  };
};

const buildPresencePayload = (channelId: string): PresenceUpdatePayload => ({
  channelId,
  users: presenceManager.getChannelSnapshot(channelId),
});

const emitPresenceUpdateForSocket = (socket: TypedSocket, channelId: string) => {
  const payload = buildPresencePayload(channelId);
  socket.emit(SOCKET_EVENTS.PRESENCE_UPDATE, payload);
  socket.to(channelRoom(channelId)).emit(SOCKET_EVENTS.PRESENCE_UPDATE, payload);
};

const parseCookies = (cookieHeader?: string): Record<string, string> => {
  if (!cookieHeader) return {};

  return cookieHeader.split(";").reduce<Record<string, string>>((acc, cookie) => {
    const [rawName, ...rawValue] = cookie.trim().split("=");
    if (!rawName) return acc;
    acc[decodeURIComponent(rawName)] = decodeURIComponent(rawValue.join("="));
    return acc;
  }, {});
};

const registerMiddleware = (io: TypedIOServer) => {
  io.use(async (socket, next) => {
    try {
      const req = socket.request as NextApiRequest & { cookies?: Record<string, string> };
      if (!req.cookies) {
        req.cookies = parseCookies(socket.request.headers?.cookie);
      }
      const profile = await currentProfilePages(req);
      if (!profile) {
        console.error("[SOCKET_AUTH] Missing profile for handshake", {
          url: req.url,
          cookies: Object.keys(req.cookies ?? {}),
          hasCookieHeader: Boolean(socket.request.headers?.cookie),
        });
        return next(new Error("Unauthorized"));
      }
      console.info("[SOCKET_AUTH] Authenticated handshake", {
        profileId: profile.id,
        url: req.url,
      });
      socket.data.profileId = profile.id;
      socket.data.displayName = profile.name;
      socket.data.avatarUrl = profile.imageUrl;
      socket.data.serverIds = new Set();
      socket.data.channelIds = new Set();
      return next();
    } catch (error) {
      console.error("[SOCKET_AUTH] Authentication failed", error);
      return next(new Error("Authentication failed"));
    }
  });
};

const registerCoreEvents = (io: TypedIOServer) => {
  io.on("connection", async (socket: TypedSocket) => {
    const profileId = socket.data.profileId;
    console.log(`[SOCKET] 🔌 New connection from profileId: ${profileId}, socketId: ${socket.id}`);

    // Auto-join all member rooms for call notifications
    try {
      const members = await db.member.findMany({
        where: { profileId },
        select: { id: true },
      });
      members.forEach(member => {
        socket.join(`member:${member.id}`);
        console.log(`[SOCKET] Auto-joined member room: member:${member.id}`);
      });
    } catch (error) {
      console.error("[SOCKET] Failed to auto-join member rooms:", error);
    }

    socket.on(SOCKET_EVENTS.CHAT_JOIN, async ({ serverId, channelId }: ChatJoinPayload) => {
      try {
        const member = await db.member.findFirst({
          where: {
            serverId,
            profileId,
          },
          include: {
            profile: true,
          },
        });

        const presenceUser = buildPresenceUser(member);

        if (!member || !presenceUser) {
          socket.emit(SOCKET_EVENTS.NOTIFICATION, {
            serverId,
            channelId,
            messageId: "",
            preview: "Bạn không có quyền truy cập kênh này.",
          });
          return;
        }

        socket.data.serverIds.add(serverId);
        socket.data.channelIds.add(channelId);
        presenceUser.channelId = channelId;

        socket.join(serverRoom(serverId));
        socket.join(channelRoom(channelId));

        presenceManager.joinChannel(channelId, presenceUser);

        emitPresenceUpdateForSocket(socket, channelId);
      } catch (error) {
        const notificationPayload: NotificationPayload = {
          serverId,
          channelId,
          messageId: "",
          preview: "Không thể tham gia kênh. Vui lòng thử lại.",
        };
        socket.emit(SOCKET_EVENTS.NOTIFICATION, notificationPayload);
      }
    });

    socket.on(SOCKET_EVENTS.CHAT_LEAVE, ({ channelId, serverId }: ChatLeavePayload) => {
      socket.leave(channelRoom(channelId));
      socket.data.channelIds.delete(channelId);
      presenceManager.leaveChannel(channelId, profileId);
      emitPresenceUpdateForSocket(socket, channelId);
    });

    // Handle conversation join (for direct messages)
    socket.on("conversation:join", async ({ conversationId }: { conversationId: string }) => {
      try {
        console.log(`[SOCKET] User ${profileId} attempting to join conversation ${conversationId}`);
        
        // Verify user is part of this conversation
        const conversation = await db.conversation.findFirst({
          where: {
            id: conversationId,
            OR: [
              {
                memberOne: {
                  profileId,
                }
              },
              {
                memberTwo: {
                  profileId,
                }
              }
            ]
          }
        });

        if (!conversation) {
          console.log(`[SOCKET] User ${profileId} NOT authorized for conversation ${conversationId}`);
          return;
        }

        // Join the conversation room
        const conversationRoom = `conversation:${conversationId}`;
        socket.join(conversationRoom);
        console.log(`[SOCKET] ✅ User ${profileId} joined room: ${conversationRoom}`);
        
        // Log all rooms this socket is in
        console.log(`[SOCKET] Socket rooms:`, Array.from(socket.rooms));
      } catch (error) {
        console.error("[SOCKET] Failed to join conversation:", error);
      }
    });

    socket.on(SOCKET_EVENTS.CHAT_TYPING, ({ channelId, isTyping }: ChatTypingPayload) => {
      presenceManager.touch(channelId, profileId);
      const typingPayload: TypingBroadcastPayload = {
        channelId,
        profileId,
        displayName: socket.data.displayName ?? "Ẩn danh",
        isTyping,
        emittedAt: Date.now(),
      };
      socket.broadcast.to(channelRoom(channelId)).emit(SOCKET_EVENTS.CHAT_TYPING, typingPayload);
    });

    // Handle incoming call
    socket.on("call:initiate", async ({ conversationId, calleeId, callerName, callerAvatar, timestamp }) => {
      try {
        const callId = `${profileId}-${calleeId}-${Date.now()}`;

        const conversation = await db.conversation.findUnique({
          where: { id: conversationId },
          select: {
            memberOne: {
              select: {
                serverId: true,
              },
            },
          },
        });

        if (!conversation) {
          socket.emit("call:declined", { callId, conversationId });
          return;
        }

        // Find callee member to get their socket rooms
        const calleeMember = await db.member.findUnique({
          where: { id: calleeId },
          include: { profile: true },
        });

        if (!calleeMember) {
          socket.emit("call:declined", { callId, conversationId });
          return;
        }

        const callerMember = await db.member.findFirst({
          where: {
            profileId,
            serverId: conversation.memberOne.serverId,
          },
          select: {
            id: true,
          },
        });

        if (!callerMember) {
          socket.emit("call:declined", { callId, conversationId });
          return;
        }

        // Send incoming call notification to callee via member room
        const memberRoom = `member:${calleeId}`;
        socket.broadcast.to(memberRoom).emit("call:incoming", {
          callId,
          callerId: profileId,
          callerMemberId: callerMember.id,
          callerName,
          callerAvatar,
          serverId: conversation.memberOne.serverId,
          conversationId,
          timestamp,
        });

        console.log(`[SOCKET] 📞 Call initiated from ${profileId} to ${calleeId}`);
      } catch (error) {
        console.error("[SOCKET] Failed to initiate call:", error);
      }
    });

    // Handle call acceptance
    socket.on("call:accept", ({ callId, conversationId }) => {
      try {
        const conversationRoom = `conversation:${conversationId}`;
        socket.broadcast.to(conversationRoom).emit("call:accepted", { callId, conversationId });
        console.log(`[SOCKET] ✅ Call accepted: ${callId}`);
      } catch (error) {
        console.error("[SOCKET] Failed to accept call:", error);
      }
    });

    // Handle call decline
    socket.on("call:decline", ({ callId, conversationId }) => {
      try {
        const conversationRoom = `conversation:${conversationId}`;
        socket.broadcast.to(conversationRoom).emit("call:declined", { callId, conversationId });
        console.log(`[SOCKET] ❌ Call declined: ${callId}`);
      } catch (error) {
        console.error("[SOCKET] Failed to decline call:", error);
      }
    });

    // Handle call end
    socket.on("call:end", ({ conversationId, calleeId, timestamp }) => {
      try {
        const memberRoom = `member:${calleeId}`;
        socket.broadcast.to(memberRoom).emit("call:ended", { conversationId, timestamp });
        console.log(`[SOCKET] 📞 Call ended for conversationId: ${conversationId}`);
      } catch (error) {
        console.error("[SOCKET] Failed to end call:", error);
      }
    });

    socket.on(SOCKET_EVENTS.PRESENCE_PING, ({ timestamp }: PresencePingPayload) => {
      // Update user status to ONLINE
      db.profile.update({
        where: { id: profileId },
        data: {
          status: "ONLINE",
          lastSeenAt: new Date(),
        },
      }).catch(err => console.error("[SOCKET] Failed to update presence:", err));
    });

    socket.on("disconnect", () => {
      presenceManager.removeProfile(profileId);
      socket.data.channelIds.forEach((channelId) => {
        const payload = buildPresencePayload(channelId);
        socket.to(channelRoom(channelId)).emit(SOCKET_EVENTS.PRESENCE_UPDATE, payload);
      });
    });
  });
};

export const initSocketServer = (httpServer: NetServer): TypedIOServer => {
  if (ioInstance) {
    return ioInstance;
  }

  ioInstance = new IOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(httpServer, {
    path: SOCKET_PATH,
    addTrailingSlash: false,
    transports: ["websocket"],
    pingTimeout: 20000,
    pingInterval: 20000,
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      credentials: true,
    },
  });

  ioInstance.engine.on("connection_error", (error) => {
    console.warn("[SOCKET_ENGINE] Connection warning", {
      code: error.code,
      message: error.message,
      context: error.context,
    });
  });

  registerMiddleware(ioInstance);
  registerCoreEvents(ioInstance);

  return ioInstance;
};

export const getIO = (): TypedIOServer => {
  if (!ioInstance) {
    throw new Error("Socket server has not been initialized yet.");
  }
  return ioInstance;
};

export const emitServerNotification = (payload: NotificationPayload) => {
  const io = ioInstance;
  if (!io) {
    return;
  }
  io.to(serverRoom(payload.serverId)).emit(SOCKET_EVENTS.NOTIFICATION, payload);
};

export const emitChannelPresenceSnapshot = (channelId: string) => {
  const io = ioInstance;
  if (!io) {
    return;
  }
  const presencePayload = buildPresencePayload(channelId);
  io.to(channelRoom(channelId)).emit(SOCKET_EVENTS.PRESENCE_UPDATE, presencePayload);
};

export const emitChannelMessage = (channelId: string, message: MessageWithMember) => {
  const io = ioInstance;
  if (!io) {
    return;
  }
  const messagePayload: ChatMessagePayload = {
    channelId,
    message,
  };
  io.to(channelRoom(channelId)).emit(SOCKET_EVENTS.CHAT_MESSAGE, messagePayload);

  // Emit notification chỉ cho người trong channel, trừ người gửi
  const room = io.sockets.adapter.rooms.get(channelRoom(channelId));
  if (room) {
    for (const socketId of room) {
      const socket = io.sockets.sockets.get(socketId);
      if (socket && socket.data.profileId !== message.member.profileId) {
        socket.emit(SOCKET_EVENTS.NOTIFICATION, {
          serverId: message.member.serverId,
          channelId,
          messageId: message.id,
          preview: message.content.slice(0, 120),
          senderName: message.member.profile.name,
        });
      }
    }
  }
};
