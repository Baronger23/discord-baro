import { NextResponse } from "next/server";
import { currentProfile } from "@/lib/current-profile";
import { db } from "@/lib/db";
import { MemberRole } from "@prisma/client";

export async function POST (
    req: Request,
) {
    try {
        // Parse URL early for validation - no async needed
        const { searchParams } = new URL(req.url);
        const serverId = searchParams.get("serverId");
        
        // Early validation before any async operations
        if (!serverId) {
            return new NextResponse('Server ID missing', { status: 400 });
        }

        // Run profile fetch and body parsing in parallel
        const [profile, body] = await Promise.all([
            currentProfile(),
            req.json()
        ]);
        
        const { name, type } = body;
        
        if (!profile) {
            return new NextResponse('Unauthorized', { status: 401 });
        }
        if (name === "general") {
            return new NextResponse("Name cannot be 'general'", { status: 400 });
        }

        const server = await db.server.update({
            where: {
                id: serverId,
                members: {
                    some: { 
                        profileId: profile.id, 
                        role: { 
                            in: [MemberRole.ADMIN, MemberRole.MODERATOR] 
                        } 
                    }
                }
            },
            data: {
                channels: {
                    create: {
                        profileId: profile.id,
                        name,
                        type
                    }
                }
            }
        });
        
        return NextResponse.json(server);
    } 
    catch (error) {
        console.log("[CHANNELS_POST]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}

