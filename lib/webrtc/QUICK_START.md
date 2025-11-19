# WebRTC Quick Start Guide

## 🚀 Get Started in 5 Minutes

### Step 1: Import the MediaRoom Component

```tsx
import { MediaRoom } from "@/components/webrtc/media-room";
```

### Step 2: Use it in Your Channel/Page

```tsx
export default function VoiceChannel({ channelId }: { channelId: string }) {
  const user = useUser(); // Your user data hook

  return (
    <div className="h-screen">
      <MediaRoom
        chatId={channelId}
        video={false}
        audio={true}
        displayName={user.name}
      />
    </div>
  );
}
```

### Step 3: Done! 🎉

That's it! Your voice/video chat is ready.

---

## 📝 Common Use Cases

### Voice-Only Channel

```tsx
<MediaRoom
  chatId="voice-channel-123"
  video={false}  // ← No video
  audio={true}   // ← Only audio
  displayName="John Doe"
/>
```

### Video Call

```tsx
<MediaRoom
  chatId="video-room-456"
  video={true}   // ← With video
  audio={true}   // ← With audio
  displayName="Alice"
/>
```

### Custom Hook (Advanced)

```tsx
import { useWebRTC } from "@/hooks/use-webrtc";

function MyCustomCall() {
  const {
    localStream,
    remoteStreams,
    audioEnabled,
    toggleAudio,
    toggleVideo,
    startScreenShare,
  } = useWebRTC({
    roomId: "my-room",
    displayName: "Bob",
    audio: true,
    video: true,
    autoJoin: true,
  });

  // Build your own UI with these values
}
```

---

## 🎛️ MediaRoom Props

| Prop | Type | Description |
|------|------|-------------|
| `chatId` | string | Unique room identifier |
| `video` | boolean | Enable video (true/false) |
| `audio` | boolean | Enable audio (true/false) |
| `displayName` | string | User's display name |

---

## 🔧 Configuration

### Change Video Quality

Edit `lib/webrtc/constants.ts`:

```typescript
export const DEFAULT_VIDEO_CONSTRAINTS = {
  width: { ideal: 1920, max: 1920 },  // 1080p
  height: { ideal: 1080, max: 1080 },
  frameRate: { ideal: 60, max: 60 },  // 60fps
};
```

### Add TURN Servers (Production)

Edit `lib/webrtc/constants.ts`:

```typescript
export const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    {
      urls: "turn:your-turn-server.com:3478",
      username: "your-username",
      credential: "your-password"
    }
  ],
};
```

---

## 🧪 Testing

1. Open your app in two browser tabs
2. Join the same room in both tabs
3. Allow camera/microphone permissions
4. You should see/hear each other!

**Important:** Must use `https://` or `localhost` (getUserMedia requirement)

---

## 🐛 Troubleshooting

### No Audio/Video?

1. Check browser permissions (camera/mic)
2. Use HTTPS (not HTTP)
3. Check console for errors
4. Try a different browser

### Connection Fails?

1. Check if Socket.IO is connected
2. Verify STUN/TURN servers are reachable
3. Check firewall settings
4. For production, use TURN servers

### One Person Can't See/Hear?

1. Check both users have permissions
2. Verify Socket.IO connection on both sides
3. Check browser console for errors
4. Try refreshing both tabs

---

## 📚 More Examples

See `lib/webrtc/examples.tsx` for:
- Screen sharing
- Device selection
- Connection status
- Participant lists
- Custom controls
- And more!

---

## 🔗 Useful Links

- **Full Documentation:** `lib/webrtc/README.md`
- **Implementation Details:** `lib/webrtc/IMPLEMENTATION_SUMMARY.md`
- **Code Examples:** `lib/webrtc/examples.tsx`

---

## 💡 Tips

1. **Always use unique `chatId`** for each room
2. **Enable HTTPS** in production (required for camera/mic)
3. **Add TURN servers** for users behind firewalls
4. **Test with 2-3 users** first before scaling
5. **Monitor bandwidth** for large rooms (6+ users)

---

## 🎯 Next Steps

1. Replace existing LiveKit components with `MediaRoom`
2. Test with 2-3 users in dev environment
3. Add TURN servers for production
4. Deploy and test in production
5. Monitor performance and bandwidth

---

**Need Help?** Check the full documentation in `lib/webrtc/README.md`
