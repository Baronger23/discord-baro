import { NextResponse } from "next/server";
import { currentProfile } from "@/lib/current-profile";
import { db } from "@/lib/db";
import { MemberRole } from "@prisma/client";

/**
 * GET /api/servers/[serverId]/members
 * Get all members of a server (requires ADMIN or MODERATOR role)
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ serverId: string }> }
) {
  try {
    const profile = await currentProfile();
    if (!profile) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { serverId } = await params;

    // Get server and check if user is a member
    const server = await db.server.findUnique({
      where: {
        id: serverId,
      },
      include: {
        members: {
          where: {
            profileId: profile.id
          }
        }
      }
    });

    if (!server) {
      return new NextResponse("Server not found", { status: 404 });
    }

    const currentMember = server.members[0];
    if (!currentMember) {
      return new NextResponse("Not a member of this server", { status: 403 });
    }

    // Only ADMIN and MODERATOR can view all members
    if (currentMember.role !== MemberRole.ADMIN && currentMember.role !== MemberRole.MODERATOR) {
      return new NextResponse("Forbidden - Admin or Moderator only", { status: 403 });
    }

    // Get all members with their profiles
    const members = await db.member.findMany({
      where: {
        serverId: serverId
      },
      include: {
        profile: true
      },
      orderBy: {
        role: "asc" // ADMIN first, then MODERATOR, then GUEST
      }
    });

    return NextResponse.json(members);

  } catch (error) {
    console.error("[SERVER_MEMBERS_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
