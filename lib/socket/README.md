# Socket.IO Real-time Communication System - Tài liệu đầy đủ

## 📋 Tổng quan

Hệ thống Socket.IO cho Discord clone với khả năng:
- ✅ Real-time messaging (chat messages)
- ✅ Typing indicators (ai đang typing)
- ✅ Presence tracking (ai đang online trong channel)
- ✅ Push notifications
- ✅ Direct messages (conversations)
- ✅ Server/Channel room management
- ✅ Authentication middleware
- ✅ TypeScript type-safe events

---

## 🗂️ Cấu trúc thư mục

```
lib/socket/
├── server.ts         # Socket.IO server initialization & event handlers
├── client.ts         # Client socket creation
├── types.ts          # TypeScript type definitions
├── constants.ts      # Event names, room helpers
├── presence.ts       # Presence manager (online users tracking)
└── README.md         # Documentation (file này)
```

---

## 🔧 Cấu hình môi trường

```env
# Socket.IO Configuration
NEXT_PUBLIC_SOCKET_URL=http://localhost:3000  # Optional, defaults to same origin
NEXT_PUBLIC_APP_URL=http://localhost:3000     # CORS origin
```

---

## 📦 Dependencies

```json
{
  "socket.io": "^4.7.0",           // Server
  "socket.io-client": "^4.7.0"     // Client
}
```

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      Discord Baro App                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐         ┌──────────────┐                  │
│  │   Client 1   │         │   Client 2   │                  │
│  │  (Browser)   │         │  (Browser)   │                  │
│  └──────┬───────┘         └──────┬───────┘                  │
│         │                        │                           │
│         │  WebSocket             │  WebSocket                │
│         │                        │                           │
│         └────────┬───────────────┘                           │
│                  │                                           │
│         ┌────────▼──────────┐                                │
│         │  Socket.IO Server │                                │
│         │  (pages/api/      │                                │
│         │   socket/io.ts)   │                                │
│         └────────┬──────────┘                                │
│                  │                                           │
│         ┌────────▼──────────┐                                │
│         │  Event Handlers   │                                │
│         │  - chat:join      │                                │
│         │  - chat:message   │                                │
│         │  - chat:typing    │                                │
│         │  - presence:*     │                                │
│         └────────┬──────────┘                                │
│                  │                                           │
│         ┌────────▼──────────┐                                │
│         │ Presence Manager  │                                │
│         │ (In-memory store) │                                │
│         └────────┬──────────┘                                │
│                  │                                           │
│         ┌────────▼──────────┐                                │
│         │   Room System     │                                │
│         │ - channel:123     │                                │
│         │ - server:456      │                                │
│         │ - conversation:789│                                │
│         └───────────────────┘                                │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 Các chức năng chính

### 1. Server Initialization

**File**: `lib/socket/server.ts`

```typescript
import { initSocketServer } from '@/lib/socket/server';

// In pages/api/socket/io.ts
export default function SocketHandler(req: NextApiRequest, res: NextApiResponseServerIO) {
  if (!res.socket.server.io) {
    const httpServer = res.socket.server as any;
    const io = initSocketServer(httpServer);
    res.socket.server.io = io;
  }
  res.end();
}
```

**Cơ chế**:
1. Check nếu Socket.IO server đã init
2. Nếu chưa, tạo instance mới
3. Đăng ký middleware (authentication)
4. Đăng ký event handlers
5. Cấu hình CORS, transports, ping/pong

**Configuration**:
```typescript
new IOServer(httpServer, {
  path: "/api/socket/io",           // Socket endpoint
  addTrailingSlash: false,
  transports: ["websocket"],         // WebSocket only (không dùng polling)
  pingTimeout: 20000,                // 20s timeout
  pingInterval: 20000,               // 20s ping interval
  cors: {
    origin: process.env.NEXT_PUBLIC_APP_URL,
    credentials: true                // Allow cookies
  }
});
```

---

### 2. Authentication Middleware

**Flow**:

