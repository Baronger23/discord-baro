/**
 * Media Manager - Handles getUserMedia and device management
 */

import { DEFAULT_AUDIO_CONSTRAINTS, DEFAULT_VIDEO_CONSTRAINTS, SCREEN_SHARE_CONSTRAINTS } from "./constants";
import type { MediaDevices, LocalMediaState } from "./types";

export class MediaManager {
  private localStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;
  private mediaState: LocalMediaState = {
    audioEnabled: false,
    videoEnabled: false,
    screenSharing: false,
  };

  /**
   * Get user media (camera/microphone)
   */
  async getUserMedia(audio: boolean = true, video: boolean = false): Promise<MediaStream> {
    try {
      const constraints: MediaStreamConstraints = {
        audio: audio ? DEFAULT_AUDIO_CONSTRAINTS : false,
        video: video ? DEFAULT_VIDEO_CONSTRAINTS : false,
      };

      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      this.mediaState.audioEnabled = audio;
      this.mediaState.videoEnabled = video;

      console.log("[MediaManager] Got user media:", {
        audio: this.localStream.getAudioTracks().length,
        video: this.localStream.getVideoTracks().length,
      });

      // Log each track details
      this.localStream.getTracks().forEach(track => {
        console.log(`[MediaManager] Track: ${track.kind} id=${track.id} label=${track.label} enabled=${track.enabled} readyState=${track.readyState}`);
      });

      return this.localStream;
    } catch (error) {
      console.error("[MediaManager] Failed to get user media:", error);
      throw new Error(`Failed to access camera/microphone: ${error}`);
    }
  }

  /**
   * Get screen share stream
   */
  async getScreenShare(): Promise<MediaStream> {
    try {
      // @ts-ignore - TypeScript doesn't have proper types for getDisplayMedia yet
      this.screenStream = await navigator.mediaDevices.getDisplayMedia(SCREEN_SHARE_CONSTRAINTS);
      
      this.mediaState.screenSharing = true;

      // Handle user clicking "Stop sharing" button in browser
      this.screenStream.getVideoTracks()[0].onended = () => {
        this.stopScreenShare();
      };

      console.log("[MediaManager] Got screen share");

      return this.screenStream;
    } catch (error) {
      console.error("[MediaManager] Failed to get screen share:", error);
      throw new Error(`Failed to share screen: ${error}`);
    }
  }

  /**
   * Stop screen sharing
   */
  stopScreenShare(): void {
    if (this.screenStream) {
      this.screenStream.getTracks().forEach(track => track.stop());
      this.screenStream = null;
      this.mediaState.screenSharing = false;
      console.log("[MediaManager] Stopped screen share");
    }
  }

