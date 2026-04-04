import { NextResponse } from "next/server";
import { currentProfile } from "@/lib/current-profile";
import { db } from "@/lib/db";
import { canViewChannel } from "@/lib/channel-permissions";
import { Prisma } from "@prisma/client";

const SEARCH_LIMIT = 30;

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const parseDateBoundary = (value: string, endOfDay: boolean) => {
  if (!value) {
    return null;
  }

  if (DATE_ONLY_REGEX.test(value)) {
    const time = endOfDay ? "23:59:59.999" : "00:00:00.000";
    const date = new Date(`${value}T${time}Z`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
};

/**
 * GET /api/channels/[channelId]/search?q=...&sender=...&from=...&to=...
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ channelId: string }> }
) {
  try {
    const profile = await currentProfile();
    if (!profile) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { channelId } = await params;
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    const sender = (searchParams.get("sender") || "").trim();
    const fromRaw = (searchParams.get("from") || "").trim();
    const toRaw = (searchParams.get("to") || "").trim();

    const from = parseDateBoundary(fromRaw, false);
    const to = parseDateBoundary(toRaw, true);
    const fromIsValid = !!from;
    const toIsValid = !!to;

    if (!q && !sender && !fromIsValid && !toIsValid) {
      return NextResponse.json([]);
    }

    const channel = await db.channel.findUnique({
      where: { id: channelId },
      include: {
        server: {
          include: {
            members: {
              where: {
                profileId: profile.id,
              },
            },
          },
        },
      },
    });

    if (!channel) {
      return new NextResponse("Channel not found", { status: 404 });
    }

    const member = channel.server.members[0];
    if (!member) {
      return new NextResponse("Not a member of this server", { status: 403 });
    }

    const hasAccess = await canViewChannel(member.id, channelId);
    if (!hasAccess) {
      return new NextResponse("You don't have permission to view this channel", {
        status: 403,
      });
    }

    const filters: Prisma.MessageWhereInput[] = [];

    if (q) {
      filters.push({
        content: {
          contains: q,
          mode: "insensitive",
        },
      });
    }

    if (sender) {
      filters.push({
        member: {
          profile: {
            name: {
              contains: sender,
              mode: "insensitive",
            },
          },
        },
      });
    }

    if (fromIsValid || toIsValid) {
      filters.push({
        createdAt: {
          ...(fromIsValid ? { gte: from as Date } : {}),
          ...(toIsValid ? { lte: to as Date } : {}),
        },
      });
    }

    const messages = await db.message.findMany({
      where: {
        channelId,
        deleted: false,
        AND: filters,
      },
      include: {
        member: {
          include: {
            profile: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: SEARCH_LIMIT,
    });

    return NextResponse.json(messages);
  } catch (error) {
    console.error("[CHANNEL_MESSAGES_SEARCH_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
