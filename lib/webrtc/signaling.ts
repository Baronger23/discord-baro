/**
 * WebRTC Signaling Integration
 * Connects WebRTCClient to Socket.IO for signaling messages
 */

import { Socket } from "socket.io-client";
import { WebRTCClient } from "./webrtc-client";
import type { ClientToServerEvents, ServerToClientEvents } from "@/lib/socket/types";

export class WebRTCSignaling {
  private socket: Socket<ServerToClientEvents, ClientToServerEvents>;
  private webrtcClient: WebRTCClient;
  private roomId: string | null = null;
  private peerId: string | null = null;
  private displayName: string | null = null;

  constructor(
    socket: Socket<ServerToClientEvents, ClientToServerEvents>,
    webrtcClient: WebRTCClient
  ) {
    this.socket = socket;
    this.webrtcClient = webrtcClient;
    this.setupSocketListeners();
    this.setupWebRTCListeners();
  }

  /**
   * Join a WebRTC room and start signaling
   */
  public joinRoom(roomId: string, displayName: string): void {
    this.roomId = roomId;
    this.peerId = this.socket.id || `peer-${Date.now()}`;
    this.displayName = displayName;

    console.log("[SIGNALING] Joining room", { roomId, peerId: this.peerId, displayName });

    // Emit join-room event to server
    this.socket.emit("webrtc:join-room", {
      roomId,
      peerId: this.peerId,
      displayName,
    });
  }

  /**
   * Leave the current WebRTC room
   */
  public leaveRoom(): void {
    if (!this.roomId || !this.peerId) return;

    console.log("[SIGNALING] Leaving room", { roomId: this.roomId });

    this.socket.emit("webrtc:leave-room", {
      roomId: this.roomId,
      peerId: this.peerId,
    });

    this.roomId = null;
    this.peerId = null;
  }

  /**
   * Setup Socket.IO event listeners for signaling
   */
  private setupSocketListeners(): void {
    // User joined the room
    this.socket.on("webrtc:user-joined", async ({ roomId, peerId, displayName, peers }) => {
      console.log("[SIGNALING] User joined", { roomId, peerId, displayName, peersCount: peers.length });

      if (peerId === this.socket.id) {
        // This is us joining - create offers for all existing peers
        for (const peer of peers) {
          console.log("[SIGNALING] Creating offer for existing peer", peer.peerId);
          await this.createOfferForPeer(peer.peerId, peer.displayName);
        }
      } else {
        // Another user joined - they will send us an offer
        console.log("[SIGNALING] New peer will send offer", peerId, displayName);
        
        // Pre-create peer connection so we have the displayName ready
        await this.webrtcClient.createPeerConnection(peerId, displayName);
      }
    });

    // User left the room
    this.socket.on("webrtc:user-left", ({ roomId, peerId }) => {
      console.log("[SIGNALING] User left", { roomId, peerId });
      this.webrtcClient.removePeer(peerId);
    });

    // Received an offer from another peer
    this.socket.on("webrtc:offer", async ({ from, to, roomId, offer, displayName }) => {
      console.log("[SIGNALING] Received offer", { from, displayName });

      try {
        // Handle the offer and create an answer
        const answer = await this.webrtcClient.handleOffer(from, displayName, offer);

        // Send the answer back
        this.socket.emit("webrtc:answer", {
          to: from,
          roomId,
          answer,
        });

        console.log("[SIGNALING] Sent answer to", from);
      } catch (error) {
        console.error("[SIGNALING] Error handling offer:", error);
      }
    });

    // Received an answer from another peer
    this.socket.on("webrtc:answer", async ({ from, to, roomId, answer, displayName }) => {
      console.log("[SIGNALING] Received answer from", from, displayName);

      try {
        await this.webrtcClient.handleAnswer(from, answer);
        
        // Update display name if we don't have it yet
        this.webrtcClient.updatePeerDisplayName(from, displayName);
      } catch (error) {
        console.error("[SIGNALING] Error handling answer:", error);
      }
    });

    // Received ICE candidate from another peer
    this.socket.on("webrtc:ice-candidate", async ({ from, to, roomId, candidate }) => {
      console.log("[SIGNALING] Received ICE candidate from", from);

      try {
        await this.webrtcClient.addIceCandidate(from, candidate);
      } catch (error) {
        console.error("[SIGNALING] Error adding ICE candidate:", error);
      }
    });

    // Received media state change from another peer
    this.socket.on("webrtc:media-state", ({ roomId, peerId, audioEnabled, videoEnabled, screenSharing }) => {
      console.log("[SIGNALING] Received media state change from", peerId, { audioEnabled, videoEnabled, screenSharing });
      
      // Update participant state in WebRTC client
      this.webrtcClient.updatePeerMediaState(peerId, {
        audioEnabled,
        videoEnabled,
        screenSharing,
      });
    });

    // NEW: Handle renegotiation offer (for dual streams)
    this.socket.on("webrtc:renegotiate-offer", async ({ from, to, roomId, offer }) => {
      console.log("[SIGNALING] 🔄 Received renegotiation offer from", from);
      console.log("[SIGNALING] Offer SDP tracks:", offer.sdp?.match(/m=/g)?.length || 0);

      try {
        const peer = this.webrtcClient['peers'].get(from);
        if (!peer) {
          console.error("[SIGNALING] Peer not found for renegotiation:", from);
          return;
        }

        const peerConnection = peer.connection;

        // Log current state
        console.log("[SIGNALING] Current signaling state:", peerConnection.signalingState);
        console.log("[SIGNALING] Current transceivers:", peerConnection.getTransceivers().length);
        
        if (peerConnection.signalingState !== "stable") {
          console.warn("[SIGNALING] ⚠️ Signaling state not stable for offer. Got:", peerConnection.signalingState);
          // Don't return, proceed anyway - remote offer can override local state
        }

        // Set remote description (the new offer)
        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        console.log("[SIGNALING] ✅ Set remote description for renegotiation");
        console.log("[SIGNALING] After setRemoteDescription - transceivers:", peerConnection.getTransceivers().length);

        // Create answer
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        console.log("[SIGNALING] ✅ Created renegotiation answer");
        console.log("[SIGNALING] Answer SDP tracks:", answer.sdp?.match(/m=/g)?.length || 0);

        // Send answer back
        this.socket.emit("webrtc:renegotiate-answer", {
          to: from,
          roomId,
          answer: {
            type: answer.type,
            sdp: answer.sdp,
          } as RTCSessionDescriptionInit,
        });

        console.log("[SIGNALING] ✅ Sent renegotiation answer to", from);
      } catch (error) {
        console.error("[SIGNALING] Error handling renegotiation offer:", error);
      }
    });

    // NEW: Handle renegotiation answer (for dual streams)
    this.socket.on("webrtc:renegotiate-answer", async ({ from, to, roomId, answer }) => {
      console.log("[SIGNALING] 🔄 Received renegotiation answer from", from);

      try {
        const peer = this.webrtcClient['peers'].get(from);
        if (!peer) {
          console.error("[SIGNALING] Peer not found for renegotiation:", from);
          return;
        }

        const peerConnection = peer.connection;

        // Check signaling state before setting remote description
        console.log("[SIGNALING] Current signaling state:", peerConnection.signalingState);
        
        if (peerConnection.signalingState !== "have-local-offer") {
          console.warn("[SIGNALING] ⚠️ Wrong signaling state for answer. Expected 'have-local-offer', got:", peerConnection.signalingState);
          return;
        }

        // Set remote description (the answer)
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        console.log("[SIGNALING] ✅ Set remote description for renegotiation answer");
      } catch (error) {
        console.error("[SIGNALING] Error handling renegotiation answer:", error);
      }
    });
  }

