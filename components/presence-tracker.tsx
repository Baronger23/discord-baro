"use client";

import { usePresenceGlobal } from "@/hooks/use-presence-global";

/**
 * Component thin wrapper để enable presence tracking global
 * Đặt vào root layout
 */
export const PresenceTracker = () => {
  usePresenceGlobal();
  return null;
};
