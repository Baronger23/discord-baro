import { currentProfile } from "@/lib/current-profile";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import React from "react";
import { ServerSidebar } from "@/components/servers/server-sidebar";
const ServerIdLayout = async ({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ serverId: string }>;
}) => {
    const { serverId } = await params;
    const profile = await currentProfile();
    if (!profile) {
        return redirect("/sign-in");
    }
    
    const server = await db.server.findUnique({
        where: { 
            id: serverId
        },
        include: {
            members: {
                where: {
                    profileId: profile.id
                }
            }
        }
    });

    if (!server) {
        return redirect("/");
    }

    const member = server.members?.[0];
    if (!member) {
        return redirect("/");
    }

    return (
        <div className="h-full">
            {/* quên h-full */}
            <div className="relative h-full"> 
                <div className="hidden md:flex h-full w-60 z-20 flex-col fixed inset-y-0">
                    <ServerSidebar serverId={serverId}/>
                </div>
                <main className="h-full md:pl-60 flex flex-col">
                    {children}
                </main>
            </div>
        </div>
    );
};

export default ServerIdLayout;