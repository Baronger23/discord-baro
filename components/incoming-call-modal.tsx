"use client";

import { useState } from "react";
import { Phone, PhoneOff } from "lucide-react";
import { useIncomingCallSocket } from "@/hooks/use-incoming-call-socket";
import { useRouter } from "next/navigation";

/**
 * Modal hiển thị incoming call dù ở đâu
 * Hiển thị dưới dạng fixed overlay
 */
export const IncomingCallModal = () => {
  const { incomingCall, acceptCall, declineCall } = useIncomingCallSocket();
  const router = useRouter();
  const [isAccepting, setIsAccepting] = useState(false);

  const resolveCallerMemberId = async (conversationId: string, callerId: string) => {
    const params = new URLSearchParams({ callerProfileId: callerId });
    const response = await fetch(
      `/api/conversations/${conversationId}/caller-member?${params.toString()}`,
      { cache: "no-store" }
    );

    if (!response.ok) {
      return undefined;
    }

    const data = (await response.json()) as { callerMemberId?: string };
    return data.callerMemberId;
  };

  const handleAccept = async () => {
    if (!incomingCall) return;

    if (isAccepting) {
      return;
    }

    setIsAccepting(true);
    acceptCall();

    let callerMemberId: string | undefined = incomingCall.callerMemberId;
    if (!callerMemberId) {
      callerMemberId = await resolveCallerMemberId(
        incomingCall.conversationId,
        incomingCall.callerId
      );
    }

    if (!callerMemberId) {
      console.error("Unable to resolve caller member id for incoming call", incomingCall);
      setIsAccepting(false);
      return;
    }

    // Navigate tới conversation với video=true
    // Route expects [memberId] parameter
    router.push(
      `/servers/${incomingCall.serverId}/conversations/${callerMemberId}?video=true`
    );

    setIsAccepting(false);
  };

  const handleDecline = () => {
    declineCall();
  };

  if (!incomingCall) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleDecline}
        aria-hidden
      />

      {/* Modal card */}
      <div className="relative z-10 bg-white dark:bg-[#2b2d31] rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
        {/* Avatar */}
        {incomingCall.callerAvatar && (
          <div className="flex justify-center mb-6">
            <img
              src={incomingCall.callerAvatar}
              alt={incomingCall.callerName}
              className="w-20 h-20 rounded-full object-cover border-4 border-blue-500"
            />
          </div>
        )}

        {/* Caller info */}
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-black dark:text-white mb-2">
            {incomingCall.callerName}
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Incoming video call...
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex gap-4 justify-center">
          {/* Decline */}
          <button
            onClick={handleDecline}
            className="flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-4 transition-colors"
            title="Decline call"
          >
            <PhoneOff size={24} />
          </button>

          {/* Accept */}
          <button
            onClick={handleAccept}
            disabled={isAccepting}
            className="flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white rounded-full p-4 transition-colors"
            title="Accept call"
          >
            <Phone size={24} />
          </button>
        </div>

        {/* Callback info */}
        <p className="text-xs text-center text-zinc-500 dark:text-zinc-400 mt-6">
          Calling at {new Date(incomingCall.timestamp).toLocaleTimeString()}
        </p>
      </div>
    </div>
  );
};
