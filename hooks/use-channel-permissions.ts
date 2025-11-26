import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface ChannelPermissions {
  canView: boolean;
  canSendMessages: boolean;
  canManageMessages: boolean;
  canInviteMembers: boolean;
  loading: boolean;
}

/**
 * Hook to get current member's permissions for a channel
 * Returns loading state and permission flags
 */
export const useChannelPermissions = (channelId: string | undefined): ChannelPermissions => {
  const [permissions, setPermissions] = useState<ChannelPermissions>({
    canView: false,
    canSendMessages: false,
    canManageMessages: false,
    canInviteMembers: false,
    loading: true,
  });
  const router = useRouter();

  useEffect(() => {
    if (!channelId) {
      setPermissions({
        canView: false,
        canSendMessages: false,
        canManageMessages: false,
        canInviteMembers: false,
        loading: false,
      });
      return;
    }

    const fetchPermissions = async () => {
      try {
        const response = await fetch(`/api/channels/${channelId}/my-permissions`);
        
        if (!response.ok) {
          if (response.status === 403) {
            // No permission to view channel
            setPermissions({
              canView: false,
              canSendMessages: false,
              canManageMessages: false,
              canInviteMembers: false,
              loading: false,
            });
            return;
          }
          throw new Error("Failed to fetch permissions");
        }

        const data = await response.json();
        setPermissions({
          ...data,
          loading: false,
        });
      } catch (error) {
        console.error("[USE_CHANNEL_PERMISSIONS]", error);
        setPermissions({
          canView: false,
          canSendMessages: false,
          canManageMessages: false,
          canInviteMembers: false,
          loading: false,
        });
      }
    };

    fetchPermissions();
  }, [channelId, router]);

  return permissions;
};