  /**
   * Setup WebRTC event listeners to send signaling messages
   */
  private setupWebRTCListeners(): void {
    // When WebRTC client needs to send an offer
    this.webrtcClient.on("need-offer", async ({ peerId, displayName }) => {
      await this.createOfferForPeer(peerId, displayName);
    });

    // When WebRTC client generates an ICE candidate
    this.webrtcClient.on("ice-candidate", ({ peerId, candidate }) => {
      if (!this.roomId) return;

      console.log("[SIGNALING] Sending ICE candidate to", peerId);

      this.socket.emit("webrtc:ice-candidate", {
        to: peerId,
        roomId: this.roomId,
        candidate: {
          candidate: candidate.candidate,
          sdpMid: candidate.sdpMid,
          sdpMLineIndex: candidate.sdpMLineIndex,
        },
      });
    });

    // When media state changes (audio/video/screen sharing)
    this.webrtcClient.on("media-state-changed", (state) => {
      if (!this.roomId) return;

      console.log("[SIGNALING] Broadcasting media state change", state);

      this.socket.emit("webrtc:media-state", {
        roomId: this.roomId,
        audioEnabled: state.audioEnabled,
        videoEnabled: state.videoEnabled,
        screenSharing: state.screenSharing,
      });
    });

    // NEW: Handle renegotiation for dual streams
    this.webrtcClient.on("renegotiation-needed", async (peerId) => {
      if (!this.roomId) return;

      console.log("[SIGNALING] 🔄 Renegotiation needed for peer:", peerId);

      try {
        const peer = this.webrtcClient['peers'].get(peerId);
        if (!peer) {
          console.error("[SIGNALING] Peer not found for renegotiation:", peerId);
          return;
        }

        const peerConnection = peer.connection;
        const localDescription = peerConnection.localDescription;

        if (!localDescription) {
          console.error("[SIGNALING] No local description for renegotiation");
          return;
        }

        console.log("[SIGNALING] Sending renegotiation offer to", peerId);

        this.socket.emit("webrtc:renegotiate-offer", {
          to: peerId,
          roomId: this.roomId,
          offer: {
            type: localDescription.type,
            sdp: localDescription.sdp,
          } as RTCSessionDescriptionInit,
        });
      } catch (error) {
        console.error("[SIGNALING] Error handling renegotiation:", error);
      }
    });
  }

  /**
   * Create and send an offer to a specific peer
   */
  private async createOfferForPeer(peerId: string, displayName: string): Promise<void> {
    if (!this.roomId) return;

    try {
      console.log("[SIGNALING] Creating offer for peer", { peerId, displayName });

      const offer = await this.webrtcClient.createOffer(peerId, displayName);

      this.socket.emit("webrtc:offer", {
        to: peerId,
        roomId: this.roomId,
        offer,
        displayName: this.displayName || "Unknown",
      });

      console.log("[SIGNALING] Sent offer to", peerId);
    } catch (error) {
      console.error("[SIGNALING] Error creating offer:", error);
    }
  }

  /**
   * Cleanup signaling listeners
   */
  public destroy(): void {
    console.log("[SIGNALING] Destroying signaling");

    // Remove Socket.IO listeners
    this.socket.off("webrtc:user-joined");
    this.socket.off("webrtc:user-left");
    this.socket.off("webrtc:offer");
    this.socket.off("webrtc:answer");
    this.socket.off("webrtc:ice-candidate");
    this.socket.off("webrtc:media-state");
    this.socket.off("webrtc:renegotiate-offer");
    this.socket.off("webrtc:renegotiate-answer");

    // Leave the room
    this.leaveRoom();
  }
}
