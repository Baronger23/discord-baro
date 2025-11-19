# WebRTC Debug Commands

Paste these commands in browser console to debug WebRTC issues:

## Check Connection Status

```javascript
// Check if participants are being tracked
console.log("Participants:", window.participants);

// Check remote streams
console.log("Remote Streams:", window.remoteStreams);

// Check peer connections
console.log("Peer Connections:", window.peerConnections);
```

## Monitor WebRTC Events

```javascript
// Enable verbose logging
localStorage.setItem('webrtc-debug', 'true');

// Reload page
location.reload();
```

## Check Video Elements

```javascript
// Check all video elements
document.querySelectorAll('video').forEach((video, i) => {
  console.log(`Video ${i}:`, {
    srcObject: video.srcObject,
    tracks: video.srcObject?.getTracks(),
    muted: video.muted,
    paused: video.paused,
    readyState: video.readyState
  });
});
```

## Force Remote Stream Refresh

```javascript
// Get all remote streams and log them
const videos = document.querySelectorAll('video');
videos.forEach((v, i) => {
  if (v.srcObject) {
    console.log(`Video ${i} tracks:`, v.srcObject.getTracks());
  }
});
```

## Check Participant Data

Open browser dev tools and look for these logs:

```
✅ GOOD:
[useWebRTC] Peer joined: socket-123 John Doe
[WebRTCClient] Peer connection created for: socket-123 John Doe
[useWebRTC] Remote stream received from: socket-123

❌ BAD:
[useWebRTC] Peer joined: socket-123 Unknown
[WebRTCClient] No displayName for peer
```

## Common Issues

### "Unknown" Display Name
**Cause:** DisplayName not synced from server
**Check:** Server logs for `socket.data.displayName`
**Fix:** Make sure Clerk user data is loaded

### No Remote Video
**Cause:** Remote stream not emitted or video element not attached
**Check:** Console for "Received remote track" logs
**Fix:** Check ontrack handler and srcObject assignment

### Connection Failed
**Cause:** ICE candidates not exchanged or STUN server unreachable
**Check:** "ICE connection state: failed" in console
**Fix:** Check internet connection, try different network
