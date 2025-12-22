import { NextResponse } from "next/server";
import { currentProfile } from "@/lib/current-profile";
import { db } from "@/lib/db";

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

    if (!channelId) {
      return new NextResponse("Channel ID missing", { status: 400 });
    }

    // Single query to get channel with member check included
    const channel = await db.channel.findUnique({
      where: { id: channelId },
      select: {
        id: true,
        type: true,
        serverId: true,
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

    if (channel.type !== "WHITEBOARD") {
      return new NextResponse("Not a whiteboard channel", { status: 400 });
    }

    const member = channel.server.members[0];
    if (!member) {
      return new NextResponse("Unauthorized", { status: 403 });
    }

    // Get whiteboard state
    const state = await db.whiteboardState.findUnique({
      where: { channelId },
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
