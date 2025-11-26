import { NextResponse } from "next/server";
import { currentProfile } from "@/lib/current-profile";
import { getChannelPermissionSummary } from "@/lib/channel-permissions";
import { db } from "@/lib/db";

/**
 * GET /api/channels/[channelId]/my-permissions
 * Get current user's permissions for a specific channel
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

    // Get channel and member
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

    // Get permission summary
    const permissions = await getChannelPermissionSummary(member.id, channelId);

    return NextResponse.json(permissions);

  } catch (error) {
    console.error("[MY_PERMISSIONS_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
