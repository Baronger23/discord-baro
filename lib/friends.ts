import { MemberRole, type Friendship } from "@prisma/client";

import { db } from "@/lib/db";
import { getOrCreateConversation } from "@/lib/conversation";

export const normalizeFriendPair = (profileAId: string, profileBId: string) => {
  return profileAId < profileBId
    ? { profileOneId: profileAId, profileTwoId: profileBId }
    : { profileOneId: profileBId, profileTwoId: profileAId };
};

export const findFriendship = async (profileAId: string, profileBId: string) => {
  const pair = normalizeFriendPair(profileAId, profileBId);

  return db.friendship.findUnique({
    where: {
      profileOneId_profileTwoId: pair,
    },
  });
};

export const ensureDmServerForFriendship = async (friendship: Friendship) => {
  if (friendship.dmServerId) {
    const members = await db.member.findMany({
      where: {
        serverId: friendship.dmServerId,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    if (members.length >= 2) {
      await getOrCreateConversation(members[0].id, members[1].id);
      return friendship.dmServerId;
    }
  }

  const dmKey = `dm:${friendship.profileOneId}:${friendship.profileTwoId}`;

  const server = await db.server.create({
    data: {
      profileId: friendship.profileOneId,
      name: "Direct Messages",
      imageUrl: "https://api.dicebear.com/7.x/initials/svg?seed=DM",
      inviteCode: crypto.randomUUID(),
      isDm: true,
      dmKey,
      members: {
        create: [
          {
            profileId: friendship.profileOneId,
            role: MemberRole.GUEST,
          },
          {
            profileId: friendship.profileTwoId,
            role: MemberRole.GUEST,
          },
        ],
      },
    },
    include: {
      members: {
        orderBy: {
          createdAt: "asc",
        },
      },
    },
  });

  await db.friendship.update({
    where: {
      id: friendship.id,
    },
    data: {
      dmServerId: server.id,
    },
  });

  if (server.members.length >= 2) {
    await getOrCreateConversation(server.members[0].id, server.members[1].id);
  }

  return server.id;
};
