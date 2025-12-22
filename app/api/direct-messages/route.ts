import { currentProfile } from "@/lib/current-profile";
import { db } from "@/lib/db";
import { DirectMessage } from "@prisma/client";
import { NextResponse } from "next/server";


const MESSAGES_BATCH = 10;

export async function GET(
    req: Request
) {
    try {
        // Parse URL early - no async needed
        const { searchParams } = new URL(req.url);
        const cursor = searchParams.get("cursor");
        const conversationId = searchParams.get("conversationId");

        // Early validation before DB calls
        if ( !conversationId ) {
            return new NextResponse("Conversation ID is missing", { status: 400 });
        }

        const profile = await currentProfile();
        if ( !profile ) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        // Unified query with conditional cursor - eliminates duplicate code
        const messages: DirectMessage[] = await db.directMessage.findMany({
            take: MESSAGES_BATCH,
            ...(cursor && { skip: 1, cursor: { id: cursor } }),
            where: { conversationId },
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
        console.log("[DIRECT_MESSAGES_GET]", error);
        return new NextResponse("Internal error", { status: 500 });
    }
}