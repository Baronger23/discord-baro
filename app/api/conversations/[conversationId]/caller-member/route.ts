import { NextResponse } from "next/server";
import { currentProfile } from "@/lib/current-profile";
import { db } from "@/lib/db";

/**
 * GET /api/conversations/[conversationId]/caller-member?callerProfileId=...
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
    const { searchParams } = new URL(req.url);
    const callerProfileId = searchParams.get("callerProfileId")?.trim();

    if (!callerProfileId) {
      return new NextResponse("callerProfileId is required", { status: 400 });
    }

    const conversation = await db.conversation.findFirst({
      where: {
        id: conversationId,
        OR: [
          {
            memberOne: {
              profileId: profile.id,
            },
          },
          {
            memberTwo: {
              profileId: profile.id,
            },
          },
        ],
      },
      select: {
        memberOne: {
          select: {
            id: true,
            profileId: true,
          },
        },
        memberTwo: {
          select: {
            id: true,
            profileId: true,
          },
        },
      },
    });

    if (!conversation) {
      return new NextResponse("Conversation not found or access denied", {
        status: 404,
      });
    }

    const callerMember =
      conversation.memberOne.profileId === callerProfileId
        ? conversation.memberOne
        : conversation.memberTwo.profileId === callerProfileId
          ? conversation.memberTwo
          : null;

    if (!callerMember) {
      return new NextResponse("Caller member not found", { status: 404 });
    }

    return NextResponse.json({
      callerMemberId: callerMember.id,
    });
  } catch (error) {
    console.error("[CONVERSATION_CALLER_MEMBER_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
