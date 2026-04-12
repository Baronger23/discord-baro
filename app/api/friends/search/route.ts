import { NextResponse } from "next/server";

import { currentProfile } from "@/lib/current-profile";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const profile = await currentProfile();
    if (!profile) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();

    if (q.length < 2) {
      return NextResponse.json([]);
    }

    const users = await db.profile.findMany({
      where: {
        id: {
          not: profile.id,
        },
        OR: [
          {
            name: {
              contains: q,
              mode: "insensitive",
            },
          },
          {
            email: {
              contains: q,
              mode: "insensitive",
            },
          },
        ],
      },
      select: {
        id: true,
        name: true,
        imageUrl: true,
        email: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 20,
    });

    if (!users.length) {
      return NextResponse.json([]);
    }

    const userIds = users.map((u) => u.id);

    const [friendships, sentRequests, receivedRequests] = await Promise.all([
      db.friendship.findMany({
        where: {
          OR: [
            {
              profileOneId: profile.id,
              profileTwoId: {
                in: userIds,
              },
            },
            {
              profileTwoId: profile.id,
              profileOneId: {
                in: userIds,
              },
            },
          ],
        },
        select: {
          profileOneId: true,
          profileTwoId: true,
        },
      }),
      db.friendRequest.findMany({
        where: {
          senderProfileId: profile.id,
          receiverProfileId: {
            in: userIds,
          },
          status: "PENDING",
        },
        select: {
          receiverProfileId: true,
        },
      }),
      db.friendRequest.findMany({
        where: {
          receiverProfileId: profile.id,
          senderProfileId: {
            in: userIds,
          },
          status: "PENDING",
        },
        select: {
          senderProfileId: true,
        },
      }),
    ]);

    const friendIds = new Set<string>();
    friendships.forEach((f) => {
      friendIds.add(f.profileOneId === profile.id ? f.profileTwoId : f.profileOneId);
    });

    const sentIds = new Set(sentRequests.map((r) => r.receiverProfileId));
    const receivedIds = new Set(receivedRequests.map((r) => r.senderProfileId));

    const results = users.map((user) => ({
      ...user,
      state: friendIds.has(user.id)
        ? "FRIEND"
        : sentIds.has(user.id)
        ? "PENDING_SENT"
        : receivedIds.has(user.id)
        ? "PENDING_RECEIVED"
        : "NONE",
    }));

    return NextResponse.json(results);
  } catch (error) {
    console.error("[FRIENDS_SEARCH_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
