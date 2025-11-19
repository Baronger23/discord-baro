# Custom WebRTC Library

A complete WebRTC implementation for voice, video, and screen sharing, built to replace LiveKit with Socket.IO signaling.

## 📁 Project Structure

```
lib/webrtc/
├── constants.ts          # ICE servers and media constraints
├── types.ts              # TypeScript type definitions
├── media-manager.ts      # Media device management
├── webrtc-client.ts      # Peer connection manager
├── signaling.ts          # Socket.IO signaling integration
└── index.ts              # Library exports

hooks/
└── use-webrtc.ts         # React hook for WebRTC

components/webrtc/
└── media-room.tsx        # MediaRoom component (LiveKit replacement)

lib/socket/
├── types.ts              # Socket.IO event types (includes WebRTC events)
└── server.ts             # Socket.IO server with WebRTC signaling handlers
```

## 🚀 Quick Start

### 1. Basic Usage in a Channel

```tsx
import { MediaRoom } from "@/components/webrtc/media-room";

export default function VoiceChannel() {
  return (
    <MediaRoom
      chatId="channel-123"
      video={false}
      audio={true}
      displayName="John Doe"
    />
  );
}
```

### 2. Using the Hook Directly

```tsx
import { useWebRTC } from "@/hooks/use-webrtc";

export default function CustomVideoCall() {
  const {
    localStream,
    remoteStreams,
    audioEnabled,
    videoEnabled,
    toggleAudio,
    toggleVideo,
    startScreenShare,
    stopScreenShare,
    joinRoom,
    leaveRoom,
  } = useWebRTC({
    roomId: "my-room",
    displayName: "Alice",
    audio: true,
    video: true,
    autoJoin: true,
  });

  return (
    <div>
      <video ref={(el) => el && (el.srcObject = localStream)} autoPlay muted />
      
      {Array.from(remoteStreams.entries()).map(([peerId, stream]) => (
        <video key={peerId} ref={(el) => el && (el.srcObject = stream)} autoPlay />
      ))}

      <button onClick={toggleAudio}>
        {audioEnabled ? "Mute" : "Unmute"}
      </button>
      <button onClick={toggleVideo}>
        {videoEnabled ? "Stop Video" : "Start Video"}
      </button>
      <button onClick={startScreenShare}>Share Screen</button>
      <button onClick={leaveRoom}>Leave</button>
    </div>
  );
}
```

## 🏗️ Architecture

### WebRTC Flow

```
User A                    Socket.IO Server                User B
  |                              |                           |
  |--join-room------------------>|                           |
  |                              |<--join-room---------------|
  |                              |                           |
  |<---user-joined (with peers)--|                           |
  |                              |----user-joined----------->|
  |                              |                           |
  |--offer---------------------->|----offer----------------->|
  |                              |                           |
  |<--answer---------------------|<--answer------------------|
  |                              |                           |
  |--ice-candidate-------------->|----ice-candidate-------->|
  |<--ice-candidate--------------|<--ice-candidate----------|
  |                              |                           |
  |========== Direct P2P Connection Established =============|
  |                              |                           |
```

### Component Hierarchy

```
MediaRoom (UI Component)
    ↓
useWebRTC (React Hook)
    ↓
WebRTCClient (Peer Connection Manager)
    ↓
MediaManager (Device Access)
    ↓
Browser WebRTC APIs
    ↓
WebRTCSignaling (Socket.IO Integration)
    ↓
Socket.IO Server (Signaling)
```

## 📦 Core Classes

### MediaManager

Manages media devices (camera, microphone, screen).

```typescript
import { MediaManager } from "@/lib/webrtc";

const mediaManager = new MediaManager();

// Get camera and microphone
const stream = await mediaManager.getUserMedia(true, true);

// Get screen share
const screenStream = await mediaManager.getScreenShare();

// Toggle audio/video
mediaManager.setAudioEnabled(false);
mediaManager.setVideoEnabled(false);

// Switch devices
await mediaManager.switchAudioInput("device-id");
await mediaManager.switchVideoInput("device-id");

// Get available devices
const devices = await mediaManager.getDevices();

// Cleanup
mediaManager.cleanup();
```

### WebRTCClient

Manages peer connections and WebRTC negotiation.

```typescript
import { WebRTCClient } from "@/lib/webrtc";

const client = new WebRTCClient();

// Join a room
await client.joinRoom({
  roomId: "room-123",
  displayName: "John",
  audio: true,
  video: true,
});

// Listen for streams
client.on("local-stream", (stream) => {
  // Attach to video element
});

client.on("remote-stream", (peerId, stream) => {
  // Display remote stream
});

// Create offer for a peer
const offer = await client.createOffer("peer-id", "Peer Name");

// Handle incoming offer
const answer = await client.handleOffer("peer-id", "Peer Name", offer);

// Handle answer
await client.handleAnswer("peer-id", answer);

// Add ICE candidate
await client.addIceCandidate("peer-id", candidate);

// Screen sharing
await client.startScreenShare();
client.stopScreenShare();

// Leave room
client.leaveRoom();
client.destroy();
```

### WebRTCSignaling

Connects WebRTCClient to Socket.IO for signaling.

```typescript
import { WebRTCSignaling } from "@/lib/webrtc";
import { socket } from "@/lib/socket-client";
import { WebRTCClient } from "@/lib/webrtc";

const client = new WebRTCClient();
const signaling = new WebRTCSignaling(socket, client);

// Join room (triggers signaling)
signaling.joinRoom("room-123", "John Doe");

// Leave room
signaling.leaveRoom();

// Cleanup
signaling.destroy();
```

