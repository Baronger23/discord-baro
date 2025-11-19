/**
 * WebRTC Configuration Constants
 */

// STUN/TURN servers configuration
export const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    // Google's public STUN servers (free)
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
    
    // Optional: Add your own TURN server here for better connectivity
    // {
    //   urls: "turn:your-turn-server.com:3478",
    //   username: "username",
    //   credential: "password"
    // }
  ],
  iceCandidatePoolSize: 10,
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
