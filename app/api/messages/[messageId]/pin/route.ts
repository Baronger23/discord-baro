import { NextResponse } from "next/server";
import { currentProfile } from "@/lib/current-profile";
import { db } from "@/lib/db";
import { MemberRole } from "@prisma/client";
import { canManageMessages } from "@/lib/channel-permissions";

/**
 * POST /api/messages/[messageId]/pin
 * Pin a message (requires canManageMessages permission)
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    const profile = await currentProfile();
    if (!profile) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { messageId } = await params;

    // Get message with channel and server info
    const message = await db.message.findUnique({
      where: { id: messageId },
      include: {
        channel: {
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
        }
      }
    });

    if (!message) {
      return new NextResponse("Message not found", { status: 404 });
    }

    const member = message.channel.server.members[0];
    if (!member) {
      return new NextResponse("Not a member of this server", { status: 403 });
    }

    // Check if user has permission to manage messages
    const hasPermission = await canManageMessages(member.id, message.channelId);
    if (!hasPermission) {
      return new NextResponse("You don't have permission to pin messages", { status: 403 });
    }

    // Pin the message
    const pinnedMessage = await db.message.update({
      where: { id: messageId },
      data: {
        pinned: true,
        pinnedAt: new Date(),
        pinnedById: member.id,
      },
      include: {
        member: {
          include: {
            profile: true
          }
        }
      }
    });

    return NextResponse.json(pinnedMessage);

  } catch (error) {
    console.error("[MESSAGE_PIN_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

/**
 * DELETE /api/messages/[messageId]/pin
 * Unpin a message (requires canManageMessages permission)
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    const profile = await currentProfile();
    if (!profile) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { messageId } = await params;

    // Get message with channel and server info
    const message = await db.message.findUnique({
      where: { id: messageId },
      include: {
        channel: {
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
        }
      }
    });

    if (!message) {
      return new NextResponse("Message not found", { status: 404 });
    }

    const member = message.channel.server.members[0];
    if (!member) {
      return new NextResponse("Not a member of this server", { status: 403 });
    }

    // Check if user has permission to manage messages
    const hasPermission = await canManageMessages(member.id, message.channelId);
    if (!hasPermission) {
      return new NextResponse("You don't have permission to unpin messages", { status: 403 });
    }

    // Unpin the message
    const unpinnedMessage = await db.message.update({
      where: { id: messageId },
      data: {
        pinned: false,
        pinnedAt: null,
        pinnedById: null,
      },
      include: {
        member: {
          include: {
            profile: true
          }
        }
      }
    });

    return NextResponse.json(unpinnedMessage);

  } catch (error) {
    console.error("[MESSAGE_PIN_DELETE]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
