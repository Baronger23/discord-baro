"use client";
import { Hash, Mic, Video, Trash, Edit, Lock, Settings } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { ActionTooltip } from "../ui/action-tooltip";
import { useModal } from "@/hooks/use-modal-store";
import { CHANNEL_TYPE, type ChannelType, MEMBER_ROLE, type MemberRole } from "@/lib/client-prisma";
import type { Channel, Server } from "@prisma/client";

interface ServerChannelProps {
    channel: Channel;
    server: Server;
    role?: MemberRole;
}

const iconMap: Partial<Record<ChannelType, LucideIcon>> = {
    [CHANNEL_TYPE.TEXT]: Hash,
    [CHANNEL_TYPE.AUDIO]: Mic,
    [CHANNEL_TYPE.VIDEO]: Video,
}

export const ServerChannel = ({
    channel,
    server,
    role,
}: ServerChannelProps) => {
    const { onOpen} = useModal();
    const params = useParams();
    const router = useRouter();

    const Icon = iconMap[channel.type] ?? Hash;
    
    const onClick = () => {
        router.push(`/servers/${server.id}/channels/${channel.id}`);
    };
    return (
        <button
            onClick={onClick}
            className= {cn(
                "group px-2 py-2 rounded-md flex items-center gap-x-2 w-full hover:bg-zinc-700/10 dark:bg-zinc-700/50 transition mb-1",
                params?.channelId === channel.id && "bg-zinc-700/20 dark:bg-zinc-700"
            )}
        >
            <Icon className="flex-shrink-0 w-5 h-5 text-zinc-500 dark:text-zinc-400" />
            <p 
                className={cn(
                    "line-clamp-1 font-semibold text-sm text-zinc-500 group-hover:text-zinc-600 dark:text-zinc-400 dark:group-hover:text-zinc-300 transition",
                    params?.channelId === channel.id && "text-primary dark:text-zinc-200 dark:group-hover:text-white"
                )}
            >
                {channel.name}
            </p>
            {channel.isPrivate && (
                <ActionTooltip label="Private Channel">
                    <Lock className="flex-shrink-0 w-3 h-3 text-zinc-500 dark:text-zinc-400" />
                </ActionTooltip>
            )}
            {/* TODO: Thêm badge số unread messages */}
            {/* <span className="ml-auto mr-2 bg-red-500 text-white text-xs rounded-full px-2 py-0.5">3</span> */}
            {channel.name !== "general" && role !== MEMBER_ROLE.GUEST && (
                <div className="ml-auto flex items-center gap-x-2">
                    {role === MEMBER_ROLE.ADMIN && (
                        <ActionTooltip label="Manage Permissions">
                            <Settings 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onOpen("manageChannelPermissions", { server, channel });
                                }}
                                className="hidden group-hover:block w-4 h-4 text-zinc-500 hover:text-zinc-600 dark:text-zinc-400 dark:hover:text-zinc-300 transition"
                            />
                        </ActionTooltip>
                    )}
                    <ActionTooltip label="Edit">
                        <Edit 
                            onClick={(e) => {
                                e.stopPropagation();
                                onOpen("editChannel", { server, channel });
                            }}
                            className="hidden group-hover:block w-4 h-4 text-zinc-500 hover:text-zinc-600 dark:text-zinc-400 dark:hover:text-zinc-300 transition"
                        />
                    </ActionTooltip>
                    <ActionTooltip label="Delete">
                        <Trash 
                            onClick={(e) => {
                                e.stopPropagation();
                                onOpen("deleteChannel", { server, channel });
                            }}
                            className="hidden group-hover:block w-4 h-4 text-zinc-500 hover:text-zinc-600 dark:text-zinc-400 dark:hover:text-zinc-300 transition"
                        />
                    </ActionTooltip>
                </div>
            )}
            {channel.name === "general" && (
                <Lock
                    className= "ml-auto w-4 h-4 text-zinc-500 dark:text-zinc-400"
                />
            )}
        </button>
    )
}
