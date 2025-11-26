import { MemberRole, Channel, Member, ChannelPermission } from "@prisma/client";
import { db } from "@/lib/db";

/**
 * Channel Permission System
 * 
 * Permission hierarchy:
 * 1. ADMIN - Full access to all channels
 * 2. MODERATOR - Access based on channel settings
 * 3. GUEST - Limited access, depends on channel configuration
 */

export interface ChannelWithPermissions extends Channel {
  channelPermissions?: ChannelPermission[];
}

export interface MemberWithRole extends Member {
  role: MemberRole;
}

/**
 * Check if a member can view a specific channel
 */
export async function canViewChannel(
  memberId: string,
  channelId: string
): Promise<boolean> {
  try {
    const member = await db.member.findUnique({
      where: { id: memberId },
      include: {
        channelPermissions: {
          where: { channelId }
        }
      }
    });

    if (!member) return false;

    const channel = await db.channel.findUnique({
      where: { id: channelId },
      include: {
        channelPermissions: {
          where: { memberId }
        }
      }
    });

    if (!channel) return false;

    // ADMIN always has access
    if (member.role === MemberRole.ADMIN) return true;

    // Check if channel is private
    if (channel.isPrivate) {
      // Check specific permission
      const permission = channel.channelPermissions[0];
      if (!permission) return false;
      return permission.canView;
    }

    // Check if member's role is in allowed roles
    return channel.allowedRoles.includes(member.role);
  } catch (error) {
    console.error("Error checking channel view permission:", error);
    return false;
  }
}

/**
 * Check if a member can send messages in a channel
 */
export async function canSendMessages(
  memberId: string,
  channelId: string
): Promise<boolean> {
  try {
    const member = await db.member.findUnique({
      where: { id: memberId },
      include: {
        channelPermissions: {
          where: { channelId }
        }
      }
    });

    if (!member) return false;

    const channel = await db.channel.findUnique({
      where: { id: channelId },
      include: {
        channelPermissions: {
          where: { memberId }
        }
      }
    });

    if (!channel) return false;

    // ADMIN always can send
    if (member.role === MemberRole.ADMIN) return true;

    // Check specific permission
    const permission = channel.channelPermissions[0];
    if (permission) {
      return permission.canSendMessages;
    }

    // If channel is private and no specific permission, deny
    if (channel.isPrivate) return false;

    // Check if member's role is in allowed roles
    return channel.allowedRoles.includes(member.role);
  } catch (error) {
    console.error("Error checking send message permission:", error);
    return false;
  }
}

/**
 * Check if a member can manage messages (delete/edit)
 */
export async function canManageMessages(
  memberId: string,
  channelId: string
): Promise<boolean> {
  try {
    const member = await db.member.findUnique({
      where: { id: memberId },
      include: {
        channelPermissions: {
          where: { channelId }
        }
      }
    });

    if (!member) return false;

    // ADMIN and MODERATOR can manage messages
    if (member.role === MemberRole.ADMIN || member.role === MemberRole.MODERATOR) {
      return true;
    }

    // Check specific permission
    const permission = member.channelPermissions[0];
    if (permission) {
      return permission.canManageMessages;
    }

    return false;
  } catch (error) {
    console.error("Error checking manage message permission:", error);
    return false;
  }
}

/**
 * Get all channels accessible by a member
 */
export async function getAccessibleChannels(
  memberId: string,
  serverId: string
) {
  try {
    const member = await db.member.findFirst({
      where: {
        id: memberId,
        serverId: serverId
      }
    });

    if (!member) return [];

    // ADMIN sees all channels
    if (member.role === MemberRole.ADMIN) {
      return db.channel.findMany({
        where: { serverId },
        orderBy: { createdAt: "asc" }
      });
    }

    // Get all channels in server
    const allChannels = await db.channel.findMany({
      where: { serverId },
      include: {
        channelPermissions: {
          where: { memberId }
        }
      },
      orderBy: { createdAt: "asc" }
    });

    // Filter channels based on permissions
    const accessibleChannels = allChannels.filter(channel => {
      // Private channel - check specific permission
      if (channel.isPrivate) {
        const permission = channel.channelPermissions[0];
        return permission && permission.canView;
      }

      // Public channel - check if role is allowed
      return channel.allowedRoles.includes(member.role);
    });

    return accessibleChannels;
  } catch (error) {
    console.error("Error getting accessible channels:", error);
    return [];
  }
}

/**
 * Grant channel access to a specific member
 */
export async function grantChannelAccess(
  channelId: string,
  memberId: string,
  permissions: {
    canView?: boolean;
    canSendMessages?: boolean;
    canManageMessages?: boolean;
    canInviteMembers?: boolean;
  }
) {
  try {
    return await db.channelPermission.upsert({
      where: {
        channelId_memberId: {
          channelId,
          memberId
        }
      },
      update: permissions,
      create: {
        channelId,
        memberId,
        ...permissions
      }
    });
  } catch (error) {
    console.error("Error granting channel access:", error);
    throw error;
  }
}

/**
 * Revoke channel access from a member
 */
export async function revokeChannelAccess(
  channelId: string,
  memberId: string
) {
  try {
    return await db.channelPermission.delete({
      where: {
        channelId_memberId: {
          channelId,
          memberId
        }
      }
    });
  } catch (error) {
    console.error("Error revoking channel access:", error);
    throw error;
  }
}

/**
 * Update channel access settings
 */
export async function updateChannelAccess(
  channelId: string,
  settings: {
    isPrivate?: boolean;
    allowedRoles?: MemberRole[];
  }
) {
  try {
    return await db.channel.update({
      where: { id: channelId },
      data: settings
    });
  } catch (error) {
    console.error("Error updating channel access:", error);
    throw error;
  }
}

/**
 * Get permission summary for a member in a channel
 */
export async function getChannelPermissionSummary(
  memberId: string,
  channelId: string
) {
  try {
    const canView = await canViewChannel(memberId, channelId);
    const canSend = await canSendMessages(memberId, channelId);
    const canManage = await canManageMessages(memberId, channelId);

    return {
      canView,
      canSendMessages: canSend,
      canManageMessages: canManage,
    };
  } catch (error) {
    console.error("Error getting permission summary:", error);
    return {
      canView: false,
      canSendMessages: false,
      canManageMessages: false,
    };
  }
}
