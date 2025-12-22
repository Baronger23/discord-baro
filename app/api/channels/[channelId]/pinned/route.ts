import { NextResponse } from "next/server";
import { currentProfile } from "@/lib/current-profile";
import { db } from "@/lib/db";
import { canViewChannel } from "@/lib/channel-permissions";

/**
 * GET /api/channels/[channelId]/pinned
 * Get all pinned messages in a channel
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

    // Single optimized query to get channel + member
    const channel = await db.channel.findUnique({
      where: { id: channelId },
      select: {
        id: true,
        server: {
          select: {
            members: {
              where: { profileId: profile.id },
              select: { id: true },
              take: 1
            }
          }
        }
      }
    });

    if (!channel) {
      return new NextResponse("Channel not found", { status: 404 });
    }

    const member = channel.server.members[0];
    if (!member) {
      return new NextResponse("Not a member of this server", { status: 403 });
    }

    // Check permission and fetch pinned messages in parallel
    const [hasAccess, pinnedMessages] = await Promise.all([
      canViewChannel(member.id, channelId),
      db.message.findMany({
        where: {
          channelId: channelId,
          pinned: true,
          deleted: false,
        },
        include: {
          member: {
            include: { profile: true }
          }
        },
        orderBy: { pinnedAt: 'desc' }
      })
    ]);
    
    if (!hasAccess) {
      return new NextResponse("You don't have permission to view this channel", { status: 403 });
    }

    return NextResponse.json(pinnedMessages);

  } catch (error) {
    console.error("[CHANNEL_PINNED_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
