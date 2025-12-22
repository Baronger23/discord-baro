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
  // Queue for early ICE candidates (arrived before setRemoteDescription)
  private candidateQueue: Map<string, RTCIceCandidateInit[]> = new Map();

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

    // CRITICAL: Check for zombie connection (A disconnected and rejoined)
    const existingPeer = this.peers.get(peerId);
    if (existingPeer) {
      console.warn(`[WebRTCClient] 🧟 Found ZOMBIE connection for ${peerId}. Killing it now!`);
      
      // 1. Close old connection
      existingPeer.connection.close();
      
      // 2. Remove from peers map
      this.peers.delete(peerId);
      
      // 3. Clean up ICE candidate queue
      if (this.candidateQueue.has(peerId)) {
        this.candidateQueue.delete(peerId);
      }
      
      // 4. Emit event to remove old video from UI
      this.emit("peer-left", peerId);
      
      console.log("[WebRTCClient] ✅ Zombie connection killed, creating fresh peer");
    }

    const peerConnection = new RTCPeerConnection(ICE_SERVERS);

    // Add local stream tracks to connection (camera/audio)
    const localStream = this.mediaManager.getLocalStream();
    if (localStream) {
      localStream.getTracks().forEach(track => {
        console.log(`[WebRTCClient] Adding local ${track.kind} track to peer:`, peerId);
        peerConnection.addTrack(track, localStream);
      });
    }

    // IMPORTANT: If we're already screen sharing, add screen track immediately
    const screenStream = this.mediaManager.getScreenStream();
    console.log(`[WebRTCClient] 🔍 Checking for existing screen stream:`, {
      hasScreenStream: !!screenStream,
      screenStreamId: screenStream?.id,
      videoTracks: screenStream?.getVideoTracks().length || 0
    });
    
    if (screenStream) {
      const screenTrack = screenStream.getVideoTracks()[0];
      if (screenTrack) {
        console.log(`[WebRTCClient] 📺 Adding existing screen share track to new peer:`, peerId);
        console.log(`[WebRTCClient] Screen track details:`, {
          id: screenTrack.id,
          label: screenTrack.label,
          enabled: screenTrack.enabled,
          readyState: screenTrack.readyState
        });
        peerConnection.addTrack(screenTrack, screenStream);
      } else {
        console.warn(`[WebRTCClient] ⚠️ Screen stream exists but no video track!`);
      }
    } else {
      console.log(`[WebRTCClient] ℹ️ No screen stream - not currently screen sharing`);
    }

    // Handle remote stream - separate camera and screen
    const remoteCameraStream = new MediaStream();
    const remoteScreenStream = new MediaStream();
    
    peerConnection.ontrack = (event) => {
      console.log("[WebRTCClient] 📥 Received remote track:", event.track.kind, "from:", peerId);
      console.log("[WebRTCClient] Track details:", {
        id: event.track.id,
        label: event.track.label,
        kind: event.track.kind,
        readyState: event.track.readyState,
        streamCount: event.streams?.length,
        streamId: event.streams?.[0]?.id,
      });
      
      // Detect if this is screen share or camera based on stream label or track count
      const streamId = event.streams?.[0]?.id || '';
      const trackLabel = event.track.label?.toLowerCase() || '';
      const isScreenShare = streamId.includes('screen') || trackLabel.includes('screen');
      
      console.log("[WebRTCClient] Detection:", {
        streamId,
        trackLabel,
        isScreenShare,
      });
      
      if (isScreenShare) {
        console.log("[WebRTCClient] 📺 Detected SCREEN SHARE track from:", peerId);
        remoteScreenStream.addTrack(event.track);
        
        // Update peer's screen stream
        const peer = this.peers.get(peerId);
        if (peer) {
          peer.remoteScreenStream = remoteScreenStream;
          console.log("[WebRTCClient] ✅ Updated peer screen stream. Emitting remote-stream (screen) for:", peerId);
          console.log("[WebRTCClient] Stream details:", {
            id: remoteScreenStream.id,
            videoTracks: remoteScreenStream.getVideoTracks().length,
          });
          this.emit("remote-stream", peerId, remoteScreenStream, "screen");
        }
      } else {
        console.log("[WebRTCClient] 🎥 Detected CAMERA track from:", peerId);
        remoteCameraStream.addTrack(event.track);
        
        // Update peer's camera stream
        const peer = this.peers.get(peerId);
        if (peer) {
          peer.remoteCameraStream = remoteCameraStream;
          console.log("[WebRTCClient] ✅ Updated peer camera stream. Emitting remote-stream (camera) for:", peerId);
          console.log("[WebRTCClient] Stream details:", {
            id: remoteCameraStream.id,
            videoTracks: remoteCameraStream.getVideoTracks().length,
            audioTracks: remoteCameraStream.getAudioTracks().length,
          });
          this.emit("remote-stream", peerId, remoteCameraStream, "camera");
        }
      }
    };

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        // Parse candidate type for debugging
        const candidateStr = event.candidate.candidate;
        const typeMatch = candidateStr.match(/typ (\w+)/);
        const candidateType = typeMatch ? typeMatch[1] : 'unknown';
        
        console.log(`[WebRTCClient] 🧊 ICE candidate [${candidateType}] for ${peerId}`);
        
        // Important: relay = TURN server working (needed for mobile)
        if (candidateType === 'relay') {
          console.log("[WebRTCClient] ✅ Got TURN relay candidate - mobile connectivity enabled");
        }
        
        this.emit("ice-candidate", {
          peerId,
          candidate: {
            candidate: event.candidate.candidate,
            sdpMid: event.candidate.sdpMid,
            sdpMLineIndex: event.candidate.sdpMLineIndex,
          },
        });
      } else {
        console.log("[WebRTCClient] ✅ ICE gathering complete for:", peerId);
      }
    };

    // Handle renegotiation (CRITICAL for dual stream)
    peerConnection.onnegotiationneeded = async () => {
      console.log("[WebRTCClient] 🔄 Negotiation needed for peer:", peerId);
      
      const peer = this.peers.get(peerId);
      if (!peer) {
        console.log("[WebRTCClient] ⚠️ Peer not found in map during renegotiation");
        return;
      }
      
      console.log("[WebRTCClient] Negotiation context:", {
        peerId,
        initialSetupComplete: peer.isInitialSetupComplete,
        signalingState: peerConnection.signalingState,
        connectionState: peerConnection.connectionState,
      });
      
      // Skip during initial setup or if not stable
      if (!peer.isInitialSetupComplete) {
        console.log("[WebRTCClient] ⏭️ Skipping renegotiation - initial setup not complete");
        return;
      }
      
      if (peerConnection.signalingState !== "stable") {
        console.log("[WebRTCClient] ⏭️ Skipping renegotiation - signaling state not stable:", peerConnection.signalingState);
        console.log("[WebRTCClient] 💡 This prevents 'no pending remote description' error");
        return;
      }

      try {
        console.log("[WebRTCClient] ✅ Safe to renegotiate - creating offer for:", peerId);
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        
        // Wait for ICE gathering to complete
        if (peerConnection.iceGatheringState !== "complete") {
          console.log("[WebRTCClient] Waiting for ICE gathering...");
          await new Promise<void>((resolve) => {
            const checkGathering = () => {
              if (peerConnection.iceGatheringState === "complete") {
                peerConnection.removeEventListener("icegatheringstatechange", checkGathering);
                resolve();
              }
            };
            peerConnection.addEventListener("icegatheringstatechange", checkGathering);
            // Timeout after 1.5s
            setTimeout(() => {
              peerConnection.removeEventListener("icegatheringstatechange", checkGathering);
              console.log("[WebRTCClient] ICE gathering timeout, proceeding anyway");
              resolve();
            }, 1500);
          });
        }
        
        // Emit renegotiation offer through signaling
        this.emit("renegotiation-needed", peerId);
        
        console.log("[WebRTCClient] ✅ Renegotiation offer created for:", peerId);
      } catch (error) {
        console.error("[WebRTCClient] ❌ Renegotiation failed:", error);
        console.error("[WebRTCClient] Signaling state during error:", peerConnection.signalingState);
      }
    };

    // Handle connection state changes
    peerConnection.onconnectionstatechange = async () => {
      console.log("[WebRTCClient] ⚡ Connection state:", peerId, peerConnection.connectionState);

      const peer = this.peers.get(peerId);
      
      // Enable renegotiation when connection is established
      if (peerConnection.connectionState === "connected" && peer) {
        console.log("[WebRTCClient] ✅ Connection established. Enabling renegotiation for:", peerId);
        peer.isInitialSetupComplete = true;
        // Reset reconnect counter on success
        peer.reconnectAttempts = 0;
        peer.reconnecting = false;
      }

      if (peerConnection.connectionState === "disconnected") {
        console.warn("[WebRTCClient] ⚠️ Connection disconnected for:", peerId);
        // Give time for auto-reconnect before triggering manual restart
        setTimeout(() => {
          const currentPeer = this.peers.get(peerId);
          if (currentPeer?.connection.connectionState === "disconnected") {
            console.log("[WebRTCClient] Still disconnected, attempting ICE restart...");
            this.attemptReconnection(peerId);
          }
        }, 1000);
      }

      if (peerConnection.connectionState === "failed") {
        console.error("[WebRTCClient] ❌ Connection FAILED for:", peerId);
        // Try to reconnect instead of immediate removal
        await this.attemptReconnection(peerId);
      }
    };

    // Handle ICE connection state
    peerConnection.oniceconnectionstatechange = () => {
      console.log("[WebRTCClient] ⚡ ICE state:", peerId, peerConnection.iceConnectionState);
      
      if (peerConnection.iceConnectionState === "connected" || 
          peerConnection.iceConnectionState === "completed") {
        console.log("[WebRTCClient] ✅ ICE connected for:", peerId);
      }
      
      if (peerConnection.iceConnectionState === "failed") {
        console.error("[WebRTCClient] ❌ ICE FAILED for:", peerId);
        console.error("[WebRTCClient] Common causes: mobile NAT, firewall, no TURN relay");
      }
    };

    // Handle ICE gathering state
    peerConnection.onicegatheringstatechange = () => {
      console.log("[WebRTCClient] 🔍 ICE gathering:", peerId, peerConnection.iceGatheringState);
    };

    // Store peer connection
    this.peers.set(peerId, {
      peerId,
      displayName,
      connection: peerConnection,
      remoteCameraStream: null,
      remoteScreenStream: null,
      audioEnabled: true,
      videoEnabled: true,
      screenSharing: false,
      isInitialSetupComplete: false,  // Will be set to true when connection established
      reconnectAttempts: 0,  // Track reconnection tries
      reconnecting: false,  // Reconnection in progress flag
    });

    console.log("[WebRTCClient] Peer connection created for:", peerId, displayName);
    console.log("[WebRTCClient] Local tracks added:", localStream?.getTracks().length || 0);

    return peerConnection;
  }

  /**
   * Create and send offer to a peer
   */
  async createOffer(peerId: string, displayName: string): Promise<RTCSessionDescriptionInit> {
    console.log("[WebRTCClient] 📤 createOffer called for:", peerId, displayName);
    
    // Check if we have screen stream BEFORE creating peer connection
    const screenStream = this.mediaManager.getScreenStream();
    console.log("[WebRTCClient] 🔍 Screen stream status BEFORE peer creation:", {
      hasScreenStream: !!screenStream,
      screenStreamId: screenStream?.id,
      videoTracks: screenStream?.getVideoTracks().length || 0
    });
    
    // Check if peer connection already exists
    let peerConnection = this.peers.get(peerId)?.connection;
    if (!peerConnection) {
      console.log("[WebRTCClient] Creating NEW peer connection in createOffer for:", peerId);
      peerConnection = await this.createPeerConnection(peerId, displayName);
    } else {
      console.log("[WebRTCClient] Using EXISTING peer connection for:", peerId);
      
      // CRITICAL: If we're screen sharing and peer connection exists,
      // check if screen track is already added. If not, add it NOW before creating offer.
      if (screenStream) {
        const screenTrack = screenStream.getVideoTracks()[0];
        if (screenTrack) {
          const senders = peerConnection.getSenders();
          const screenTrackExists = senders.some(sender => sender.track?.id === screenTrack.id);
          
          if (!screenTrackExists) {
            console.log("[WebRTCClient] 📺 Existing peer missing screen track - adding now!");
            peerConnection.addTrack(screenTrack, screenStream);
          } else {
            console.log("[WebRTCClient] ✅ Screen track already in existing peer connection");
          }
        }
      }
    }

    // Create offer with consistent constraints
    const offer = await peerConnection.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    });
    await peerConnection.setLocalDescription(offer);

    // Wait for ICE gathering to include all candidates (especially TURN relay)
    if (peerConnection.iceGatheringState !== "complete") {
      console.log("[WebRTCClient] Waiting for ICE candidates before sending offer...");
      await new Promise<void>((resolve) => {
        const checkGathering = () => {
          if (peerConnection!.iceGatheringState === "complete") {
            console.log("[WebRTCClient] ✅ ICE gathering complete");
            peerConnection!.removeEventListener("icegatheringstatechange", checkGathering);
            resolve();
          }
        };
        peerConnection.addEventListener("icegatheringstatechange", checkGathering);
        // Timeout after 1.5s
        setTimeout(() => {
          peerConnection!.removeEventListener("icegatheringstatechange", checkGathering);
          console.log("[WebRTCClient] 🔄 ICE gathering timeout during reconnection");
          resolve();
        }, 1500);
      });
    }

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
    console.log("[WebRTCClient] 📨 handleOffer called for:", peerId, displayName);
    
    // Check if peer connection already exists
    let peerConnection = this.peers.get(peerId)?.connection;
    const peerExists = !!peerConnection;
    console.log("[WebRTCClient] Peer connection exists:", peerExists);
    
    // CRITICAL: Check for signaling state conflicts (Glare - both sides sending offer)
    if (peerConnection && peerConnection.signalingState !== "stable") {
      console.warn(`[WebRTCClient] ⚠️ Signaling state conflict detected: ${peerConnection.signalingState}`);
      console.warn("[WebRTCClient] ⚠️ Rejecting offer to avoid glare condition");
      
      // If we're in an unstable state, reject this offer to prevent "no pending remote description" error
      // This can happen when both peers send offers simultaneously
      throw new Error(`Cannot accept offer while in ${peerConnection.signalingState} state`);
    }
    
    if (!peerConnection) {
      console.log("[WebRTCClient] Creating NEW peer connection in handleOffer for:", peerId);
      peerConnection = await this.createPeerConnection(peerId, displayName);
    } else {
      console.log("[WebRTCClient] Using EXISTING peer connection for:", peerId);
    }

    console.log("[WebRTCClient] Handling offer from:", peerId);
    console.log("[WebRTCClient] Signaling state before setRemoteDescription:", peerConnection.signalingState);
    console.log("[WebRTCClient] Offer tracks:", offer.sdp?.match(/m=/g)?.length || 0);

    try {
      // Set remote description first (MUST complete before createAnswer)
      await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      console.log("[WebRTCClient] ✅ Set remote description (offer) - State now:", peerConnection.signalingState);
      
      // CRITICAL: Flush any queued ICE candidates that arrived before setRemoteDescription
      await this.flushIceCandidateQueue(peerId);

      // Verify we're in the correct state to create answer
      if (peerConnection.signalingState !== "have-remote-offer") {
        console.error("[WebRTCClient] ❌ Invalid state for createAnswer:", peerConnection.signalingState);
        throw new Error(`Cannot create answer in ${peerConnection.signalingState} state`);
      }

      // Create answer - WebRTC will automatically match the m-line order from offer
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      console.log("[WebRTCClient] ✅ Created and set answer for:", peerId);
      console.log("[WebRTCClient] Final signaling state:", peerConnection.signalingState);
      
      // Emit peer-joined event after answer is created
      this.emit("peer-joined", {
        id: peerId,
        displayName,
        audioEnabled: true,
        videoEnabled: true,
        screenSharing: false,
        joinedAt: new Date(),
      });

      return answer;
    } catch (error) {
      console.error("[WebRTCClient] ❌ Error in handleOffer:", error);
      console.error("[WebRTCClient] Peer state:", peerConnection.signalingState);
      throw error;
    }
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

    console.log("[WebRTCClient] Handling answer from:", peerId);

    // Only set remote description if we're in the right state
    if (peer.connection.signalingState === "have-local-offer") {
      await peer.connection.setRemoteDescription(new RTCSessionDescription(answer));
      console.log("[WebRTCClient] ✅ Set remote description (answer) for:", peerId);
      
      // CRITICAL: Flush any queued ICE candidates that arrived before setRemoteDescription
      await this.flushIceCandidateQueue(peerId);
      
      // Emit peer-joined event after connection is established
      this.emit("peer-joined", {
        id: peerId,
        displayName: peer.displayName,
        audioEnabled: peer.audioEnabled,
        videoEnabled: peer.videoEnabled,
        screenSharing: peer.screenSharing,
        joinedAt: new Date(),
      });
    } else {
      console.warn("[WebRTCClient] Invalid signaling state for answer:", peer.connection.signalingState);
    }
  }

  /**
   * Add ICE candidate from a peer
   */
  async addIceCandidate(peerId: string, candidate: IceCandidate): Promise<void> {
    const peer = this.peers.get(peerId);
    
    // CASE 1: Peer doesn't exist yet (candidate arrived before offer)
    if (!peer) {
      console.log(`[WebRTCClient] 📦 Peer ${peerId} not found yet. Storing candidate in PENDING queue.`);
      
      // Store in pending queue - will be flushed when peer connection is created
      const queue = this.candidateQueue.get(peerId) || [];
      queue.push({
        candidate: candidate.candidate,
        sdpMid: candidate.sdpMid,
        sdpMLineIndex: candidate.sdpMLineIndex,
      });
      this.candidateQueue.set(peerId, queue);
      console.log("[WebRTCClient] 📦 Pending queue size for", peerId, ":", queue.length);
      return;
    }

    try {
      // CASE 2: Peer exists and remote description is set
      if (peer.connection.remoteDescription && peer.connection.remoteDescription.type) {
        // Remote description ready - add candidate immediately
        await peer.connection.addIceCandidate(
          new RTCIceCandidate({
            candidate: candidate.candidate,
            sdpMid: candidate.sdpMid,
            sdpMLineIndex: candidate.sdpMLineIndex,
          })
        );
        console.log("[WebRTCClient] ✅ Added ICE candidate for:", peerId);
      } else {
        // CASE 3: Peer exists but remote description not ready yet
        console.warn("[WebRTCClient] ⏳ Queueing ICE candidate (RemoteDesc not ready) for:", peerId);
        
        const queue = this.candidateQueue.get(peerId) || [];
        queue.push({
          candidate: candidate.candidate,
          sdpMid: candidate.sdpMid,
          sdpMLineIndex: candidate.sdpMLineIndex,
        });
        this.candidateQueue.set(peerId, queue);
        console.log("[WebRTCClient] Queue size for", peerId, ":", queue.length);
      }
    } catch (error) {
      console.error("[WebRTCClient] Failed to add ICE candidate:", error);
    }
  }

  /**
   * Flush queued ICE candidates after setRemoteDescription
   */
  private async flushIceCandidateQueue(peerId: string): Promise<void> {
    const queue = this.candidateQueue.get(peerId);
    if (!queue || queue.length === 0) {
      return;
    }

    const peer = this.peers.get(peerId);
    if (!peer) {
      console.warn("[WebRTCClient] No peer found when flushing ICE queue for:", peerId);
      return;
    }

    console.log(`[WebRTCClient] 🚀 Flushing ${queue.length} queued ICE candidates for:`, peerId);

    for (const candidate of queue) {
      try {
        await peer.connection.addIceCandidate(new RTCIceCandidate(candidate));
        console.log("[WebRTCClient] ✅ Added queued ICE candidate");
      } catch (error) {
        console.error("[WebRTCClient] Failed to add queued ICE candidate:", error);
      }
    }

    // Clear queue after flushing
    this.candidateQueue.delete(peerId);
    console.log("[WebRTCClient] ✅ ICE candidate queue flushed for:", peerId);
  }

  /**
   * Attempt to reconnect using ICE restart
   */
  private async attemptReconnection(peerId: string): Promise<void> {
    const peer = this.peers.get(peerId);
    if (!peer || peer.reconnecting) {
      return;
    }

    const maxAttempts = 3;
    const currentAttempt = (peer.reconnectAttempts || 0) + 1;

    if (currentAttempt > maxAttempts) {
      console.error(`[WebRTCClient] Max reconnection attempts (${maxAttempts}) reached for:`, peerId);
      this.removePeer(peerId);
      return;
    }

    peer.reconnectAttempts = currentAttempt;
    peer.reconnecting = true;

    console.log(`[WebRTCClient] 🔄 Reconnection attempt ${currentAttempt}/${maxAttempts} for:`, peerId);

    try {
      // ICE restart: create new offer with iceRestart option
      const offer = await peer.connection.createOffer({ iceRestart: true });
      await peer.connection.setLocalDescription(offer);

      console.log("[WebRTCClient] ✅ ICE restart offer created");

      // Wait for ICE gathering
      if (peer.connection.iceGatheringState !== "complete") {
        await new Promise<void>((resolve) => {
          const checkGathering = () => {
            if (peer.connection.iceGatheringState === "complete") {
              peer.connection.removeEventListener("icegatheringstatechange", checkGathering);
              resolve();
            }
          };
          peer.connection.addEventListener("icegatheringstatechange", checkGathering);
          setTimeout(() => {
            peer.connection.removeEventListener("icegatheringstatechange", checkGathering);
            resolve();
          }, 1500);
        });
      }

      // Notify signaling to send ICE restart offer
      this.emit("ice-restart-needed", peerId);

      // Check reconnection result after 5s
      setTimeout(() => {
        const currentPeer = this.peers.get(peerId);
        if (currentPeer && currentPeer.connection.connectionState !== "connected") {
          console.warn(`[WebRTCClient] ⚠️ Reconnection ${currentAttempt} failed, will retry...`);
          currentPeer.reconnecting = false;
          // Exponential backoff: 1s, 2s, 4s
          const delay = Math.min(1000 * Math.pow(2, currentAttempt - 1), 8000);
          setTimeout(() => this.attemptReconnection(peerId), delay);
        }
      }, 5000);
    } catch (error) {
      console.error("[WebRTCClient] ICE restart error:", error);
      peer.reconnecting = false;
      const delay = Math.min(1000 * Math.pow(2, currentAttempt - 1), 8000);
      setTimeout(() => this.attemptReconnection(peerId), delay);
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
      
      // Clean up ICE candidate queue for this peer
      if (this.candidateQueue.has(peerId)) {
        console.log("[WebRTCClient] Cleaning up ICE candidate queue for:", peerId);
        this.candidateQueue.delete(peerId);
      }
      
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
   * Start screen sharing (DUAL STREAM MODE - adds screen track without replacing camera)
   */
  async startScreenShare(): Promise<void> {
    try {
      console.log("[WebRTCClient] 📺 Starting screen share (dual stream mode)");
      console.log("[WebRTCClient] Current peers count:", this.peers.size);
      console.log("[WebRTCClient] Existing peers:", Array.from(this.peers.keys()));
      
      const screenStream = await this.mediaManager.getScreenShare();
      const screenTrack = screenStream.getVideoTracks()[0];

      if (!screenTrack) {
        throw new Error("No video track in screen stream");
      }

      console.log("[WebRTCClient] Screen track obtained:", {
        id: screenTrack.id,
        label: screenTrack.label,
        kind: screenTrack.kind
      });

      // Emit local screen stream event for UI
      this.emit("local-screen-stream", screenStream);
      console.log("[WebRTCClient] ✅ Emitted local-screen-stream event");

      // Add screen track to all peer connections (ADDTRACK, not replaceTrack)
      this.peers.forEach((peer) => {
        console.log(`[WebRTCClient] Adding screen track to peer: ${peer.peerId}`);
        console.log(`[WebRTCClient] Peer connection state:`, peer.connection.connectionState);
        console.log(`[WebRTCClient] Peer signaling state:`, peer.connection.signalingState);
        console.log(`[WebRTCClient] Current transceivers:`, peer.connection.getTransceivers().length);
        
        // Add the new screen track - this will trigger negotiationneeded event
        const sender = peer.connection.addTrack(screenTrack, screenStream);
        
        console.log(`[WebRTCClient] ✅ Screen track added to ${peer.peerId}`);
        console.log(`[WebRTCClient] Sender mid:`, sender.track?.id);
        console.log(`[WebRTCClient] After addTrack - transceivers:`, peer.connection.getTransceivers().length);
      });

      // Note: Renegotiation will be handled automatically by onnegotiationneeded event
      this.broadcastMediaStateChange({ screenSharing: true });

      console.log("[WebRTCClient] ✅ Screen sharing started (dual stream mode)");
      console.log("[WebRTCClient] Camera remains active. Both streams are now being sent.");
    } catch (error) {
      console.error("[WebRTCClient] Failed to start screen share:", error);
      this.mediaManager.stopScreenShare();
      throw error;
    }
  }

  /**
   * Stop screen sharing (DUAL STREAM MODE - removes screen track, keeps camera)
   */
  async stopScreenShare(): Promise<void> {
    console.log("[WebRTCClient] 🚫 Stopping screen share (dual stream mode)");
    
    const screenStream = this.mediaManager.getScreenStream();
    if (!screenStream) {
      console.log("[WebRTCClient] No active screen stream to stop");
      return;
    }

    const screenTrack = screenStream.getVideoTracks()[0];
    if (!screenTrack) {
      console.log("[WebRTCClient] No screen track found");
      this.mediaManager.stopScreenShare();
      this.broadcastMediaStateChange({ screenSharing: false });
      return;
    }

    // Stop screen track transceivers (preserve m-line order)
    this.peers.forEach((peer) => {
      const transceivers = peer.connection.getTransceivers();
      transceivers.forEach((transceiver) => {
        if (transceiver.sender.track?.id === screenTrack.id) {
          console.log(`[WebRTCClient] Stopping screen transceiver for peer: ${peer.peerId}`);
          // Stop the transceiver instead of removing track to preserve m-line order
          transceiver.stop();
        }
      });
    });

    // Stop the screen stream
    this.mediaManager.stopScreenShare();
    
    // Note: Renegotiation will be handled automatically by onnegotiationneeded event
    this.broadcastMediaStateChange({ screenSharing: false });

    console.log("[WebRTCClient] ✅ Screen sharing stopped (camera still active)");
    
    // Make sure local camera stream is still available
    const localStream = this.mediaManager.getLocalStream();
    if (localStream) {
      console.log("[WebRTCClient] ✅ Local camera stream still active:", {
        videoTracks: localStream.getVideoTracks().length,
        audioTracks: localStream.getAudioTracks().length,
      });
      // Re-emit local stream to ensure UI updates
      this.emit("local-stream", localStream);
    }
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
