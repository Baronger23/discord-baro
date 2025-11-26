import { NextResponse } from "next/server";
import { currentProfile } from "@/lib/current-profile";
import { db } from "@/lib/db";

/**
 * GET /api/conversations/[conversationId]/pinned
 * Get all pinned direct messages in a conversation
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const profile = await currentProfile();
    if (!profile) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { conversationId } = await params;

    // Verify user is part of conversation
    const conversation = await db.conversation.findFirst({
      where: {
        id: conversationId,
        OR: [
          {
            memberOne: {
              profileId: profile.id
            }
          },
          {
            memberTwo: {
              profileId: profile.id
            }
          }
        ]
      }
    });

    if (!conversation) {
      return new NextResponse("Conversation not found or access denied", { status: 404 });
    }

    // Get all pinned messages
    const pinnedMessages = await db.directMessage.findMany({
      where: {
        conversationId,
        pinned: true,
        deleted: false
      },
      include: {
        member: {
          include: {
            profile: true
          }
        }
      },
      orderBy: {
        pinnedAt: 'desc'
      }
    });

    return NextResponse.json(pinnedMessages);

  } catch (error) {
    console.error("[CONVERSATION_PINNED_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
