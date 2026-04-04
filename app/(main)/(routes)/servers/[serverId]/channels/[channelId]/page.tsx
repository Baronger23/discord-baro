import { redirect } from "next/navigation";
import { currentProfile } from "@/lib/current-profile";
import { db } from "@/lib/db";
import { ChatHeader } from "@/components/chat/chat-header";
import { ChatInput } from "@/components/chat/chat-input";
import { ChatMessages } from "@/components/chat/chat-messages";
import { ChannelType } from "@prisma/client";
import { MediaRoomLazy } from "@/components/media-room-lazy";
interface ChannelIdPageProps {
    params: Promise<{
        serverId: string;
        channelId: string;
    }>
}

const ChannelIdPage = async ({
    params
}: ChannelIdPageProps) => {
    const { serverId, channelId } = await params;
    const profile = await currentProfile();
    if (!profile) {
        return redirect("/sign-in");
    }
    const channel = await db.channel.findUnique({
        where: {
            id: channelId,
        },
    });
    const member = await db.member.findFirst({
        where: {
            serverId: serverId,
            profileId: profile.id,
        }
    });

    if (!channel || !member) {
        return redirect(`/`);
    }
    return ( 
        <div className="bg-white dark:bg-[#313338] flex flex-col h-full">
            <ChatHeader 
                name={channel.name}
                serverId={channel.serverId}
                type="channel"
                channelId={channel.id}
            />
            {channel.type == ChannelType.TEXT && (
               <>
                {/* <div className="flex-1"></div> */}
                <ChatMessages
                    name={channel.name}
                    member={member}
                    chatId={channel.id}
                    apiUrl="/api/messages"
                    socketUrl="/api/socket/messages"
                    socketQuery={{
                        channelId: channel.id,
                        serverId: channel.serverId,
                    }}
                    paramKey="channelId"
                    paramValue={channel.id}
                    type="channel"
                />
                <ChatInput
                    name={channel.name}
                    type="channel"
                    apiUrl="/api/socket/messages"
                    query={{
                        channelId: channel.id,
                        serverId: channel.serverId,
                    }}
                />
               </> 
            )}
            {channel.type == ChannelType.AUDIO && (
                <MediaRoomLazy
                    chatId={channel.id}
                    video={false}
                    audio={true}
                />
            )}
            {channel.type == ChannelType.VIDEO && (
                <MediaRoomLazy
                    chatId={channel.id}
                    video={true}
                    audio={true}
                />
            )}
        </div>
    );
}

export default ChannelIdPage;