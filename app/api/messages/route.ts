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
        const profile = await currentProfile();
        const { searchParams } = new URL(req.url);

        const cursor = searchParams.get("cursor");
        const channelId = searchParams.get("channelId");

        if ( !profile ) {
            return new NextResponse("Unauthorized", { status: 401 });
        }
        if ( !channelId ) {
            return new NextResponse("Channel ID is missing", { status: 400 });
        }

        // Get member ID to check permissions
        const channel = await db.channel.findUnique({
            where: { id: channelId },
            include: {
                server: {
                    include: {
                        members: {
                            where: {
                                profileId: profile.id
                            }
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

        // Check if member can view this channel
        const hasAccess = await canViewChannel(member.id, channelId);
        if (!hasAccess) {
            return new NextResponse("You don't have permission to view this channel", { status: 403 });
        }

        let messages: Message[] = [];
        if ( cursor ) {
            messages = await db.message.findMany({
                take: MESSAGES_BATCH,
                skip: 1,
                cursor: { id: cursor },
                where: { channelId },
                include: {
                    member: {
                        include: { profile: true }
                    }
                },
                orderBy: { createdAt: 'desc' }
            });
        }
        else {
            messages = await db.message.findMany({
                take: MESSAGES_BATCH,
                where: {
                    channelId,
                },
                include: { 
                    member: {
                        include: { profile: true }
                    }
                },
                orderBy: { createdAt: 'desc' }
            });
        }
        
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