```typescript
// 1. Client connects with cookies
const socket = io({
  withCredentials: true  // Send cookies
});

// 2. Server middleware extracts cookies
io.use(async (socket, next) => {
  // Parse cookies from header
  const req = socket.request as NextApiRequest;
  req.cookies = parseCookies(socket.request.headers?.cookie);
  
  // Authenticate với Clerk
  const profile = await currentProfilePages(req);
  
  if (!profile) {
    return next(new Error("Unauthorized"));
  }
  
  // Store profile data trong socket.data
  socket.data.profileId = profile.id;
  socket.data.displayName = profile.name;
  socket.data.avatarUrl = profile.imageUrl;
  
  next();
});
```

**Diagram**:

```
┌────────┐         ┌────────┐         ┌────────┐
│ Client │         │ Socket │         │  Clerk │
└───┬────┘         └───┬────┘         └───┬────┘
    │                  │                   │
    │  1. Connect with │                   │
    │     cookies      │                   │
    │─────────────────>│                   │
    │                  │  2. Extract       │
    │                  │     cookies       │
    │                  │                   │
    │                  │  3. Verify with   │
    │                  │     Clerk         │
    │                  │──────────────────>│
    │                  │<──────────────────│
    │                  │  4. Profile data  │
    │                  │                   │
    │  5. Connected    │                   │
    │<─────────────────│                   │
    │  (Authenticated) │                   │
```

---

### 3. Room System

Socket.IO sử dụng **rooms** để group connections:

```typescript
// Room naming conventions
const channelRoom = (channelId: string) => `channel:${channelId}`;
const serverRoom = (serverId: string) => `server:${serverId}`;
const conversationRoom = (convId: string) => `conversation:${convId}`;

// Join room
socket.join(channelRoom("abc123"));

// Emit to room (exclude sender)
socket.to(channelRoom("abc123")).emit("chat:message", data);

// Emit to room (include sender)
io.to(channelRoom("abc123")).emit("chat:message", data);

// Leave room
socket.leave(channelRoom("abc123"));
```

**Room hierarchy**:

```
Server: "server:123"
├── Channel: "channel:abc"
│   ├── Socket 1 (User A)
│   ├── Socket 2 (User B)
│   └── Socket 3 (User C)
├── Channel: "channel:def"
│   ├── Socket 1 (User A)
│   └── Socket 4 (User D)
└── Conversation: "conversation:xyz"
    ├── Socket 2 (User B)
    └── Socket 3 (User C)
```

---

### 4. Event Types (TypeScript)

**File**: `lib/socket/types.ts`

#### Server → Client Events

```typescript
type ServerToClientEvents = {
  // New message received
  "chat:message": (payload: {
    channelId: string;
    message: MessageWithMember;
  }) => void;

  // Someone is typing
  "chat:typing": (payload: {
    channelId: string;
    profileId: string;
    displayName: string;
    isTyping: boolean;
    emittedAt: number;
  }) => void;

  // Presence update (users online in channel)
  "presence:update": (payload: {
    channelId: string;
    users: PresenceUser[];
  }) => void;

  // Push notification
  "notification:new": (payload: {
    serverId: string;
    channelId: string;
    messageId: string;
    preview: string;
    senderName?: string;
  }) => void;
};
```

#### Client → Server Events

```typescript
type ClientToServerEvents = {
  // Join a channel
  "chat:join": (payload: {
    serverId: string;
    channelId: string;
  }) => void;

  // Leave a channel
  "chat:leave": (payload: {
    serverId: string;
    channelId: string;
  }) => void;

  // Join a conversation (DM)
  "conversation:join": (payload: {
    conversationId: string;
  }) => void;

  // User typing
  "chat:typing": (payload: {
    channelId: string;
    isTyping: boolean;
  }) => void;

  // Message delivered confirmation
  "chat:message:delivered": (payload: {
    channelId: string;
    messageId: string;
  }) => void;

  // Ping to keep presence alive
  "presence:ping": (payload: {
    channels: string[];
  }) => void;
};
```

---

### 5. Core Events

#### A. Chat Join

**Client**:
```typescript
socket.emit("chat:join", {
  serverId: "server123",
  channelId: "channel456"
});

// Listen for presence update
socket.on("presence:update", ({ channelId, users }) => {
  console.log(`${users.length} users online in ${channelId}`);
});
```

