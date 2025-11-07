import { currentProfile } from "@/lib/current-profile";
import { db } from "@/lib/db";
import { Message } from "@prisma/client";
import { NextResponse } from "next/server";

// ✅ OPTIMIZATION: Larger batch size for better performance
// 50 messages ≈ 1-2 screens worth, reduces API calls
const MESSAGES_BATCH = 50;

export async function GET(
    req: Request
) {
    try {
        const profile = await currentProfile();
        const { searchParams } = new URL(req.url);

        const cursor = searchParams.get("cursor");
        const channelId = searchParams.get("channelId");

        if (!profile) {
            return new NextResponse("Unauthorized", { status: 401 });
        }
        if (!channelId) {
            return new NextResponse("Channel ID is missing", { status: 400 });
        }

        // ✅ OPTIMIZATION: Unified query with conditional cursor
        // Reduces code duplication and easier to maintain
        let messages: Message[] = [];
        
        messages = await db.message.findMany({
            take: MESSAGES_BATCH,
            ...(cursor && { 
                skip: 1, 
                cursor: { id: cursor } 
            }),
            where: { 
                channelId,
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
                // ✅ Cache for 5 seconds to reduce database load
                'Cache-Control': 'private, max-age=5',
            }
        });

    } catch (error) {
        console.error("[MESSAGES_GET]", error);
        return new NextResponse("Internal error", { status: 500 });
    }
}

// ✅ PERFORMANCE TIP: Add these indexes to your database for optimal performance
// Run in Prisma Studio or directly in PostgreSQL:
// 
// CREATE INDEX idx_message_channel_created ON "Message"("channelId", "createdAt" DESC);
// CREATE INDEX idx_message_channel_deleted ON "Message"("channelId", "deleted", "createdAt" DESC);
// 
// These indexes make cursor-based pagination O(1) instead of O(n)