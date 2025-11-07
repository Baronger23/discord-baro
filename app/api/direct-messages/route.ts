import { currentProfile } from "@/lib/current-profile";
import { db } from "@/lib/db";
import { DirectMessage } from "@prisma/client";
import { NextResponse } from "next/server";

// ✅ OPTIMIZATION: Larger batch size for better performance
const MESSAGES_BATCH = 50;

export async function GET(
    req: Request
) {
    try {
        const profile = await currentProfile();
        const { searchParams } = new URL(req.url);

        const cursor = searchParams.get("cursor");
        const conversationId = searchParams.get("conversationId");

        if (!profile) {
            return new NextResponse("Unauthorized", { status: 401 });
        }
        if (!conversationId) {
            return new NextResponse("Conversation ID is missing", { status: 400 });
        }

        // ✅ OPTIMIZATION: Unified query with conditional cursor
        let messages: DirectMessage[] = [];
        
        messages = await db.directMessage.findMany({
            take: MESSAGES_BATCH,
            ...(cursor && { 
                skip: 1, 
                cursor: { id: cursor } 
            }),
            where: { 
                conversationId,
                deleted: false  // ✅ Filter deleted messages at DB level
            },
            include: {
                member: {
                    include: { 
                        profile: {
                            select: {  // ✅ Only select needed fields
                                id: true,
                                name: true,
                                imageUrl: true,
                                email: true,
                            }
                        }
                    }
                }
            },
            orderBy: { 
                createdAt: 'desc' 
            }
        });
        
        // ✅ OPTIMIZATION: Check for next page
        let nextCursor = null;
        if (messages.length === MESSAGES_BATCH) {
            nextCursor = messages[MESSAGES_BATCH - 1].id;
        }

        return NextResponse.json({
            items: messages,
            nextCursor,
        }, {
            headers: {
                // ✅ Cache for 5 seconds
                'Cache-Control': 'private, max-age=5',
            }
        });

    } catch (error) {
        console.error("[DIRECT_MESSAGES_GET]", error);
        return new NextResponse("Internal error", { status: 500 });
    }
}

// ✅ PERFORMANCE TIP: Add index for optimal performance
// CREATE INDEX idx_direct_message_conversation_created ON "DirectMessage"("conversationId", "createdAt" DESC);