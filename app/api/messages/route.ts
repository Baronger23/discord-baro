import { currentProfile } from "@/lib/current-profile";
import { db } from "@/lib/db";
import { Message } from "@prisma/client";
import { NextResponse } from "next/server";
import { canViewChannel } from "@/lib/channel-permissions";


const MESSAGES_BATCH = 10;

export async function GET(
    req: Request
) {
    try {
        // Parse URL early - no async needed
        const { searchParams } = new URL(req.url);
        const cursor = searchParams.get("cursor");
        const channelId = searchParams.get("channelId");

        // Early validation before any DB calls
        if ( !channelId ) {
            return new NextResponse("Channel ID is missing", { status: 400 });
        }

        const profile = await currentProfile();
        if ( !profile ) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        // Single optimized query to get channel + member in one call
        const channel = await db.channel.findUnique({
            where: { id: channelId },
            select: {
                id: true,
                serverId: true,
                server: {
                    select: {
                        members: {
                            where: { profileId: profile.id },
                            select: { id: true },
                            take: 1
                        }
                    }
                }
            }
        });

        if (!channel) {
            return new NextResponse("Channel not found", { status: 404 });
        }

        const member = channel.server.members[0];
        if (!member) {
            return new NextResponse("Not a member of this server", { status: 403 });
        }

        // Check permission in parallel with preparing messages query base
        const hasAccess = await canViewChannel(member.id, channelId);
        if (!hasAccess) {
            return new NextResponse("You don't have permission to view this channel", { status: 403 });
        }

        // Unified messages query with conditional cursor
        const messages: Message[] = await db.message.findMany({
            take: MESSAGES_BATCH,
            ...(cursor && { skip: 1, cursor: { id: cursor } }),
            where: { channelId },
            include: {
                member: {
                    include: { profile: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        
        let nextCursor= null;
        if ( messages.length === MESSAGES_BATCH ) {
            nextCursor = messages[MESSAGES_BATCH - 1].id;
        }

        return NextResponse.json({
            items: messages,
            nextCursor,
        });

    }
    catch (error) {
        console.log("[MESSAGES_GET]", error);
        return new NextResponse("Internal error", { status: 500 });
    }
}