**Server**:
```typescript
socket.on("chat:join", async ({ serverId, channelId }) => {
  // 1. Verify user is member of server
  const member = await db.member.findFirst({
    where: { serverId, profileId: socket.data.profileId },
    include: { profile: true }
  });

  if (!member) {
    socket.emit("notification:new", {
      serverId,
      channelId,
      messageId: "",
      preview: "Bạn không có quyền truy cập kênh này."
    });
    return;
  }

  // 2. Join rooms
  socket.join(serverRoom(serverId));
  socket.join(channelRoom(channelId));

  // 3. Track in socket.data
  socket.data.serverIds.add(serverId);
  socket.data.channelIds.add(channelId);

  // 4. Add to presence manager
  presenceManager.joinChannel(channelId, {
    profileId: socket.data.profileId,
    memberId: member.id,
    serverId,
    channelId,
    displayName: member.profile.name,
    avatarUrl: member.profile.imageUrl,
    role: member.role,
    lastSeenAt: Date.now()
  });

  // 5. Broadcast presence update to all in channel
  const users = presenceManager.getChannelSnapshot(channelId);
  io.to(channelRoom(channelId)).emit("presence:update", {
    channelId,
    users
  });
});
```

**Flow**:

```
Client A                    Server                      Client B
   │                           │                           │
   │  chat:join               │                           │
   │─────────────────────────>│                           │
   │                           │  1. Verify member        │
   │                           │  2. Join rooms           │
   │                           │  3. Update presence      │
   │                           │                           │
   │  presence:update         │  presence:update          │
   │<─────────────────────────│────────────────────────>│
   │  (A joins)               │  (A joins)                │
```

---

#### B. Chat Message

**Server-side emit** (từ API route):

```typescript
import { emitChannelMessage } from '@/lib/socket/server';

// In API route after saving message to DB
const message = await db.message.create({
  data: { content, channelId, memberId },
  include: {
    member: { include: { profile: true } },
    channel: true
  }
});

// Emit to all users in channel
emitChannelMessage(channelId, message);
```

**Client-side receive**:

```typescript
socket.on("chat:message", ({ channelId, message }) => {
  console.log(`New message in ${channelId}:`, message.content);
  
  // Update UI
  addMessageToChat(message);
  
  // Show notification if not focused
  if (!document.hasFocus()) {
    new Notification(message.member.profile.name, {
      body: message.content
    });
  }
});
```

**Flow**:

```
Client A          API Route         Socket Server       Client B
   │                 │                    │                │
   │  POST message   │                    │                │
   │────────────────>│                    │                │
   │                 │  1. Save to DB     │                │
   │                 │  2. emitChannel    │                │
   │                 │     Message()      │                │
   │                 │───────────────────>│                │
   │                 │                    │  chat:message  │
   │                 │                    │───────────────>│
   │                 │                    │                │
   │  201 Created    │                    │  notification  │
   │<────────────────│                    │───────────────>│
   │                 │                    │  (if not sender)
```

---

#### C. Typing Indicator

**Client** (when user types):

```typescript
let typingTimeout: NodeJS.Timeout;

inputElement.addEventListener('input', () => {
  // Clear previous timeout
  clearTimeout(typingTimeout);
  
  // Emit typing start
  socket.emit("chat:typing", {
    channelId,
    isTyping: true
  });
  
  // Auto-stop after 3 seconds
  typingTimeout = setTimeout(() => {
    socket.emit("chat:typing", {
      channelId,
      isTyping: false
    });
  }, 3000);
});

// Listen for others typing
socket.on("chat:typing", ({ channelId, profileId, displayName, isTyping }) => {
  if (isTyping) {
    showTypingIndicator(displayName);
  } else {
    hideTypingIndicator(profileId);
  }
});
```

**Server**:

```typescript
socket.on("chat:typing", ({ channelId, isTyping }) => {
  // Update presence (touch lastSeenAt)
  presenceManager.touch(channelId, socket.data.profileId);
  
  // Broadcast to others in channel (exclude sender)
  socket.broadcast.to(channelRoom(channelId)).emit("chat:typing", {
    channelId,
    profileId: socket.data.profileId,
    displayName: socket.data.displayName,
    isTyping,
    emittedAt: Date.now()
  });
});
```

