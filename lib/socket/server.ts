import { Server as NetServer } from "http";
import { Server as IOServer, Socket } from "socket.io";
import type { NextApiRequest } from "next";
import { currentProfilePages } from "@/lib/current-profile-pages";
import { db } from "@/lib/db";
import { Member, Profile } from "@prisma/client";
import { channelRoom, serverRoom, whiteboardRoom, SOCKET_EVENTS, SOCKET_PATH } from "./constants";
import type {
  ClientToServerEvents,
  InterServerEvents,
  MessageWithMember,
  PresenceUser,
  ServerToClientEvents,
  SocketData,
  DrawCommand,
} from "./types";
import { presenceManager } from "./presence";
import { whiteboardManager } from "./whiteboard-manager";
import { v4 as uuidv4 } from "uuid";

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
  io.on("connection", (socket: TypedSocket) => {
    const profileId = socket.data.profileId;
    console.log(`[SOCKET] 🔌 New connection from profileId: ${profileId}, socketId: ${socket.id}`);

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

    socket.on(SOCKET_EVENTS.PRESENCE_PING, ({ channels }: PresencePingPayload) => {
      channels.forEach((channelId) => presenceManager.touch(channelId, profileId));
    });

    // WebRTC Signaling Handlers
    socket.on("webrtc:join-room", ({ roomId, peerId, displayName }) => {
      console.log(`[WEBRTC] User ${displayName} (${peerId}) joining room ${roomId}`);
      
      // Join the WebRTC room
      const webrtcRoom = `webrtc:${roomId}`;
      socket.join(webrtcRoom);

      // Get existing peers in the room
      const room = io.sockets.adapter.rooms.get(webrtcRoom);
      const existingPeers: Array<{ peerId: string; displayName: string }> = [];
      
      if (room) {
        room.forEach((socketId) => {
          const peerSocket = io.sockets.sockets.get(socketId);
          if (peerSocket && peerSocket.id !== socket.id) {
            const peerData = peerSocket.data;
            existingPeers.push({
              peerId: socketId,
              displayName: peerData.displayName || "Unknown",
            });
          }
        });
      }

      // Send existing peers to the new user
      socket.emit("webrtc:user-joined", {
        roomId,
        peerId: socket.id,
        displayName,
        peers: existingPeers,
      });

      // Notify existing peers about the new user
      socket.to(webrtcRoom).emit("webrtc:user-joined", {
        roomId,
        peerId: socket.id,
        displayName,
        peers: [],
      });

      console.log(`[WEBRTC] User ${displayName} joined room ${roomId}, found ${existingPeers.length} existing peers`);
    });

    socket.on("webrtc:leave-room", ({ roomId, peerId }) => {
      console.log(`[WEBRTC] User ${peerId} leaving room ${roomId}`);
      const webrtcRoom = `webrtc:${roomId}`;
      
      // Notify others in the room
      socket.to(webrtcRoom).emit("webrtc:user-left", {
        roomId,
        peerId: socket.id,
      });

      // Leave the room
      socket.leave(webrtcRoom);
    });

    socket.on("webrtc:offer", ({ to, roomId, offer, displayName }) => {
      console.log(`[WEBRTC] Relaying offer from ${socket.id} to ${to} in room ${roomId}`);
      
      // Relay the offer to the target peer
      io.to(to).emit("webrtc:offer", {
        from: socket.id,
        to,
        roomId,
        offer,
        displayName,
      });
    });

    socket.on("webrtc:answer", ({ to, roomId, answer }) => {
      console.log(`[WEBRTC] Relaying answer from ${socket.id} to ${to} in room ${roomId}`);
      
      // Get answerer's display name from socket data
      const answerDisplayName = socket.data.displayName || "Unknown";
      
      // Relay the answer to the target peer
      io.to(to).emit("webrtc:answer", {
        from: socket.id,
        to,
        roomId,
        answer,
        displayName: answerDisplayName,
      });
    });

    socket.on("webrtc:ice-candidate", ({ to, roomId, candidate }) => {
      console.log(`[WEBRTC] Relaying ICE candidate from ${socket.id} to ${to}`);
      
      // Relay the ICE candidate to the target peer
      io.to(to).emit("webrtc:ice-candidate", {
        from: socket.id,
        to,
        roomId,
        candidate,
      });
    });

    socket.on("webrtc:media-state", ({ roomId, audioEnabled, videoEnabled, screenSharing }) => {
      console.log(`[WEBRTC] Broadcasting media state change from ${socket.id} in room ${roomId}`);
      
      const webrtcRoom = `webrtc:${roomId}`;
      // Broadcast to all other users in the room
      socket.to(webrtcRoom).emit("webrtc:media-state", {
        roomId,
        peerId: socket.id,
        audioEnabled,
        videoEnabled,
        screenSharing,
      });
    });

    // NEW: Renegotiation handlers for dual streams
    socket.on("webrtc:renegotiate-offer", ({ to, roomId, offer }) => {
      console.log(`[WEBRTC] 🔄 Relaying renegotiation offer from ${socket.id} to ${to} in room ${roomId}`);
      
      // Relay the renegotiation offer to the target peer
      io.to(to).emit("webrtc:renegotiate-offer", {
        from: socket.id,
        to,
        roomId,
        offer,
      });
    });

    socket.on("webrtc:renegotiate-answer", ({ to, roomId, answer }) => {
      console.log(`[WEBRTC] 🔄 Relaying renegotiation answer from ${socket.id} to ${to} in room ${roomId}`);
      
      // Relay the renegotiation answer to the target peer
      io.to(to).emit("webrtc:renegotiate-answer", {
        from: socket.id,
        to,
        roomId,
        answer,
      });
    });

    // ============================================
    // WHITEBOARD EVENTS
    // ============================================
    
    socket.on(SOCKET_EVENTS.WHITEBOARD_JOIN, async ({ serverId, channelId }) => {
      try {
        // Verify member access
        const member = await db.member.findFirst({
          where: {
            serverId,
            profileId,
          },
          include: {
            profile: true,
          },
        });

        if (!member) {
          console.log(`[WHITEBOARD] Unauthorized join attempt: ${profileId} -> ${channelId}`);
          return;
        }

        // Verify channel is whiteboard type
        const channel = await db.channel.findUnique({
          where: { id: channelId },
        });

        if (!channel || channel.type !== "WHITEBOARD") {
          console.log(`[WHITEBOARD] Invalid channel type: ${channelId}`);
          return;
        }

        // Join whiteboard room
        socket.join(whiteboardRoom(channelId));
        console.log(`[WHITEBOARD] ${member.profile.name} joined ${channelId}`);

        // Load and send current state
        const state = await whiteboardManager.loadState(channelId);
        socket.emit(SOCKET_EVENTS.WHITEBOARD_STATE, {
          channelId,
          state,
        });

      } catch (error) {
        console.error("[WHITEBOARD] Failed to join:", error);
      }
    });

    socket.on(SOCKET_EVENTS.WHITEBOARD_LEAVE, ({ channelId }) => {
      socket.leave(whiteboardRoom(channelId));
      console.log(`[WHITEBOARD] ${profileId} left ${channelId}`);
    });

    socket.on(SOCKET_EVENTS.WHITEBOARD_DRAW, async ({ channelId, command: partialCommand }) => {
      try {
        // Create full command with server-side data
        const fullCommand: DrawCommand = {
          ...partialCommand,
          id: uuidv4(),
          timestamp: Date.now(),
        };

        // Add to state
        whiteboardManager.addCommand(channelId, fullCommand);

        // Broadcast to all users in the room (including sender for confirmation)
        socket.to(whiteboardRoom(channelId)).emit(SOCKET_EVENTS.WHITEBOARD_DRAW, {
          channelId,
          command: fullCommand,
        });

        // Optional: Save individual command to database for audit/recovery
        // This is async and non-blocking
        db.whiteboardDrawCommand.create({
          data: {
            channelId,
            commandType: fullCommand.type,
            data: JSON.stringify(fullCommand),
            sequence: Date.now(), // Use timestamp as sequence
            profileId: fullCommand.profileId,
            memberId: profileId, // Socket's member id
          },
        }).catch(err => {
          console.error("[WHITEBOARD] Failed to save draw command:", err);
        });

      } catch (error) {
        console.error("[WHITEBOARD] Failed to process draw:", error);
      }
    });

    socket.on(SOCKET_EVENTS.WHITEBOARD_CLEAR, async ({ channelId }) => {
      try {
        // Clear whiteboard
        await whiteboardManager.clearWhiteboard(channelId, profileId);

        // Broadcast to all users
        socket.to(whiteboardRoom(channelId)).emit(SOCKET_EVENTS.WHITEBOARD_CLEAR, {
          channelId,
          clearedBy: profileId,
        });

        // Also notify the sender
        socket.emit(SOCKET_EVENTS.WHITEBOARD_CLEAR, {
          channelId,
          clearedBy: profileId,
        });

      } catch (error) {
        console.error("[WHITEBOARD] Failed to clear:", error);
      }
    });

    socket.on(SOCKET_EVENTS.WHITEBOARD_UNDO, async ({ channelId, commandId }) => {
      try {
        // Undo command
        const updatedState = whiteboardManager.undoCommand(channelId, commandId);

        if (updatedState) {
          // Broadcast to all users
          socket.to(whiteboardRoom(channelId)).emit(SOCKET_EVENTS.WHITEBOARD_UNDO, {
            channelId,
            commandId,
          });

          // Also notify the sender
          socket.emit(SOCKET_EVENTS.WHITEBOARD_UNDO, {
            channelId,
            commandId,
          });
        }

      } catch (error) {
        console.error("[WHITEBOARD] Failed to undo:", error);
      }
    });

    socket.on("disconnect", () => {
      presenceManager.removeProfile(profileId);
      socket.data.channelIds.forEach((channelId) => {
        const payload = buildPresencePayload(channelId);
        socket.to(channelRoom(channelId)).emit(SOCKET_EVENTS.PRESENCE_UPDATE, payload);
      });

      // Notify WebRTC rooms about disconnection
      socket.rooms.forEach((roomName) => {
        if (roomName.startsWith("webrtc:")) {
          const roomId = roomName.replace("webrtc:", "");
          socket.to(roomName).emit("webrtc:user-left", {
            roomId,
            peerId: socket.id,
          });
        }
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
