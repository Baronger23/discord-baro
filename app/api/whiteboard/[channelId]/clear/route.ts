import { NextResponse } from "next/server";
import { currentProfile } from "@/lib/current-profile";
import { db } from "@/lib/db";

/**
 * POST /api/whiteboard/[channelId]/clear
 * Clear whiteboard (admin/moderator only)
 */
export async function POST(
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

    // Single query to verify channel and member permission
    const channel = await db.channel.findUnique({
      where: { id: channelId },
      select: {
        id: true,
        serverId: true,
        server: {
          select: {
            members: {
              where: {
                profileId: profile.id,
                role: { in: ["ADMIN", "MODERATOR"] }
              },
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
      return new NextResponse("Unauthorized - requires admin or moderator", { status: 403 });
    }

    // Run both clear operations in parallel
    await Promise.all([
      db.whiteboardState.upsert({
        where: { channelId },
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
      }),
      db.whiteboardDrawCommand.deleteMany({
        where: { channelId },
      })
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.log("[WHITEBOARD_CLEAR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
