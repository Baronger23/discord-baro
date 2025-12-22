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
    // Run params and profile fetch in parallel
    const [{ conversationId }, profile] = await Promise.all([
      params,
      currentProfile()
    ]);
    
    if (!profile) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Run conversation verification and pinned messages fetch in parallel
    // The conversation query will fail if user doesn't have access
    const [conversation, pinnedMessages] = await Promise.all([
      db.conversation.findFirst({
        where: {
          id: conversationId,
          OR: [
            { memberOne: { profileId: profile.id } },
            { memberTwo: { profileId: profile.id } }
          ]
        },
        select: { id: true } // Only need to verify existence
      }),
      db.directMessage.findMany({
        where: {
          conversationId,
          pinned: true,
          deleted: false,
          // Also verify user has access through conversation
          conversation: {
            OR: [
              { memberOne: { profileId: profile.id } },
              { memberTwo: { profileId: profile.id } }
            ]
          }
        },
        include: {
          member: {
            include: { profile: true }
          }
        },
        orderBy: { pinnedAt: 'desc' }
      })
    ]);

    if (!conversation) {
      return new NextResponse("Conversation not found or access denied", { status: 404 });
    }

    return NextResponse.json(pinnedMessages);

  } catch (error) {
    console.error("[CONVERSATION_PINNED_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
