import { NextResponse } from "next/server";
import { currentProfile } from "@/lib/current-profile";
import { db } from "@/lib/db";
export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ serverId: string }> }
) {
    try {
        // Run params and profile fetch in parallel
        const [resolvedParams, profile] = await Promise.all([
            params,
            currentProfile()
        ]);
        
        if (!profile) {
            return new NextResponse('Unauthorized', { status: 401 });
        }
        if (!resolvedParams.serverId) {
            return new NextResponse('Server ID missing', { status: 400 });
        }
        const server = await db.server.update({
            where: {
                id: resolvedParams.serverId,
                profileId: {
                    not: profile.id
                },
                members: {
                    some: {
                        profileId: profile.id
                    }
                }
            },
            data: {
                members: {
                    deleteMany: {
                        profileId: profile.id
                    }
                }
            }
        });
        return NextResponse.json(server);
    }
    catch (error) {
        console.log("[SERVERS_LEAVE_PATCH]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }

}