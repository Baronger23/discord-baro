# WebRTC Debugging Guide

## 🐛 Common Issues & Fixes

### Issue 1: "The order of m-lines in answer doesn't match order in offer"

**Cause:** WebRTC tracks được thêm theo thứ tự không nhất quán

**Fixed by:**
- ✅ Using `offerToReceiveAudio` and `offerToReceiveVideo` constraints
- ✅ Checking for existing peer connection before creating new one
- ✅ Setting remote description before creating answer
- ✅ Validating signaling state before setting remote description

### Issue 2: ICE candidates arrive before remote description

**Fixed by:**
- ✅ Checking `remoteDescription` exists before adding ICE candidate
- ✅ Logging warnings instead of crashing

## 🔍 How to Debug

### 1. Open Browser Console

Press F12 and go to Console tab

### 2. Check Socket.IO Connection

```javascript
// Should see in console:
[SOCKET] 🔌 New connection from profileId: xxx

// Test socket manually:
socket.connected // Should be true
```

### 3. Monitor WebRTC Flow

Look for these logs in order:

```
1. [useWebRTC] Initializing WebRTC client
2. [useWebRTC] Joining room: room-123
3. [WebRTCClient] Joining room
4. [MediaManager] Requested user media
5. [useWebRTC] Local stream received
6. [SIGNALING] Joining room
7. [WEBRTC] User joined room (server log)
8. [SIGNALING] User joined { peersCount: 1 }
9. [SIGNALING] Creating offer for existing peer
10. [WebRTCClient] Creating peer connection
11. [WebRTCClient] Created offer
12. [SIGNALING] Sent offer to peer
```

When another user receives offer:
```
1. [SIGNALING] Received offer from peer-xxx
2. [WebRTCClient] Creating peer connection
3. [WebRTCClient] Created answer
4. [SIGNALING] Sent answer to peer-xxx
```

When ICE candidates exchange:
```
[WebRTCClient] New ICE candidate for: peer-xxx
[SIGNALING] Sending ICE candidate to peer-xxx
[SIGNALING] Received ICE candidate from peer-xxx
[WebRTCClient] Added ICE candidate for: peer-xxx
```

When connection establishes:
```
[WebRTCClient] Connection state: peer-xxx connected
[WebRTCClient] ICE connection state: peer-xxx connected
[WebRTCClient] Received remote track: audio
[useWebRTC] Remote stream received from: peer-xxx
```

### 4. Common Error Patterns

#### No getUserMedia Permission
```
Error: Permission denied
```
**Fix:** Click "Allow" when browser asks for mic/camera

#### Socket Not Connected
```
[SOCKET_AUTH] Missing profile for handshake
```
**Fix:** Make sure you're logged in with Clerk

#### STUN Server Unreachable
```
[WebRTCClient] ICE connection state: failed
```
**Fix:** Check internet connection, try different network

#### No Audio/Video Devices
```
[MediaManager] No devices found
```
**Fix:** Make sure mic/camera is connected

## 🧪 Manual Testing Steps

### Test 1: Solo (Check Permissions)

1. Join a voice/video channel
2. Browser should ask for mic/camera permission
3. Click "Allow"
4. You should see your own video (if video enabled)
5. Check console - should see "Local stream received"

### Test 2: Two Users (Basic P2P)

**Tab 1:**
1. Open http://localhost:3000
2. Log in as User A
3. Go to Server → Voice Channel
4. Allow mic/camera
5. Wait in channel

**Tab 2:**
1. Open http://localhost:3000 (Incognito or different browser)
2. Log in as User B
3. Go to SAME Server → SAME Voice Channel
4. Allow mic/camera

**Expected:**
- Both tabs show "2 participants"
- You hear/see each other
- Console shows successful WebRTC negotiation

### Test 3: Controls

In either tab, test these buttons:
- 🎤 Mute/Unmute - Should toggle red icon
- 📹 Video On/Off - Should show/hide video
- 🖥️ Screen Share - Should replace video with screen
- 📞 Leave - Should disconnect

## 🔧 Quick Fixes

### Clear Everything and Start Fresh

```bash
# Stop dev server
Ctrl+C

# Clear browser cache
# Chrome: Ctrl+Shift+Delete → Clear all

# Restart dev server
npm run dev
```

### Force Restart WebRTC

In browser console:
```javascript
// Refresh the page
location.reload()
```

### Check WebRTC Stats

In browser console:
```javascript
// Get peer connection stats
document.querySelector('video').srcObject
  .getTracks()
  .forEach(track => console.log(track.kind, track.enabled, track.readyState))
```

## 📊 Expected Console Output

### Successful 2-User Connection

**User A (Joiner) Console:**
```
[useWebRTC] Initializing WebRTC client
[useWebRTC] Joining room: channel-123
[WebRTCClient] Joining room
[MediaManager] Requested user media: audio=true video=false
[MediaManager] Got user media stream
[useWebRTC] Local stream received
[SIGNALING] Joining room channel-123
[WEBRTC] User Alice joining room channel-123
[SIGNALING] User joined { peersCount: 0 }
[WebRTCClient] Successfully joined room
```

**User B (Already in room) Console:**
```
[SIGNALING] User joined { peerId: socket-xyz, displayName: Alice, peersCount: 1 }
[SIGNALING] Creating offer for existing peer socket-xyz
[WebRTCClient] Creating peer connection for: socket-xyz
[WebRTCClient] Created offer for: socket-xyz
[SIGNALING] Sent offer to socket-xyz
[SIGNALING] Received answer from socket-xyz
[WebRTCClient] Set remote description (answer)
[WebRTCClient] New ICE candidate for: socket-xyz
[WebRTCClient] Connection state: socket-xyz connected
[useWebRTC] Remote stream received from: socket-xyz
```

## ❌ Error Messages & Solutions

### "InvalidAccessError: Permission denied"
**Solution:** Click "Allow" for mic/camera permissions

### "NotFoundError: Requested device not found"
**Solution:** Connect microphone/camera to computer

### "InvalidStateError: Remote description not set"
**Solution:** Fixed in code - ICE candidates now wait for remote description

### "InvalidAccessError: The order of m-lines doesn't match"
**Solution:** Fixed in code - using consistent offer constraints

### "Socket.IO connection failed"
**Solution:** Make sure dev server is running and you're logged in

### "No peer connection found"
**Solution:** Normal during cleanup, ignore if call is ending

## 🎯 What Should Work Now

- ✅ Join voice channel (audio only)
- ✅ Join video channel (audio + video)
- ✅ See/hear other participants
- ✅ Mute/unmute audio
- ✅ Turn video on/off
- ✅ Share screen
- ✅ Leave call
- ✅ Multiple participants (2-6 users)

## 🚧 Known Limitations

- Mesh topology (best for 2-6 users)
- No TURN server yet (some firewalls may block)
- No recording yet
- No virtual backgrounds yet

## 🆘 Still Not Working?

1. **Check browser console** for errors
2. **Check server logs** in terminal
3. **Try different browser** (Chrome recommended)
4. **Check network** - firewall may block WebRTC
5. **Use localhost** - HTTPS not required for localhost

## 📝 Browser Support

- ✅ Chrome 80+
- ✅ Firefox 75+
- ✅ Edge 80+
- ✅ Safari 14+
- ❌ IE (not supported)

## 🔗 Resources

- **WebRTC Docs:** https://webrtc.org/
- **MDN Guide:** https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API
- **Troubleshooting:** https://webrtc.github.io/samples/
