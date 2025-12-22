import { NextResponse } from "next/server";
import { currentProfile } from "@/lib/current-profile";
import { db } from "@/lib/db";

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ serverId: string }> }
) {
    try {
        // Run all parsing operations in parallel
        const [resolvedParams, profile, body] = await Promise.all([
            params,
            currentProfile(),
            req.json()
        ]);
        
        const { name, imageUrl } = body;
        
        if (!profile) {
            return new NextResponse('Unauthorized', { status: 401 });
        }
        
        const server = await db.server.update({
            where: {
                id: resolvedParams.serverId,
                profileId: profile.id
            },
            data: {
                name,
                imageUrl
            }
        });
        return NextResponse.json(server);
    }
    catch (error) {
        console.log("[SERVER_ID_PATCH]", error);
        return new NextResponse('Internal Error', { status: 500 });
    }
}

export async function DELETE(
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
        
        const server = await db.server.delete({
            where: {
                id: resolvedParams.serverId,
                profileId: profile.id
            },
        });
        return NextResponse.json(server);
    }
    catch (error) {
        console.log("[SERVER_ID_DELETE]", error);
        return new NextResponse('Internal Error', { status: 500 });
    }
}