## 🎛️ Configuration

### ICE Servers

Edit `lib/webrtc/constants.ts` to configure STUN/TURN servers:

```typescript
export const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    // Add TURN servers for production
    // {
    //   urls: "turn:your-turn-server.com:3478",
    //   username: "user",
    //   credential: "pass"
    // }
  ],
};
```

### Media Constraints

Customize video/audio quality in `lib/webrtc/constants.ts`:

```typescript
export const DEFAULT_VIDEO_CONSTRAINTS = {
  width: { ideal: 1280, max: 1920 },
  height: { ideal: 720, max: 1080 },
  frameRate: { ideal: 30, max: 60 },
};

export const DEFAULT_AUDIO_CONSTRAINTS = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
};
```

## 🔌 Socket.IO Events

### Client → Server

- `webrtc:join-room` - Join a WebRTC room
- `webrtc:leave-room` - Leave a WebRTC room
- `webrtc:offer` - Send SDP offer to peer
- `webrtc:answer` - Send SDP answer to peer
- `webrtc:ice-candidate` - Send ICE candidate to peer

### Server → Client

- `webrtc:user-joined` - User joined room (includes existing peers)
- `webrtc:user-left` - User left room
- `webrtc:offer` - Received SDP offer from peer
- `webrtc:answer` - Received SDP answer from peer
- `webrtc:ice-candidate` - Received ICE candidate from peer

## 🎨 UI Components

### MediaRoom

Full-featured video/audio room with controls.

**Props:**
- `chatId` (string) - Unique room identifier
- `video` (boolean) - Enable video
- `audio` (boolean) - Enable audio
- `displayName` (string) - User's display name

**Features:**
- Responsive grid layout (1-12+ participants)
- Audio/video toggle buttons
- Screen sharing
- Participant names and mute indicators
- Connection state handling
- Error recovery

## 🔧 Customization

### Custom UI Components

```tsx
import { useWebRTC } from "@/hooks/use-webrtc";

export function CustomMediaRoom({ roomId, displayName }: Props) {
  const {
    localStream,
    remoteStreams,
    participants,
    audioEnabled,
    toggleAudio,
  } = useWebRTC({ roomId, displayName, audio: true });

  // Build your own UI
  return <YourCustomUI />;
}
```

### Extending WebRTCClient

```typescript
import { WebRTCClient } from "@/lib/webrtc";

class CustomWebRTCClient extends WebRTCClient {
  async enableNoiseCancellation() {
    // Custom audio processing
  }

  async applyVideoFilters() {
    // Custom video effects
  }
}
```

## 🐛 Debugging

### Enable Logging

All classes log to console with prefixes:

- `[MediaManager]` - Device access logs
- `[WebRTCClient]` - Peer connection logs
- `[SIGNALING]` - Signaling message logs
- `[useWebRTC]` - React hook logs
- `[WEBRTC]` - Server-side logs

### Common Issues

**No audio/video:**
1. Check browser permissions
2. Verify HTTPS (required for getUserMedia)
3. Check microphone/camera not in use by another app

**Connection fails:**
1. Verify STUN/TURN servers are reachable
2. Check firewall settings
3. Use TURN server for restrictive networks

**One-way audio/video:**
1. Check ICE candidate exchange
2. Verify both peers added tracks
3. Check NAT/firewall configuration

## 🚀 Production Deployment

### TURN Server Setup

For production, you need TURN servers for users behind restrictive firewalls:

```bash
# Using coturn
sudo apt-get install coturn

# Configure /etc/turnserver.conf
realm=your-domain.com
listening-ip=0.0.0.0
external-ip=YOUR_PUBLIC_IP
user=username:password
```

### Scaling Considerations

**Mesh Topology (Current):**
- Each peer connects to every other peer
- Good for 2-6 participants
- Bandwidth: O(n²)

**SFU Topology (Future):**
- Use Mediasoup or Janus
- Centralized media server
- Good for 6+ participants
- Bandwidth: O(n)

## 📊 Performance

### Bandwidth Usage (per participant)

**Audio only:**
- ~50 kbps per connection

**Video (720p):**
- ~1.5 Mbps per connection

**Screen share:**
- ~2-3 Mbps

### Browser Support

- Chrome 80+
- Firefox 75+
- Safari 14+
- Edge 80+

## 🔒 Security

- All connections encrypted with DTLS-SRTP
- Media streams peer-to-peer (not through server)
- Socket.IO authentication required
- Room access controlled by server

## 📝 Migration from LiveKit

### Before (LiveKit)

```tsx
import { MediaRoom } from "@livekit/components-react";

<MediaRoom
  video={true}
  audio={true}
  token={token}
  serverUrl={process.env.LIVEKIT_URL}
  data-lk-theme="default"
  style={{ height: "100dvh" }}
/>
```

### After (Custom WebRTC)

```tsx
import { MediaRoom } from "@/components/webrtc/media-room";

<MediaRoom
  chatId={channelId}
  video={true}
  audio={true}
  displayName={member.profile.name}
/>
```

## 🎯 Roadmap

- [x] Core WebRTC functionality
- [x] Socket.IO signaling
- [x] React hooks
- [x] MediaRoom component
- [ ] Recording support
- [ ] Virtual backgrounds
- [ ] Noise suppression filters
- [ ] Chat during calls
- [ ] Hand raise feature
- [ ] SFU architecture for large rooms

## 📄 License

MIT License - Use freely in your projects!
