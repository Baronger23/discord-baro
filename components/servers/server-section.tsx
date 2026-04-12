"use client";

import { ActionTooltip } from "@/components/ui/action-tooltip";
import { ServerWithMembersWithProfile } from "@/type";
import { Plus, Settings } from "lucide-react";
import { useModal } from "@/hooks/use-modal-store";
import { MEMBER_ROLE, type MemberRole, type ChannelType } from "@/lib/client-prisma";
interface ServerSectionProps {
    label: string;
    role?: MemberRole;
    sectionType?: "channels" | "members";
    channelType?: ChannelType;
    server?: ServerWithMembersWithProfile;
}

export const ServerSection = ({
    label,
    role,
    sectionType,
    channelType,
    server,
}: ServerSectionProps) => {
    const {onOpen} = useModal();

    return (
        <div className= "flex items-center justify-between py-2">
            <p className="text-xs uppercase font-semibold
            text-zinc-500 dark:text-zinc-400">
                {label}
            </p>
            {role !== MEMBER_ROLE.GUEST && sectionType == "channels" && (
                <ActionTooltip label={`Create Channel`} side="top">
                    <button
                        onClick={() => onOpen("createChannel", { channelType, server })}
                        className="text-zinc-500 hover:text-zinc-600
                        dark:text-zinc-400 dark:hover:text-zinc-300 transition"
                    >
                        <Plus className="h-4 w-4" />
                    </button>
                </ActionTooltip>
            )}
            {role === MEMBER_ROLE.ADMIN && sectionType == "members" && (
                <ActionTooltip label={`Manage Members`} side="top">
                    <button
                        onClick={() => onOpen("members", {server})}
                        className="text-zinc-500 hover:text-zinc-500
                        dark:text-zinc-400 dark:hover:text-zinc-300 transition"
                    >
                        <Settings className="h-4 w-4" />
                    </button>
                </ActionTooltip>
            )}
        </div>
    )
}