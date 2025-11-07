import { currentProfile } from "@/lib/current-profile";
import { db } from "@/lib/db";
import { Message } from "@prisma/client";
import { NextResponse } from "next/server";
import { canViewChannel } from "@/lib/channel-permissions";

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

        // --- Logic từ nhánh `release/1.0` (Permission Checks) ---
        // Lấy thông tin channel và member để kiểm tra quyền
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

        // Kiểm tra xem member có quyền xem channel này không
        const hasAccess = await canViewChannel(member.id, channelId);
        if (!hasAccess) {
            return new NextResponse("You don't have permission to view this channel", { status: 403 });
        }
        // --- Kết thúc logic từ `release/1.0` ---


        // --- Logic từ nhánh `feat/pagination` (Data Query) ---
        let messages: Message[] = [];
        
        messages = await db.message.findMany({
            take: MESSAGES_BATCH,
            ...(cursor && { 
                skip: 1, 
                cursor: { id: cursor } 
            }),
            where: { 
                channelId,
                deleted: false  // ✅ Filter tin nhắn đã xóa ở cấp DB
            },
            include: {
                member: {
                    include: { 
                        profile: {
                            select: {  // ✅ Chỉ chọn các trường cần thiết
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
        
        // ✅ OPTIMIZATION: Kiểm tra trang tiếp theo
        let nextCursor = null;
        if (messages.length === MESSAGES_BATCH) {
            nextCursor = messages[MESSAGES_BATCH - 1].id;
        }

        return NextResponse.json({
            items: messages,
            nextCursor,
        }, {
            headers: {
                // ✅ Cache 5 giây để giảm tải database
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