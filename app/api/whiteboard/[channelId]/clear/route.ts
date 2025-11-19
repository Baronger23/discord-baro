import { NextResponse } from "next/server";
import { currentProfile } from "@/lib/current-profile";
import { db } from "@/lib/db";

/**
 * POST /api/whiteboard/[channelId]/clear
 * Clear whiteboard (admin/moderator only)
 */
export async function POST(
  req: Request,
  { params }: { params: { channelId: string } }
) {
  try {
    const profile = await currentProfile();

    if (!profile) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { channelId } = params;

    if (!channelId) {
      return new NextResponse("Channel ID missing", { status: 400 });
    }

    // Verify channel exists
    const channel = await db.channel.findUnique({
      where: {
        id: channelId,
      },
    });

    if (!channel) {
      return new NextResponse("Channel not found", { status: 404 });
    }

    // Verify member has permission (admin or moderator)
    const member = await db.member.findFirst({
      where: {
        serverId: channel.serverId,
        profileId: profile.id,
        role: {
          in: ["ADMIN", "MODERATOR"],
        },
      },
    });

    if (!member) {
      return new NextResponse("Unauthorized - requires admin or moderator", { status: 403 });
    }

    // Clear whiteboard state
    await db.whiteboardState.upsert({
      where: {
        channelId,
      },
      update: {
        drawingData: "[]",
        version: 0,
        lastEditBy: profile.id,
        lastEditAt: new Date(),
      },
      create: {
        channelId,
        drawingData: "[]",
        version: 0,
        lastEditBy: profile.id,
      },
    });

    // Optionally delete all draw commands (for cleanup)
    await db.whiteboardDrawCommand.deleteMany({
      where: {
        channelId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.log("[WHITEBOARD_CLEAR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
