import { NextResponse } from "next/server";
import { currentProfile } from "@/lib/current-profile";
import { db } from "@/lib/db";

export async function GET(
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

    // Verify channel exists and is whiteboard type
    const channel = await db.channel.findUnique({
      where: {
        id: channelId,
      },
    });

    if (!channel) {
      return new NextResponse("Channel not found", { status: 404 });
    }

    if (channel.type !== "WHITEBOARD") {
      return new NextResponse("Not a whiteboard channel", { status: 400 });
    }

    // Verify member has access
    const member = await db.member.findFirst({
      where: {
        serverId: channel.serverId,
        profileId: profile.id,
      },
    });

    if (!member) {
      return new NextResponse("Unauthorized", { status: 403 });
    }

    // Get whiteboard state
    const state = await db.whiteboardState.findUnique({
      where: {
        channelId,
      },
    });

    if (!state) {
      // Return empty state if not exists
      return NextResponse.json({
        commands: [],
        version: 0,
      });
    }

    // Parse drawing data
    const commands = JSON.parse(state.drawingData);

    return NextResponse.json({
      commands,
      version: state.version,
      lastEditAt: state.lastEditAt,
    });
  } catch (error) {
    console.log("[WHITEBOARD_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
