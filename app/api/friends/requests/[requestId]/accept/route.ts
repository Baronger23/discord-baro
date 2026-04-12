import { NextResponse } from "next/server";

import { currentProfile } from "@/lib/current-profile";
import { db } from "@/lib/db";
import { ensureDmServerForFriendship, normalizeFriendPair } from "@/lib/friends";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ requestId: string }> }
) {
  try {
    const profile = await currentProfile();
    if (!profile) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { requestId } = await params;
    if (!requestId) {
      return new NextResponse("requestId is required", { status: 400 });
    }

    const requestRecord = await db.friendRequest.findUnique({
      where: {
        id: requestId,
      },
      select: {
        id: true,
        senderProfileId: true,
        receiverProfileId: true,
        status: true,
      },
    });

    if (!requestRecord) {
      return new NextResponse("Request not found", { status: 404 });
    }

    if (requestRecord.receiverProfileId !== profile.id) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    if (requestRecord.status !== "PENDING") {
      return new NextResponse("Request is no longer pending", { status: 409 });
    }

    const pair = normalizeFriendPair(requestRecord.senderProfileId, requestRecord.receiverProfileId);

    const friendship = await db.$transaction(async (tx) => {
      await tx.friendRequest.update({
        where: {
          id: requestRecord.id,
        },
        data: {
          status: "ACCEPTED",
        },
      });

      await tx.friendRequest.updateMany({
        where: {
          senderProfileId: requestRecord.receiverProfileId,
          receiverProfileId: requestRecord.senderProfileId,
          status: "PENDING",
        },
        data: {
          status: "CANCELED",
        },
      });

      const found = await tx.friendship.findUnique({
        where: {
          profileOneId_profileTwoId: pair,
        },
      });

      if (found) {
        return found;
      }

      return tx.friendship.create({
        data: {
          profileOneId: pair.profileOneId,
          profileTwoId: pair.profileTwoId,
        },
      });
    });

    const dmServerId = await ensureDmServerForFriendship(friendship);

    const friendMember = await db.member.findFirst({
      where: {
        serverId: dmServerId,
        profileId: requestRecord.senderProfileId,
      },
      select: {
        id: true,
      },
    });

    return NextResponse.json({
      success: true,
      dmServerId,
      friendMemberId: friendMember?.id ?? null,
    });
  } catch (error) {
    console.error("[FRIEND_REQUEST_ACCEPT_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
