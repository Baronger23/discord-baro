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
    const profile = await currentProfile();
    if (!profile) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { channelId } = await params;

    // Get channel with server info
    const channel = await db.channel.findUnique({
      where: { id: channelId },
      include: {
        server: {
          include: {
            members: {
              where: {
                profileId: profile.id
              }
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

    // Check if user can view this channel
    const hasAccess = await canViewChannel(member.id, channelId);
    if (!hasAccess) {
      return new NextResponse("You don't have permission to view this channel", { status: 403 });
    }

    // Get all pinned messages in this channel
    const pinnedMessages = await db.message.findMany({
      where: {
        channelId: channelId,
        pinned: true,
        deleted: false, // Don't show deleted messages
      },
      include: {
        member: {
          include: {
            profile: true
          }
        }
      },
      orderBy: {
        pinnedAt: 'desc' // Most recently pinned first
      }
    });

    return NextResponse.json(pinnedMessages);

  } catch (error) {
    console.error("[CHANNEL_PINNED_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
