import { NextResponse } from "next/server";

import { currentProfile } from "@/lib/current-profile";
import { db } from "@/lib/db";
import { normalizeFriendPair } from "@/lib/friends";

export async function GET() {
  try {
    const profile = await currentProfile();
    if (!profile) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const requests = await db.friendRequest.findMany({
      where: {
        receiverProfileId: profile.id,
        status: "PENDING",
      },
      include: {
        senderProfile: {
          select: {
            id: true,
            name: true,
            imageUrl: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(requests);
  } catch (error) {
    console.error("[FRIEND_REQUESTS_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const profile = await currentProfile();
    if (!profile) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = await req.json();
    const receiverProfileId = (body?.receiverProfileId || "").trim();

    if (!receiverProfileId) {
      return new NextResponse("receiverProfileId is required", { status: 400 });
    }

    if (receiverProfileId === profile.id) {
      return new NextResponse("Cannot send friend request to yourself", { status: 400 });
    }

    const receiver = await db.profile.findUnique({
      where: {
        id: receiverProfileId,
      },
      select: {
        id: true,
      },
    });

    if (!receiver) {
      return new NextResponse("User not found", { status: 404 });
    }

    const pair = normalizeFriendPair(profile.id, receiverProfileId);
    const existingFriendship = await db.friendship.findUnique({
      where: {
        profileOneId_profileTwoId: pair,
      },
      select: {
        id: true,
      },
    });

    if (existingFriendship) {
      return new NextResponse("Already friends", { status: 409 });
    }

    const reverseRequest = await db.friendRequest.findUnique({
      where: {
        senderProfileId_receiverProfileId: {
          senderProfileId: receiverProfileId,
          receiverProfileId: profile.id,
        },
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (reverseRequest?.status === "PENDING") {
      return new NextResponse("User already sent you a request", { status: 409 });
    }

    const requestRecord = await db.friendRequest.upsert({
      where: {
        senderProfileId_receiverProfileId: {
          senderProfileId: profile.id,
          receiverProfileId,
        },
      },
      update: {
        status: "PENDING",
      },
      create: {
        senderProfileId: profile.id,
        receiverProfileId,
      },
      select: {
        id: true,
        status: true,
      },
    });

    return NextResponse.json(requestRecord);
  } catch (error) {
    console.error("[FRIEND_REQUESTS_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
