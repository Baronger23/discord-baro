import { currentProfile } from "@/lib/current-profile";
import { ChannelType, Channel, Member, Profile, MemberRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { Hash, Scroll, Server, Video, Mic, ShieldCheck, ShieldAlert, Lock, PenTool } from "lucide-react";
import { ServerHeader } from "./server-header";
import { ScrollArea } from "../ui/scroll-area";
import { ServerSearch } from "./sever-search";
import { Separator } from "@/components/ui/separator";
import { ServerSection } from "./server-section";
import { ServerChannel } from "./server-channel";
import { ServerMember } from "./server-member";
import { getAccessibleChannels } from "@/lib/channel-permissions";
interface ServerSidebarProps {
    serverId?: string;
}

const iconMap= {
    [ChannelType.TEXT]: <Hash className="mr-2 h-4 w-4" />,
    [ChannelType.AUDIO]: <Mic className="mr-2 h-4 w-4" />,
    [ChannelType.VIDEO]: <Video className="mr-2 h-4 w-4" />,
    [ChannelType.WHITEBOARD]: <PenTool className="mr-2 h-4 w-4" />,
}

const roleIconMap= {
    [MemberRole.GUEST]: null,
    [MemberRole.MODERATOR]: <ShieldCheck className="mr-2 h-4 ml-2 text-indigo-500" />,
    [MemberRole.ADMIN]: <ShieldAlert className="mr-2 h-4 ml-2 text-rose-500" />,
}

export const ServerSidebar = async ({
    serverId
}: ServerSidebarProps) => {
    const profile = await currentProfile();
    if (!profile) {
        return redirect("/sign-in");
    }
    const server = await db.server.findUnique({
        where: {
            id: serverId,
        },
        include: {
            channels: {
                orderBy: {
                    createdAt: "asc",
                },
            },
            members: {
                include: {
                    profile: true,
                },
                orderBy: {
                    createdAt: "asc",
                },
            }
        }
    });

    if (!server) {
        return redirect("/");
    }

    // Get current member
    const currentMember = server.members.find((member) => member.profileId === profile.id);
    if (!currentMember) {
        return redirect("/");
    }

    // Filter channels by permissions
    const accessibleChannels = await getAccessibleChannels(currentMember.id, server.id);
    
    const textChannels = accessibleChannels.filter((channel) => channel.type === ChannelType.TEXT);
    const audioChannels = accessibleChannels.filter((channel) => channel.type === ChannelType.AUDIO);
    const videoChannels = accessibleChannels.filter((channel) => channel.type === ChannelType.VIDEO);
    const whiteboardChannels = accessibleChannels.filter((channel) => channel.type === ChannelType.WHITEBOARD);

    const members = server?.members.filter((member: Member & { profile: Profile }) => member.profileId !== profile.id);
    
    const role = currentMember.role;

    return (
        <div className="flex flex-col h-full text-primary w-full dark:bg-[#2B2D31] bg-[#F2F3F5]">
            <ServerHeader
                server={server}
                role={role}
            />
            <ScrollArea className="flex-1 px-3">
                <div className="mt-2">
                    <ServerSearch 
                        data={[
                            {
                                label: "Text Channels",
                                type: "channel",
                                data: textChannels?.map((channel) => ({
                                    id: channel.id,
                                    name: channel.name,
                                    icon: iconMap[channel.type] 
                                }))
                            },
                            {
                                label: "Voice Channels",
                                type: "channel",
                                data: audioChannels?.map((channel) => ({
                                    id: channel.id,
                                    name: channel.name,
                                    icon: iconMap[channel.type] 
                                }))
                            },
                            {
                                label: "Video Channels",
                                type: "channel",
                                data: videoChannels?.map((channel) => ({
                                    id: channel.id,
                                    name: channel.name,
                                    icon: iconMap[channel.type] 
                                }))
                            },
                            {
                                label: "Whiteboard Channels",
                                type: "channel",
                                data: whiteboardChannels?.map((channel) => ({
                                    id: channel.id,
                                    name: channel.name,
                                    icon: iconMap[channel.type] 
                                }))
                            },
                            {
                                label: "Members",
                                type: "member",
                                data: members?.map((member) => ({
                                    id: member.id,
                                    name: member.profile.name,
                                    icon: roleIconMap[member.role]
                                }))
                            }
                            ]}
                        />
                </div>
                <Separator className="bg-zinc-200 dark:bg-zinc-700 rounded-md my-2" />
                {!!textChannels?.length && (
                    <div className="mb-2">
                        <ServerSection 
                            sectionType="channels"
                            channelType={ChannelType.TEXT}
                            role={role}
                            label="Text Channels"
                            server={server}
                        />
                        <div className="space-y-[2px]">
                            {textChannels.map((channel) => (
                                <ServerChannel 
                                    key={channel.id}
                                    channel={channel}
                                    role={role}
                                    server={server}
                                />
                            ))}
                        </div>
                    </div>
                )}
                {!!audioChannels?.length && (
                    <div className="mb-2">
                        <ServerSection 
                            sectionType="channels"
                            channelType={ChannelType.AUDIO}
                            role={role}
                            label="Voice Channels"
                            server={server}
                        />
                        <div className="space-y-[2px]">
                            {audioChannels.map((channel) => (
                                <ServerChannel 
                                    key={channel.id}
                                    channel={channel}
                                    role={role}
                                    server={server}
                                />
                        ))}
                        </div>
                    </div>
                )}
                {!!videoChannels?.length && (
                    <div className="mb-2">
                        <ServerSection 
                            sectionType="channels"
                            channelType={ChannelType.VIDEO}
                            role={role}
                            label="Video Channels"
                            server={server}
                        />
                        <div className="space-y-[2px]">
                        {videoChannels.map((channel) => (            
                            <ServerChannel 
                                key={channel.id}
                                channel={channel}
                                role={role}
                                server={server}
                            />
                        ))}
                        </div>
                    </div>
                )}
                {!!whiteboardChannels?.length && (
                    <div className="mb-2">
                        <ServerSection 
                            sectionType="channels"
                            channelType={ChannelType.WHITEBOARD}
                            role={role}
                            label="Whiteboard Channels"
                            server={server}
                        />
                        <div className="space-y-[2px]">
                            {whiteboardChannels.map((channel) => (
                                <ServerChannel 
                                    key={channel.id}
                                    channel={channel}
                                    role={role}
                                    server={server}
                                />
                            ))}
                        </div>
                    </div>
                )}
                {!!members?.length && (
                    <div className="mb-2">
                        <ServerSection 
                            sectionType="members"
                            role={role}
                            label="Members"
                            server={server}
                        />
                        <div className="space-y-[2px]">
                            {members.map((member) => (
                                <ServerMember
                                    key={member.id}
                                    member={member}
                                    server={server}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </ScrollArea>
        </div>
     );
}
 