import { db } from "@/lib/db";

export type FriendDmItem = {
  friendshipId: string;
  friendProfileId: string;
  name: string;
  imageUrl: string;
  email: string;
  dmServerId: string | null;
  friendMemberId: string | null;
};

export const getFriendDmItems = async (profileId: string): Promise<FriendDmItem[]> => {
  const friendships = await db.friendship.findMany({
    where: {
      OR: [{ profileOneId: profileId }, { profileTwoId: profileId }],
    },
    include: {
      profileOne: {
        select: {
          id: true,
          name: true,
          imageUrl: true,
          email: true,
        },
      },
      profileTwo: {
        select: {
          id: true,
          name: true,
          imageUrl: true,
          email: true,
        },
      },
      dmServer: {
        select: {
          id: true,
          members: {
            select: {
              id: true,
              profileId: true,
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return friendships.map((friendship) => {
    const friend = friendship.profileOneId === profileId ? friendship.profileTwo : friendship.profileOne;
    const friendMember = friendship.dmServer?.members.find((m) => m.profileId === friend.id) ?? null;

    return {
      friendshipId: friendship.id,
      friendProfileId: friend.id,
      name: friend.name,
      imageUrl: friend.imageUrl,
      email: friend.email,
      dmServerId: friendship.dmServer?.id ?? null,
      friendMemberId: friendMember?.id ?? null,
    };
  });
};

export const getIncomingFriendRequests = async (profileId: string) => {
  return db.friendRequest.findMany({
    where: {
      receiverProfileId: profileId,
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
};