  /**
   * Toggle audio mute
   */
  setAudioEnabled(enabled: boolean): void {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = enabled;
      });
      this.mediaState.audioEnabled = enabled;
      console.log("[MediaManager] Audio enabled:", enabled);
    }
  }

  /**
   * Toggle video
   */
  setVideoEnabled(enabled: boolean): void {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach(track => {
        track.enabled = enabled;
      });
      this.mediaState.videoEnabled = enabled;
      console.log("[MediaManager] Video enabled:", enabled);
    }
  }

  /**
   * Switch audio input device
   */
  async switchAudioInput(deviceId: string): Promise<void> {
    if (!this.localStream) return;

    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: { ...DEFAULT_AUDIO_CONSTRAINTS, deviceId: { exact: deviceId } },
        video: false,
      });

      const oldAudioTrack = this.localStream.getAudioTracks()[0];
      const newAudioTrack = newStream.getAudioTracks()[0];

      // Replace track in existing stream
      this.localStream.removeTrack(oldAudioTrack);
      this.localStream.addTrack(newAudioTrack);

      oldAudioTrack.stop();
      this.mediaState.audioDeviceId = deviceId;

      console.log("[MediaManager] Switched audio input to:", deviceId);
    } catch (error) {
      console.error("[MediaManager] Failed to switch audio input:", error);
      throw error;
    }
  }

  /**
   * Switch video input device
   */
  async switchVideoInput(deviceId: string): Promise<void> {
    if (!this.localStream) return;

    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { ...DEFAULT_VIDEO_CONSTRAINTS, deviceId: { exact: deviceId } },
      });

      const oldVideoTrack = this.localStream.getVideoTracks()[0];
      const newVideoTrack = newStream.getVideoTracks()[0];

      if (oldVideoTrack) {
        this.localStream.removeTrack(oldVideoTrack);
        this.localStream.addTrack(newVideoTrack);
        oldVideoTrack.stop();
      } else {
        this.localStream.addTrack(newVideoTrack);
      }

      this.mediaState.videoDeviceId = deviceId;

      console.log("[MediaManager] Switched video input to:", deviceId);
    } catch (error) {
      console.error("[MediaManager] Failed to switch video input:", error);
      throw error;
    }
  }

  /**
   * Get available media devices
   */
  async getDevices(): Promise<MediaDevices> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();

      return {
        audioInputs: devices.filter(d => d.kind === "audioinput"),
        audioOutputs: devices.filter(d => d.kind === "audiooutput"),
        videoInputs: devices.filter(d => d.kind === "videoinput"),
      };
    } catch (error) {
      console.error("[MediaManager] Failed to enumerate devices:", error);
      throw error;
    }
  }

  /**
   * Get current media state
   */
  getMediaState(): LocalMediaState {
    return { ...this.mediaState };
  }

  /**
   * Get local stream
   */
  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  /**
   * Get screen stream
   */
  getScreenStream(): MediaStream | null {
    return this.screenStream;
  }

  /**
   * Stop all media streams
   */
  cleanup(): void {
    console.log("[MediaManager] ⚠️ Cleanup called!");
    console.log("[MediaManager] Cleanup state:", {
      hasLocalStream: !!this.localStream,
      hasScreenStream: !!this.screenStream,
      localStreamTracks: this.localStream?.getTracks().length || 0,
      screenStreamTracks: this.screenStream?.getTracks().length || 0,
    });
    
    // Get all active tracks from browser BEFORE cleanup
    navigator.mediaDevices.enumerateDevices().then(devices => {
      console.log("[MediaManager] 📹 Active devices BEFORE cleanup:", 
        devices.filter(d => d.kind === 'videoinput' || d.kind === 'audioinput').length
      );
    });
    
    if (this.localStream) {
      console.log("[MediaManager] 🛑 Stopping local stream tracks...");
      this.localStream.getTracks().forEach(track => {
        console.log(`[MediaManager] 🛑 Stopping ${track.kind} track:`, {
          id: track.id,
          label: track.label,
          readyState: track.readyState,
          enabled: track.enabled,
        });
        track.stop();
        console.log(`[MediaManager] ✅ Track ${track.kind} stopped, new readyState:`, track.readyState);
      });
      this.localStream = null;
    } else {
      console.log("[MediaManager] ⚠️ No local stream to cleanup!");
    }

    if (this.screenStream) {
      console.log("[MediaManager] 🛑 Stopping screen stream tracks...");
      this.screenStream.getTracks().forEach(track => {
        console.log("[MediaManager] Stopping screen track:", track.kind, "id:", track.id);
        track.stop();
      });
      this.screenStream = null;
    }

    this.mediaState = {
      audioEnabled: false,
      videoEnabled: false,
      screenSharing: false,
    };

    // Check again AFTER cleanup
    setTimeout(() => {
      navigator.mediaDevices.enumerateDevices().then(devices => {
        console.log("[MediaManager] 📹 Active devices AFTER cleanup:", 
          devices.filter(d => d.kind === 'videoinput' || d.kind === 'audioinput').length
        );
      });
    }, 100);

    console.log("[MediaManager] ✅ Cleanup complete - all media stopped");
  }
}
