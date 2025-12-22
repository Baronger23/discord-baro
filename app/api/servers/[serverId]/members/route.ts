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
    // Run params and profile fetch in parallel
    const [{ serverId }, profile] = await Promise.all([
      params,
      currentProfile()
    ]);
    
    if (!profile) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Single query to get server with current member role and all members
    const server = await db.server.findUnique({
      where: { id: serverId },
      select: {
        id: true,
        members: {
          include: { profile: true },
          orderBy: { role: "asc" }
        }
      }
    });

    if (!server) {
      return new NextResponse("Server not found", { status: 404 });
    }

    // Find current member from the already fetched members
    const currentMember = server.members.find(m => m.profileId === profile.id);
    if (!currentMember) {
      return new NextResponse("Not a member of this server", { status: 403 });
    }

    // Only ADMIN and MODERATOR can view all members
    if (currentMember.role !== MemberRole.ADMIN && currentMember.role !== MemberRole.MODERATOR) {
      return new NextResponse("Forbidden - Admin or Moderator only", { status: 403 });
    }

    return NextResponse.json(server.members);

  } catch (error) {
    console.error("[SERVER_MEMBERS_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
