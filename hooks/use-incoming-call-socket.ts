import { useEffect, useState, useCallback } from "react";
import { useSocket } from "@/components/providers/socket-provider";

export interface IncomingCall {
  callId: string;
  callerId: string;
  callerMemberId?: string;
  callerName: string;
  callerAvatar?: string;
  serverId: string;
  conversationId: string;
  timestamp: number;
}

type IncomingCallHandler = (call: IncomingCall) => void;

/**
 * Hook để listen incoming call từ Socket.IO
 * Trả về current call, handler accept/decline
 */
export const useIncomingCallSocket = () => {
  const { socket } = useSocket();
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);

  useEffect(() => {
    if (!socket) {
      return;
    }

    const handleIncomingCall = (call: IncomingCall) => {
      setIncomingCall(call);
      
      // Play ringtone sound
      playRingtone();
    };

    const handleCallDeclined = () => {
      setIncomingCall(null);
    };

    const handleCallCancelled = () => {
      setIncomingCall(null);
    };

    const handleCallEnded = () => {
      setIncomingCall(null);
    };

    socket.on("call:incoming", handleIncomingCall);
    socket.on("call:declined", handleCallDeclined);
    socket.on("call:cancelled", handleCallCancelled);
    socket.on("call:ended", handleCallEnded);

    return () => {
      socket.off("call:incoming", handleIncomingCall);
      socket.off("call:declined", handleCallDeclined);
      socket.off("call:cancelled", handleCallCancelled);
      socket.off("call:ended", handleCallEnded);
    };
  }, [socket]);

  const acceptCall = useCallback(() => {
    if (!socket || !incomingCall) {
      return;
    }

    socket.emit("call:accept", {
      callId: incomingCall.callId,
      conversationId: incomingCall.conversationId,
    });
    setIncomingCall(null);
  }, [socket, incomingCall]);

  const declineCall = useCallback(() => {
    if (!socket || !incomingCall) {
      return;
    }

    socket.emit("call:decline", {
      callId: incomingCall.callId,
      conversationId: incomingCall.conversationId,
    });
    setIncomingCall(null);
  }, [socket, incomingCall]);

  return {
    incomingCall,
    acceptCall,
    declineCall,
  };
};

/**
 * Phát tiếng chuông
 */
export const playRingtone = () => {
  // Tạo ringtone đơn giản bằng Web Audio API
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  
  try {
    // Tạo oscillator phát tiếng 
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 800; // 800 Hz tone
    oscillator.type = "sine";

    // Fade in/out
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.1);
    gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.5);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);

    // Repeat 5 lần
    let count = 0;
    const interval = setInterval(() => {
      count++;
      if (count >= 5) {
        clearInterval(interval);
        return;
      }

      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();

      osc.connect(gain);
      gain.connect(audioContext.destination);

      osc.frequency.value = 800;
      osc.type = "sine";

      gain.gain.setValueAtTime(0, audioContext.currentTime);
      gain.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.1);
      gain.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.5);

      osc.start(audioContext.currentTime);
      osc.stop(audioContext.currentTime + 0.5);
    }, 600);
  } catch (error) {
    console.error("Failed to play ringtone:", error);
  }
};
