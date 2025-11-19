import { NextResponse } from "next/server";
import { currentProfile } from "@/lib/current-profile";
import { db } from "@/lib/db";

/**
 * POST /api/direct-messages/[directMessageId]/pin
 * Pin a direct message (both users in conversation can pin)
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ directMessageId: string }> }
) {
  try {
    const profile = await currentProfile();
    if (!profile) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { directMessageId } = await params;

    // Get direct message with conversation info
    const directMessage = await db.directMessage.findUnique({
      where: { id: directMessageId },
      include: {
        conversation: {
          include: {
            memberOne: true,
            memberTwo: true
          }
        },
        member: true
      }
    });

    if (!directMessage) {
      return new NextResponse("Direct message not found", { status: 404 });
    }

    // Check if user is part of this conversation
    const conversation = directMessage.conversation;
    const isMemberOne = conversation.memberOne.profileId === profile.id;
    const isMemberTwo = conversation.memberTwo.profileId === profile.id;

    if (!isMemberOne && !isMemberTwo) {
      return new NextResponse("You don't have permission to pin messages in this conversation", { status: 403 });
    }

    // Get current member
    const currentMember = isMemberOne ? conversation.memberOne : conversation.memberTwo;

    // Pin the direct message
    const pinnedMessage = await db.directMessage.update({
      where: { id: directMessageId },
      data: {
        pinned: true,
        pinnedAt: new Date(),
        pinnedById: currentMember.id,
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
    console.error("[DIRECT_MESSAGE_PIN_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

/**
 * DELETE /api/direct-messages/[directMessageId]/pin
 * Unpin a direct message
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ directMessageId: string }> }
) {
  try {
    const profile = await currentProfile();
    if (!profile) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { directMessageId } = await params;

    // Get direct message with conversation info
    const directMessage = await db.directMessage.findUnique({
      where: { id: directMessageId },
      include: {
        conversation: {
          include: {
            memberOne: true,
            memberTwo: true
          }
        }
      }
    });

    if (!directMessage) {
      return new NextResponse("Direct message not found", { status: 404 });
    }

    // Check if user is part of this conversation
    const conversation = directMessage.conversation;
    const isMemberOne = conversation.memberOne.profileId === profile.id;
    const isMemberTwo = conversation.memberTwo.profileId === profile.id;

    if (!isMemberOne && !isMemberTwo) {
      return new NextResponse("You don't have permission to unpin messages in this conversation", { status: 403 });
    }

    // Unpin the direct message
    const unpinnedMessage = await db.directMessage.update({
      where: { id: directMessageId },
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
    console.error("[DIRECT_MESSAGE_PIN_DELETE]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
