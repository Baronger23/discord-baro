import { NextResponse } from "next/server";
import { currentProfile } from "@/lib/current-profile";
import { db } from "@/lib/db";
import { MemberRole } from "@prisma/client";

/**
 * GET /api/channels/[channelId]/permissions
 * Get channel access settings and member-specific permissions
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ channelId: string }> }
) {
  try {
    // Run params and profile fetch in parallel
    const [{ channelId }, profile] = await Promise.all([
      params,
      currentProfile()
    ]);
    
    if (!profile) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Single optimized query with select for only needed fields
    const channel = await db.channel.findUnique({
      where: { id: channelId },
      select: {
        id: true,
        isPrivate: true,
        allowedRoles: true,
        channelPermissions: {
          select: {
            id: true,
            memberId: true,
            canView: true,
            canSendMessages: true,
            canManageMessages: true,
            canInviteMembers: true,
            member: {
              select: {
                profile: {
                  select: { name: true }
                }
              }
            }
          }
        },
        server: {
          select: {
            members: {
              where: { profileId: profile.id },
              select: { role: true },
              take: 1
            }
          }
        }
      }
    });

    if (!channel) {
      return new NextResponse("Channel not found", { status: 404 });
    }

    // Check if user is ADMIN or MODERATOR
    const member = channel.server.members[0];
    if (!member || (member.role !== MemberRole.ADMIN && member.role !== MemberRole.MODERATOR)) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    return NextResponse.json({
      channelId: channel.id,
      isPrivate: channel.isPrivate,
      allowedRoles: channel.allowedRoles,
      permissions: channel.channelPermissions.map(p => ({
        id: p.id,
        memberId: p.memberId,
        memberName: p.member.profile.name,
        canView: p.canView,
        canSendMessages: p.canSendMessages,
        canManageMessages: p.canManageMessages,
        canInviteMembers: p.canInviteMembers,
      }))
    });

  } catch (error) {
    console.error("[CHANNEL_PERMISSIONS_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

/**
 * PATCH /api/channels/[channelId]/permissions
 * Update channel access settings (isPrivate, allowedRoles)
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ channelId: string }> }
) {
  try {
    // Run params, profile and body parsing in parallel
    const [{ channelId }, profile, body] = await Promise.all([
      params,
      currentProfile(),
      req.json()
    ]);
    
    if (!profile) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { isPrivate, allowedRoles } = body;

    // Get channel and check permissions with select for minimal data
    const channel = await db.channel.findUnique({
      where: { id: channelId },
      select: {
        id: true,
        isPrivate: true,
        allowedRoles: true,
        server: {
          select: {
            members: {
              where: { profileId: profile.id },
              select: { role: true },
              take: 1
            }
          }
        }
      }
    });

    if (!channel) {
      return new NextResponse("Channel not found", { status: 404 });
    }

    // Only ADMIN can modify channel settings
    const member = channel.server.members[0];
    if (!member || member.role !== MemberRole.ADMIN) {
      return new NextResponse("Forbidden - Admin only", { status: 403 });
    }

    // Update channel settings
    const updatedChannel = await db.channel.update({
      where: { id: channelId },
      data: {
        isPrivate: isPrivate !== undefined ? isPrivate : channel.isPrivate,
        allowedRoles: allowedRoles || channel.allowedRoles,
      }
    });

    return NextResponse.json(updatedChannel);

  } catch (error) {
    console.error("[CHANNEL_PERMISSIONS_PATCH]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

/**
 * POST /api/channels/[channelId]/permissions
 * Grant specific permission to a member
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ channelId: string }> }
) {
  try {
    // Run params, profile and body parsing in parallel
    const [{ channelId }, profile, body] = await Promise.all([
      params,
      currentProfile(),
      req.json()
    ]);
    
    if (!profile) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { 
      memberId, 
      canView = true, 
      canSendMessages = true,
      canManageMessages = false,
      canInviteMembers = false 
    } = body;

    if (!memberId) {
      return new NextResponse("Member ID required", { status: 400 });
    }

    // Check if requester is ADMIN with minimal data
    const channel = await db.channel.findUnique({
      where: { id: channelId },
      select: {
        id: true,
        server: {
          select: {
            members: {
              where: { profileId: profile.id },
              select: { role: true },
              take: 1
            }
          }
        }
      }
    });

    if (!channel) {
      return new NextResponse("Channel not found", { status: 404 });
    }

    const requesterMember = channel.server.members[0];
    if (!requesterMember || requesterMember.role !== MemberRole.ADMIN) {
      return new NextResponse("Forbidden - Admin only", { status: 403 });
    }

    // Create or update permission
    const permission = await db.channelPermission.upsert({
      where: {
        channelId_memberId: {
          channelId,
          memberId
        }
      },
      create: {
        channelId,
        memberId,
        canView,
        canSendMessages,
        canManageMessages,
        canInviteMembers,
      },
      update: {
        canView,
        canSendMessages,
        canManageMessages,
        canInviteMembers,
      },
      include: {
        member: {
          include: {
            profile: true
          }
        }
      }
    });

    return NextResponse.json({
      id: permission.id,
      memberId: permission.memberId,
      memberName: permission.member.profile.name,
      canView: permission.canView,
      canSendMessages: permission.canSendMessages,
      canManageMessages: permission.canManageMessages,
      canInviteMembers: permission.canInviteMembers,
    });

  } catch (error) {
    console.error("[CHANNEL_PERMISSIONS_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

/**
 * DELETE /api/channels/[channelId]/permissions?memberId=xxx
 * Revoke member's specific permission
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ channelId: string }> }
) {
  try {
    // Parse URL early for validation
    const { searchParams } = new URL(req.url);
    const memberId = searchParams.get("memberId");

    if (!memberId) {
      return new NextResponse("Member ID required", { status: 400 });
    }

    // Run params and profile in parallel
    const [{ channelId }, profile] = await Promise.all([
      params,
      currentProfile()
    ]);
    
    if (!profile) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Check if requester is ADMIN with minimal data
    const channel = await db.channel.findUnique({
      where: { id: channelId },
      select: {
        id: true,
        server: {
          select: {
            members: {
              where: { profileId: profile.id },
              select: { role: true },
              take: 1
            }
          }
        }
      }
    });

    if (!channel) {
      return new NextResponse("Channel not found", { status: 404 });
    }

    const requesterMember = channel.server.members[0];
    if (!requesterMember || requesterMember.role !== MemberRole.ADMIN) {
      return new NextResponse("Forbidden - Admin only", { status: 403 });
    }

    // Delete permission
    await db.channelPermission.delete({
      where: {
        channelId_memberId: {
          channelId,
          memberId
        }
      }
    });

    return new NextResponse(null, { status: 204 });

  } catch (error) {
    console.error("[CHANNEL_PERMISSIONS_DELETE]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
