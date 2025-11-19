/**
 * WebRTC Client - Main class for managing peer connections
 */

import { EventEmitter } from "events";
import { ICE_SERVERS } from "./constants";
import { MediaManager } from "./media-manager";
import type {
  ConnectionState,
  PeerConnection,
  LocalMediaState,
  WebRTCRoomOptions,
  WebRTCEvents,
  IceCandidate,
  RoomParticipant,
} from "./types";

export class WebRTCClient extends EventEmitter {
  private roomId: string | null = null;
  private localPeerId: string | null = null;
  private displayName: string = "";
  private peers: Map<string, PeerConnection> = new Map();
  private mediaManager: MediaManager;
  private connectionState: ConnectionState = "idle";
  private isJoining: boolean = false; // Prevent duplicate joins

  constructor() {
    super();
    this.mediaManager = new MediaManager();
  }

  /**
   * Join a room and start WebRTC connections
   */
  async joinRoom(options: WebRTCRoomOptions): Promise<void> {
    // Prevent duplicate joins
    if (this.isJoining || this.roomId) {
      console.log("[WebRTCClient] Already joining/joined, skipping");
      return;
    }

    this.isJoining = true;
    this.roomId = options.roomId;
    this.localPeerId = `peer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.displayName = options.displayName;

    console.log("[WebRTCClient] Joining room:", {
      roomId: this.roomId,
      peerId: this.localPeerId,
      displayName: this.displayName,
      audio: options.audio !== false,
      video: options.video === true,
    });

    try {
      console.log("[WebRTCClient] Requesting getUserMedia...");
      // Get local media
      const localStream = await this.mediaManager.getUserMedia(
        options.audio !== false,
        options.video === true
      );

      console.log("[WebRTCClient] Got local stream, emitting local-stream event");
      this.emit("local-stream", localStream);
      this.setConnectionState("connected");

      this.isJoining = false; // Join complete
      console.log("[WebRTCClient] Successfully joined room");
    } catch (error) {
      this.isJoining = false; // Reset on error
      console.error("[WebRTCClient] Failed to join room:", error);
      console.error("[WebRTCClient] Error details:", {
        name: (error as Error).name,
        message: (error as Error).message,
      });
      this.setConnectionState("failed");
      this.emit("error", error as Error);
      throw error;
    }
  }

  /**
   * Create peer connection for a remote peer
   */
  async createPeerConnection(peerId: string, displayName: string): Promise<RTCPeerConnection> {
    console.log("[WebRTCClient] Creating peer connection for:", peerId);

    const peerConnection = new RTCPeerConnection(ICE_SERVERS);

    // Add local stream tracks to connection
    const localStream = this.mediaManager.getLocalStream();
    if (localStream) {
      localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
      });
    }

    // Handle remote stream
    const remoteStream = new MediaStream();
    peerConnection.ontrack = (event) => {
      console.log("[WebRTCClient] Received remote track:", event.track.kind, "from:", peerId);
      
      // Add track to remote stream
      if (event.streams && event.streams[0]) {
        event.streams[0].getTracks().forEach(track => {
          remoteStream.addTrack(track);
        });
      } else {
        remoteStream.addTrack(event.track);
      }

      // Update peer's remote stream
      const peer = this.peers.get(peerId);
      if (peer) {
        peer.remoteStream = remoteStream;
        console.log("[WebRTCClient] Emitting remote-stream for:", peerId);
        this.emit("remote-stream", peerId, remoteStream);
      }
    };

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log("[WebRTCClient] New ICE candidate for:", peerId);
        this.emit("ice-candidate", {
          peerId,
          candidate: {
            candidate: event.candidate.candidate,
            sdpMid: event.candidate.sdpMid,
            sdpMLineIndex: event.candidate.sdpMLineIndex,
          },
        });
      }
    };

    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
      console.log("[WebRTCClient] Connection state:", peerId, peerConnection.connectionState);

      if (peerConnection.connectionState === "disconnected" || 
          peerConnection.connectionState === "failed") {
        this.removePeer(peerId);
      }
    };

    // Handle ICE connection state
    peerConnection.oniceconnectionstatechange = () => {
      console.log("[WebRTCClient] ICE connection state:", peerId, peerConnection.iceConnectionState);
    };

    // Store peer connection
    this.peers.set(peerId, {
      peerId,
      displayName,
      connection: peerConnection,
      remoteStream: null,
      audioEnabled: true,
      videoEnabled: true,
      screenSharing: false,
    });

    // Emit peer-joined event
    this.emit("peer-joined", {
      id: peerId,
      displayName,
      audioEnabled: true,
      videoEnabled: true,
      screenSharing: false,
      joinedAt: new Date(),
    });

    console.log("[WebRTCClient] Peer connection created for:", peerId, displayName);

    return peerConnection;
  }

  /**
   * Create and send offer to a peer
   */
  async createOffer(peerId: string, displayName: string): Promise<RTCSessionDescriptionInit> {
    // Check if peer connection already exists
    let peerConnection = this.peers.get(peerId)?.connection;
    if (!peerConnection) {
      peerConnection = await this.createPeerConnection(peerId, displayName);
    }

    // Create offer with consistent constraints
    const offer = await peerConnection.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    });
    await peerConnection.setLocalDescription(offer);

    console.log("[WebRTCClient] Created offer for:", peerId);

    return offer;
  }

  /**
   * Handle incoming offer from a peer
   */
  async handleOffer(
    peerId: string,
    displayName: string,
    offer: RTCSessionDescriptionInit
  ): Promise<RTCSessionDescriptionInit> {
    // Check if peer connection already exists
    let peerConnection = this.peers.get(peerId)?.connection;
    if (!peerConnection) {
      peerConnection = await this.createPeerConnection(peerId, displayName);
    }

    // Set remote description first
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

    // Create answer - WebRTC will automatically match the m-line order from offer
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    console.log("[WebRTCClient] Created answer for:", peerId);

    return answer;
  }

  /**
   * Handle incoming answer from a peer
   */
  async handleAnswer(peerId: string, answer: RTCSessionDescriptionInit): Promise<void> {
    const peer = this.peers.get(peerId);
    if (!peer) {
      console.warn("[WebRTCClient] No peer connection found for:", peerId);
      return;
    }

    // Only set remote description if we're in the right state
    if (peer.connection.signalingState === "have-local-offer") {
      await peer.connection.setRemoteDescription(new RTCSessionDescription(answer));
      console.log("[WebRTCClient] Set remote description (answer) for:", peerId);
    } else {
      console.warn("[WebRTCClient] Invalid signaling state for answer:", peer.connection.signalingState);
    }
  }

  /**
   * Add ICE candidate from a peer
   */
  async addIceCandidate(peerId: string, candidate: IceCandidate): Promise<void> {
    const peer = this.peers.get(peerId);
    if (!peer) {
      console.warn("[WebRTCClient] No peer connection found for:", peerId);
      return;
    }

    try {
      // Check if remote description is set before adding candidate
      if (peer.connection.remoteDescription) {
        await peer.connection.addIceCandidate(
          new RTCIceCandidate({
            candidate: candidate.candidate,
            sdpMid: candidate.sdpMid,
            sdpMLineIndex: candidate.sdpMLineIndex,
          })
        );
        console.log("[WebRTCClient] Added ICE candidate for:", peerId);
      } else {
        console.warn("[WebRTCClient] Remote description not set yet, ignoring ICE candidate for:", peerId);
      }
    } catch (error) {
      console.error("[WebRTCClient] Failed to add ICE candidate:", error);
    }
  }

  /**
   * Remove peer connection
   */
  removePeer(peerId: string): void {
    const peer = this.peers.get(peerId);
    if (peer) {
      peer.connection.close();
      this.peers.delete(peerId);
      this.emit("peer-left", peerId);
      console.log("[WebRTCClient] Removed peer:", peerId);
    }
  }

  /**
   * Toggle audio mute
   */
  setAudioEnabled(enabled: boolean): void {
    this.mediaManager.setAudioEnabled(enabled);
    this.broadcastMediaStateChange({ audioEnabled: enabled });
  }

  /**
   * Toggle video
   */
  setVideoEnabled(enabled: boolean): void {
    this.mediaManager.setVideoEnabled(enabled);
    this.broadcastMediaStateChange({ videoEnabled: enabled });
  }

  /**
   * Start screen sharing
   */
  async startScreenShare(): Promise<void> {
    try {
      const screenStream = await this.mediaManager.getScreenShare();

      // Replace video track in all peer connections
      const videoTrack = screenStream.getVideoTracks()[0];

      this.peers.forEach((peer) => {
        const sender = peer.connection
          .getSenders()
          .find(s => s.track?.kind === "video");

        if (sender) {
          sender.replaceTrack(videoTrack);
        }
      });

      this.broadcastMediaStateChange({ screenSharing: true });

      console.log("[WebRTCClient] Started screen sharing");
    } catch (error) {
      console.error("[WebRTCClient] Failed to start screen share:", error);
      throw error;
    }
  }

  /**
   * Stop screen sharing
   */
  async stopScreenShare(): Promise<void> {
    this.mediaManager.stopScreenShare();

    // Restore camera video track
    const localStream = this.mediaManager.getLocalStream();
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];

      if (videoTrack) {
        this.peers.forEach((peer) => {
          const sender = peer.connection
            .getSenders()
            .find(s => s.track?.kind === "video");

          if (sender) {
            sender.replaceTrack(videoTrack);
          }
        });
      }
    }

    this.broadcastMediaStateChange({ screenSharing: false });

    console.log("[WebRTCClient] Stopped screen sharing");
  }

  /**
   * Broadcast media state change to all peers
   */
  private broadcastMediaStateChange(state: Partial<LocalMediaState>): void {
    this.emit("media-state-changed", state);
  }

  /**
   * Update peer's media state (called when receiving state from signaling)
   */
  updatePeerMediaState(peerId: string, state: Partial<LocalMediaState>): void {
    const peer = this.peers.get(peerId);
    if (peer) {
      if (state.audioEnabled !== undefined) peer.audioEnabled = state.audioEnabled;
      if (state.videoEnabled !== undefined) peer.videoEnabled = state.videoEnabled;
      if (state.screenSharing !== undefined) peer.screenSharing = state.screenSharing;
      
      this.emit("peer-media-changed", peerId, state);
      console.log("[WebRTCClient] Updated peer media state:", peerId, state);
    }
  }

  /**
   * Update peer's display name
   */
  updatePeerDisplayName(peerId: string, displayName: string): void {
    const peer = this.peers.get(peerId);
    if (peer && displayName && displayName !== "Unknown") {
      peer.displayName = displayName;
      console.log("[WebRTCClient] Updated peer display name:", peerId, displayName);
      
      // Re-emit peer-joined with updated info
      this.emit("peer-joined", {
        id: peerId,
        displayName,
        audioEnabled: peer.audioEnabled,
        videoEnabled: peer.videoEnabled,
        screenSharing: peer.screenSharing,
        joinedAt: new Date(),
      });
    }
  }

  /**
   * Get all participants
   */
  getParticipants(): RoomParticipant[] {
    const participants: RoomParticipant[] = [];

    // Add self
    if (this.localPeerId) {
      const mediaState = this.mediaManager.getMediaState();
      participants.push({
        id: this.localPeerId,
        displayName: this.displayName,
        audioEnabled: mediaState.audioEnabled,
        videoEnabled: mediaState.videoEnabled,
        screenSharing: mediaState.screenSharing,
        joinedAt: new Date(),
      });
    }

    // Add remote peers
    this.peers.forEach((peer) => {
      participants.push({
        id: peer.peerId,
        displayName: peer.displayName,
        audioEnabled: peer.audioEnabled,
        videoEnabled: peer.videoEnabled,
        screenSharing: peer.screenSharing,
        joinedAt: new Date(),
      });
    });

    return participants;
  }

  /**
   * Get local peer ID
   */
  getLocalPeerId(): string | null {
    return this.localPeerId;
  }

  /**
   * Get connection state
   */
  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  /**
   * Set connection state
   */
  private setConnectionState(state: ConnectionState): void {
    if (this.connectionState !== state) {
      this.connectionState = state;
      this.emit("connection-state-change", state);
    }
  }

  /**
   * Leave room and cleanup
   */
  leaveRoom(): void {
    console.log("[WebRTCClient] Leaving room");

    this.isJoining = false; // Reset flag

    // Close all peer connections
    this.peers.forEach((peer) => {
      peer.connection.close();
      console.log("[WebRTCClient] Closed peer connection:", peer.peerId);
    });
    this.peers.clear();

    // Stop and cleanup all media streams
    const localStream = this.mediaManager.getLocalStream();
    if (localStream) {
      localStream.getTracks().forEach(track => {
        track.stop();
        console.log("[WebRTCClient] Stopped local track:", track.kind);
      });
    }

    // Cleanup media manager
    this.mediaManager.cleanup();

    this.roomId = null;
    this.localPeerId = null;
    this.setConnectionState("disconnected");
    
    console.log("[WebRTCClient] Room left, all media stopped");
  }

  /**
   * Cleanup and disconnect
   */
  destroy(): void {
    this.leaveRoom();
    this.removeAllListeners();
  }
}
