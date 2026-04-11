import { useEffect } from "react";
import { useSocket } from "@/components/providers/socket-provider";
import { useAuth } from "@clerk/nextjs";

/**
 * Hook để track online/offline status global
 * Emit presence:ping mỗi 30s để giữ alive
 * Listen presence:update từ server
 */
export const usePresenceGlobal = () => {
  const { socket, isConnected } = useSocket();
  const { isLoaded, isSignedIn } = useAuth();

  useEffect(() => {
    if (!socket || !isConnected || !isLoaded || !isSignedIn) {
      return;
    }

    // Emit presence:ping ngay khi connect
    const emitPresencePing = () => {
      socket.emit("presence:ping", { timestamp: Date.now() });
    };

    emitPresencePing();

    // Emit ping mỗi 30s để giữ status ONLINE
    const pingInterval = setInterval(emitPresencePing, 30000);

    return () => {
      clearInterval(pingInterval);
    };
  }, [socket, isConnected, isLoaded, isSignedIn]);

  // Cleanup: emit offline khi disconnect
  useEffect(() => {
    const handleDisconnect = () => {
      // Server sẽ soft update lastSeenAt
      // Sau 5p server sẽ auto mark OFFLINE nếu không reconnect
    };

    if (socket) {
      socket.on("disconnect", handleDisconnect);
      return () => {
        socket.off("disconnect", handleDisconnect);
      };
    }
  }, [socket]);
};