**Timeline**:

```
Time    Client A                    Server                Client B
0s      Start typing
        emit("typing", true)  ────>  broadcast ────────>  Show "A is typing..."
1s      Continue typing...
2s      Continue typing...
3s      (timeout)
        emit("typing", false) ────>  broadcast ────────>  Hide "A is typing..."
```

---

#### D. Presence Management

**File**: `lib/socket/presence.ts`

```typescript
class PresenceManager {
  // channelId → Map<profileId, PresenceUser>
  private channelPresence = new Map<string, Map<string, PresenceUser>>();

  // User joins channel
  joinChannel(channelId: string, user: PresenceUser) {
    const existing = this.channelPresence.get(channelId) ?? new Map();
    existing.set(user.profileId, {
      ...user,
      channelId,
      lastSeenAt: Date.now()
    });
    this.channelPresence.set(channelId, existing);
  }

  // User leaves channel
  leaveChannel(channelId: string, profileId: string) {
    const existing = this.channelPresence.get(channelId);
    if (!existing) return;
    
    existing.delete(profileId);
    if (!existing.size) {
      this.channelPresence.delete(channelId);
    }
  }

  // Remove user from all channels (on disconnect)
  removeProfile(profileId: string) {
    for (const [channelId, users] of this.channelPresence.entries()) {
      if (users.has(profileId)) {
        users.delete(profileId);
        if (!users.size) {
          this.channelPresence.delete(channelId);
        }
      }
    }
  }

  // Update lastSeenAt (keep-alive)
  touch(channelId: string, profileId: string) {
    const channelUsers = this.channelPresence.get(channelId);
    if (!channelUsers) return;
    
    const user = channelUsers.get(profileId);
    if (!user) return;
    
    channelUsers.set(profileId, {
      ...user,
      lastSeenAt: Date.now()
    });
  }

  // Get all users in channel
  getChannelSnapshot(channelId: string): PresenceUser[] {
    return Array.from(
      this.channelPresence.get(channelId)?.values() ?? []
    );
  }
}

export const presenceManager = new PresenceManager();
```

**Client-side keep-alive**:

```typescript
// Ping every 10 seconds to keep presence alive
useEffect(() => {
  const interval = setInterval(() => {
    socket.emit("presence:ping", {
      channels: [channelId]
    });
  }, 10000);

  return () => clearInterval(interval);
}, [channelId]);
```

**Data structure**:

```typescript
channelPresence = {
  "channel:abc123": {
    "profile1": {
      profileId: "profile1",
      memberId: "member1",
      serverId: "server123",
      channelId: "channel:abc123",
      displayName: "John Doe",
      avatarUrl: "https://...",
      role: "ADMIN",
      lastSeenAt: 1731398400000
    },
    "profile2": {
      // ...
    }
  },
  "channel:def456": {
    // ...
  }
}
```

---

#### E. Notifications

**Server-side emit**:

```typescript
import { emitServerNotification } from '@/lib/socket/server';

// Send notification to all members of server
emitServerNotification({
  serverId: "server123",
  channelId: "channel456",
  messageId: "msg789",
  preview: "New message from John",
  senderName: "John Doe"
});
```

**Auto-notification on message**:

```typescript
// In emitChannelMessage() function
const room = io.sockets.adapter.rooms.get(channelRoom(channelId));
if (room) {
  for (const socketId of room) {
    const socket = io.sockets.sockets.get(socketId);
    
    // Send notification to everyone except sender
    if (socket && socket.data.profileId !== message.member.profileId) {
      socket.emit("notification:new", {
        serverId: message.member.serverId,
        channelId,
        messageId: message.id,
        preview: message.content.slice(0, 120),
        senderName: message.member.profile.name
      });
    }
  }
}
```

**Client-side**:

