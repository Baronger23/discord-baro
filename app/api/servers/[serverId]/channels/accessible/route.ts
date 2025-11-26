import { NextResponse } from "next/server";
import { currentProfile } from "@/lib/current-profile";
import { getAccessibleChannels } from "@/lib/channel-permissions";

/**
 * GET /api/servers/[serverId]/channels/accessible
 * Get all channels the current user can view in a server
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ serverId: string }> }
) {
  try {
    const profile = await currentProfile();
    if (!profile) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { serverId } = await params;

    // Get member ID
    const { db } = await import("@/lib/db");
    const member = await db.member.findFirst({
      where: {
        serverId,
        profileId: profile.id
      }
    });

    if (!member) {
      return new NextResponse("Not a member of this server", { status: 403 });
    }

    // Get accessible channels using permission system
    const channels = await getAccessibleChannels(member.id, serverId);

    return NextResponse.json(channels);

  } catch (error) {
    console.error("[ACCESSIBLE_CHANNELS_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
