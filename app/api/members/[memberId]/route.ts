import { db } from '@/lib/db';
import { NextResponse } from "next/server";
import { currentProfile } from "@/lib/current-profile";

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ memberId: string }> }
) {
    try {
        const resolvedParams = await params;
        const profile = await currentProfile();
        const { searchParams } = new URL(req.url);
        const serverId = searchParams.get("serverId");
        if (!serverId) {
            return new NextResponse('ServerId is missing', { status: 400 });
        }

        if (!profile) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        if (!resolvedParams.memberId) {
            return new NextResponse('MemberId is missing', { status: 400 });
        }

        const server = await db.server.update({
            where: {
                id: serverId,
                profileId: profile.id
            },
            data: {
                members: {
                    deleteMany: {
                        id: resolvedParams.memberId,
                        profileId: { not: profile.id }
                    }
                }
            },
            include: {
                members: {
                    include: {
                        profile: true
                    },
                    orderBy: {
                        role: "asc"
                    }
                }
            }
        })
        return NextResponse.json(server);
    }
    catch (error) {
        console.error("Error kicking member:", error);
        return new NextResponse('Internal Error', { status: 500 });
    }
}
export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ memberId: string }> }
) {
    try {
        // Parse all inputs in parallel
        const { searchParams } = new URL(req.url);
        const serverId = searchParams.get("serverId");
        
        // Early validation before any async operations
        if (!serverId) {
            return new NextResponse('ServerId is missing', { status: 400 });
        }

        // Run params resolution, profile fetch, and body parsing in parallel
        const [resolvedParams, profile, body] = await Promise.all([
            params,
            currentProfile(),
            req.json()
        ]);
        
        const { role } = body;
        
        if (!profile) {
            return new NextResponse('Unauthorized', { status: 401 });
        }
        if (!resolvedParams.memberId) {
            return new NextResponse('MemberId is missing', { status: 400 });
        }

        // Check if member exists with minimal data needed
        const existingMember = await db.member.findFirst({
            where: { id: resolvedParams.memberId },
            select: {
                id: true,
                profileId: true,
                serverId: true
            }
        });
        
        if (!existingMember) {
            return new NextResponse('Member not found', { status: 404 });
        }
        
        // Check if user is trying to update their own role
        if (existingMember.profileId === profile.id) {
            return new NextResponse('Cannot update your own role', { status: 403 });
        }
        
        // Check if the member belongs to the server
        if (existingMember.serverId !== serverId) {
            return new NextResponse('Member not in this server', { status: 400 });
        }
        
        // Update member and fetch updated server in one transaction
        const [, server] = await Promise.all([
            db.member.update({
                where: { id: resolvedParams.memberId },
                data: { role }
            }),
            db.server.findUnique({
                where: {
                    id: serverId,
                    profileId: profile.id
                },
                include: {
                    members: {
                        include: { profile: true },
                        orderBy: { role: "asc" }
                    }
                }
            })
        ]);

        if (!server) {
            return new NextResponse('Server not found', { status: 404 });
        }

        return NextResponse.json(server);
    }
    catch (error) {
        console.log("[MEMBER_ID_PATCH]", error);
        return new NextResponse('Internal Error', { status: 500 });
    }
}