```typescript
socket.on("notification:new", ({ channelId, preview, senderName }) => {
  // Show browser notification
  if (Notification.permission === "granted") {
    new Notification(senderName || "New message", {
      body: preview,
      icon: "/logo.png",
      tag: channelId  // Replace previous notification from same channel
    });
  }

  // Show in-app notification
  toast({
    title: senderName,
    description: preview
  });

  // Update unread count
  incrementUnreadCount(channelId);
});
```

---

#### F. Direct Messages (Conversations)

**Client**:

```typescript
// Join conversation room
socket.emit("conversation:join", {
  conversationId: "conv123"
});

// Listen for messages
socket.on("chat:message", ({ channelId, message }) => {
  // channelId will be conversation room ID
  console.log("DM received:", message);
});
```

**Server**:

```typescript
socket.on("conversation:join", async ({ conversationId }) => {
  // 1. Verify user is part of conversation
  const conversation = await db.conversation.findFirst({
    where: {
      id: conversationId,
      OR: [
        { memberOne: { profileId: socket.data.profileId } },
        { memberTwo: { profileId: socket.data.profileId } }
      ]
    }
  });

  if (!conversation) {
    console.log("Unauthorized conversation access");
    return;
  }

  // 2. Join conversation room
  const conversationRoom = `conversation:${conversationId}`;
  socket.join(conversationRoom);
  
  console.log(`User joined room: ${conversationRoom}`);
});
```

**Emit DM**:

```typescript
// In API route for direct message
const directMessage = await db.directMessage.create({
  data: { content, conversationId, memberId },
  include: { member: { include: { profile: true } } }
});

// Emit to conversation room
const io = getIO();
io.to(`conversation:${conversationId}`).emit("chat:message", {
  channelId: conversationId,  // Use conversationId as channelId
  message: directMessage
});
```

---

### 6. Client Socket Hook

**File**: `hooks/use-socket.ts`

```typescript
"use client";

import { useEffect, useState } from "react";
import { createSocket, TypedClientSocket } from "@/lib/socket/client";

export const useSocket = () => {
  const [socket, setSocket] = useState<TypedClientSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const socketInstance = createSocket();

    socketInstance.on("connect", () => {
      console.log("[SOCKET] Connected:", socketInstance.id);
      setIsConnected(true);
    });

    socketInstance.on("disconnect", () => {
      console.log("[SOCKET] Disconnected");
      setIsConnected(false);
    });

    socketInstance.on("connect_error", (error) => {
      console.error("[SOCKET] Connection error:", error);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  return { socket, isConnected };
};
```

**Usage**:

```typescript
const ChatComponent = () => {
  const { socket, isConnected } = useSocket();
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    if (!socket || !isConnected) return;

    // Join channel
    socket.emit("chat:join", { serverId, channelId });

    // Listen for messages
    socket.on("chat:message", ({ message }) => {
      setMessages(prev => [...prev, message]);
    });

    // Cleanup
    return () => {
      socket.emit("chat:leave", { serverId, channelId });
      socket.off("chat:message");
    };
  }, [socket, isConnected, channelId]);

  return <div>...</div>;
};
```

---

## 🔐 Security Features

### 1. Authentication

```typescript
// Middleware verifies Clerk session before allowing connection
io.use(async (socket, next) => {
  const profile = await currentProfilePages(req);
  if (!profile) {
    return next(new Error("Unauthorized"));
  }
  socket.data.profileId = profile.id;
  next();
});
```

### 2. Room Authorization

```typescript
// Verify member before joining channel
socket.on("chat:join", async ({ serverId, channelId }) => {
  const member = await db.member.findFirst({
    where: { serverId, profileId: socket.data.profileId }
  });

  if (!member) {
    socket.emit("notification:new", {
      preview: "You don't have permission"
    });
    return;
  }

  socket.join(channelRoom(channelId));
});
```

### 3. Data Validation

```typescript
// Validate payload before processing
socket.on("chat:join", ({ serverId, channelId }) => {
  if (!serverId || !channelId) {
    console.error("Invalid payload");
    return;
  }
  // Process...
});
```

---

## 📊 Monitoring & Debugging

### Server-side logs

