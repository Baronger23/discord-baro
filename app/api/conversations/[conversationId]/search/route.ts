import { NextResponse } from "next/server";
import { currentProfile } from "@/lib/current-profile";
import { db } from "@/lib/db";
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
 * GET /api/conversations/[conversationId]/search?q=...&sender=...&from=...&to=...
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
    });

    if (!conversation) {
      return new NextResponse("Conversation not found or access denied", {
        status: 404,
      });
    }

    const filters: Prisma.DirectMessageWhereInput[] = [];

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

    const messages = await db.directMessage.findMany({
      where: {
        conversationId,
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
    console.error("[CONVERSATION_MESSAGES_SEARCH_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
