"use client";
import { ShieldAlert, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface ChannelPermissionDeniedProps {
  channelName?: string;
  serverName?: string;
}

export const ChannelPermissionDenied = ({
  channelName,
  serverName,
}: ChannelPermissionDeniedProps) => {
  const router = useRouter();

  return (
    <div className="flex flex-col items-center justify-center h-full space-y-4 p-8">
      <div className="relative">
        <div className="absolute inset-0 bg-red-500/20 rounded-full blur-2xl" />
        <div className="relative bg-red-500/10 p-6 rounded-full">
          <Lock className="h-16 w-16 text-red-500" />
        </div>
      </div>
      
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-x-2 justify-center">
          <ShieldAlert className="h-6 w-6 text-red-500" />
          Access Denied
        </h2>
        
        <div className="space-y-1">
          {channelName && (
            <p className="text-zinc-600 dark:text-zinc-400">
              You don't have permission to view <span className="font-semibold">#{channelName}</span>
            </p>
          )}
          {serverName && (
            <p className="text-sm text-zinc-500 dark:text-zinc-500">
              in {serverName}
            </p>
          )}
        </div>
        
        <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-md">
          This channel is private or restricted to certain roles. Contact a server administrator if you believe this is a mistake.
        </p>
      </div>

      <Button
        variant="outline"
        onClick={() => router.back()}
        className="mt-4"
      >
        Go Back
      </Button>
    </div>
  );
};