```typescript
// Connection logs
console.log(`[SOCKET] 🔌 New connection: ${socket.id}`);
console.log(`[SOCKET] User ${profileId} joined channel ${channelId}`);
console.log(`[SOCKET] Socket rooms:`, Array.from(socket.rooms));

// Error logs
io.engine.on("connection_error", (error) => {
  console.warn("[SOCKET_ENGINE] Connection error", {
    code: error.code,
    message: error.message
  });
});
```

### Client-side logs

```typescript
socket.on("connect", () => {
  console.log("[SOCKET] Connected:", socket.id);
});

socket.on("disconnect", (reason) => {
  console.log("[SOCKET] Disconnected:", reason);
  // Reasons: "transport close", "server namespace disconnect", etc.
});

socket.on("connect_error", (error) => {
  console.error("[SOCKET] Connection error:", error.message);
});
```

### Admin dashboard

```typescript
// Get server stats
const io = getIO();

const stats = {
  totalSockets: io.sockets.sockets.size,
  rooms: Array.from(io.sockets.adapter.rooms.keys()),
  socketsPerRoom: {}
};

io.sockets.adapter.rooms.forEach((sockets, room) => {
  stats.socketsPerRoom[room] = sockets.size;
});

console.log("Socket.IO Stats:", stats);
```

---

## 🎯 Use Cases thực tế

### Use Case 1: Real-time Chat

```typescript
// Component: ChatMessages.tsx
const ChatMessages = ({ channelId }: { channelId: string }) => {
  const { socket, isConnected } = useSocket();
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    if (!socket || !isConnected) return;

    // Join channel
    socket.emit("chat:join", { serverId, channelId });

    // Listen for new messages
    const handleMessage = ({ message }: { message: Message }) => {
      setMessages(prev => [...prev, message]);
      scrollToBottom();
    };

    socket.on("chat:message", handleMessage);

    return () => {
      socket.emit("chat:leave", { serverId, channelId });
      socket.off("chat:message", handleMessage);
    };
  }, [socket, isConnected, channelId]);

  return (
    <div>
      {messages.map(msg => (
        <ChatItem key={msg.id} message={msg} />
      ))}
    </div>
  );
};
```

### Use Case 2: Typing Indicator

```typescript
// Component: ChatInput.tsx
const ChatInput = ({ channelId }: { channelId: string }) => {
  const { socket } = useSocket();
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  let typingTimeout: NodeJS.Timeout;

  useEffect(() => {
    if (!socket) return;

    // Listen for typing events
    const handleTyping = ({ profileId, displayName, isTyping }: any) => {
      setTypingUsers(prev => {
        if (isTyping) {
          return [...prev, displayName];
        } else {
          return prev.filter(name => name !== displayName);
        }
      });
    };

    socket.on("chat:typing", handleTyping);

    return () => {
      socket.off("chat:typing", handleTyping);
    };
  }, [socket]);

  const handleInputChange = () => {
    clearTimeout(typingTimeout);

    // Emit typing start
    socket?.emit("chat:typing", { channelId, isTyping: true });

    // Auto-stop after 3s
    typingTimeout = setTimeout(() => {
      socket?.emit("chat:typing", { channelId, isTyping: false });
    }, 3000);
  };

  return (
    <div>
      {typingUsers.length > 0 && (
        <p>{typingUsers.join(", ")} is typing...</p>
      )}
      <input onChange={handleInputChange} />
    </div>
  );
};
```

### Use Case 3: Online Users List

```typescript
// Component: MemberList.tsx
const MemberList = ({ channelId }: { channelId: string }) => {
  const { socket } = useSocket();
  const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([]);

  useEffect(() => {
    if (!socket) return;

    // Listen for presence updates
    const handlePresence = ({ users }: { users: PresenceUser[] }) => {
      setOnlineUsers(users);
    };

    socket.on("presence:update", handlePresence);

    // Send keep-alive ping every 10s
    const interval = setInterval(() => {
      socket.emit("presence:ping", { channels: [channelId] });
    }, 10000);

    return () => {
      socket.off("presence:update", handlePresence);
      clearInterval(interval);
    };
  }, [socket, channelId]);

  return (
    <div>
      <h3>Online Users ({onlineUsers.length})</h3>
      {onlineUsers.map(user => (
        <div key={user.profileId}>
          <Avatar src={user.avatarUrl} />
          <span>{user.displayName}</span>
          <Badge>{user.role}</Badge>
        </div>
      ))}
    </div>
  );
};
```

