/**
 * WebRTC Configuration Constants
 */

// STUN/TURN servers configuration
export const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    // Google's public STUN servers (free)
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    
    // Free TURN servers for mobile/NAT traversal (Metered.ca open relay)
    {
      urls: "turn:openrelay.metered.ca:80",
      username: "openrelayproject",
      credential: "openrelayproject"
    },
    {
      urls: "turn:openrelay.metered.ca:443",
      username: "openrelayproject",
      credential: "openrelayproject"
    },
    {
      urls: "turn:openrelay.metered.ca:443?transport=tcp",
      username: "openrelayproject",
      credential: "openrelayproject"
    },
  ],
  iceCandidatePoolSize: 10,
  iceTransportPolicy: "all", // Try all connection types including relay
  bundlePolicy: "max-bundle",
  rtcpMuxPolicy: "require",
};

// Media constraints
export const DEFAULT_AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
};

export const DEFAULT_VIDEO_CONSTRAINTS: MediaTrackConstraints = {
  width: { ideal: 1280, max: 1920 },
  height: { ideal: 720, max: 1080 },
  frameRate: { ideal: 30, max: 60 },
};

export const SCREEN_SHARE_CONSTRAINTS: DisplayMediaStreamOptions = {
  video: {
    cursor: "always",
    displaySurface: "monitor",
  } as MediaTrackConstraints,
  audio: false,
};

// Connection timeouts
export const CONNECTION_TIMEOUT = 30000; // 30 seconds
export const ICE_GATHERING_TIMEOUT = 10000; // 10 seconds