---

## 🚨 Error Handling

```typescript
// Server-side
socket.on("chat:join", async (payload) => {
  try {
    // Process...
  } catch (error) {
    console.error("[SOCKET] Error:", error);
    socket.emit("notification:new", {
      serverId: payload.serverId,
      channelId: payload.channelId,
      messageId: "",
      preview: "An error occurred. Please try again."
    });
  }
});

// Client-side
socket.on("connect_error", (error) => {
  if (error.message === "Unauthorized") {
    // Redirect to login
    window.location.href = "/sign-in";
  } else {
    // Show error toast
    toast.error("Connection failed. Retrying...");
  }
});
```

**Common errors**:
- `Unauthorized`: Authentication failed
- `transport close`: Connection lost
- `ping timeout`: No ping received (server down)
- `server namespace disconnect`: Server kicked client

---

## ⚡ Performance Optimization

### 1. Use WebSocket transport only

```typescript
transports: ["websocket"]  // Không dùng polling
```

### 2. Throttle typing events

```typescript
// Send typing event tối đa 1 lần/300ms
const throttledTyping = throttle(() => {
  socket.emit("chat:typing", { channelId, isTyping: true });
}, 300);
```

### 3. Cleanup event listeners

```typescript
useEffect(() => {
  socket.on("chat:message", handler);
  
  return () => {
    socket.off("chat:message", handler);  // Important!
  };
}, []);
```

### 4. Presence batching

```typescript
// Ping multiple channels at once
socket.emit("presence:ping", {
  channels: ["channel1", "channel2", "channel3"]
});
```

---

## 📈 Scalability

### Horizontal scaling với Redis adapter

```typescript
import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";

const pubClient = createClient({ url: "redis://localhost:6379" });
const subClient = pubClient.duplicate();

await Promise.all([pubClient.connect(), subClient.connect()]);

io.adapter(createAdapter(pubClient, subClient));
```

**Benefits**:
- Multiple server instances can share socket state
- Rooms work across instances
- Load balancing

---

## 🧪 Testing

```typescript
// Test connection
const socket = io("http://localhost:3000", {
  path: "/api/socket/io",
  transports: ["websocket"]
});

socket.on("connect", () => {
  console.log("✅ Connected:", socket.id);
  
  // Test join
  socket.emit("chat:join", {
    serverId: "test-server",
    channelId: "test-channel"
  });
});

socket.on("presence:update", (data) => {
  console.log("✅ Presence update:", data);
});
```

---

## ⚙️ Production Checklist

- [ ] Enable CORS với proper origin
- [ ] Set up authentication middleware
- [ ] Implement rate limiting
- [ ] Add error logging (Sentry)
- [ ] Monitor connection count
- [ ] Set up Redis adapter cho horizontal scaling
- [ ] Configure load balancer với sticky sessions
- [ ] Test reconnection logic
- [ ] Implement graceful shutdown
- [ ] Set up health check endpoint

---

## 📚 Tài liệu tham khảo

- [Socket.IO Documentation](https://socket.io/docs/v4/)
- [Socket.IO Client API](https://socket.io/docs/v4/client-api/)
- [Rooms & Namespaces](https://socket.io/docs/v4/rooms/)
- [Redis Adapter](https://socket.io/docs/v4/redis-adapter/)
- [Socket.IO with Next.js](https://socket.io/how-to/use-with-nextjs)

---

## 🤝 Support

Nếu có vấn đề:
1. Check server logs: `console.log` trong `pages/api/socket/io.ts`
2. Check client connection: `socket.connected`
3. Verify authentication: Cookie có được gửi không?
4. Test room membership: `Array.from(socket.rooms)`
5. Monitor network: DevTools → Network → WS

---

**Version**: 1.0.0  
**Last Updated**: November 12, 2025  
**Author**: Discord Baro Team
