"use client";

import { cn } from "@/lib/utils";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { UserAvatar } from "../user-avatar";

type MemberRole = "ADMIN" | "MODERATOR" | "GUEST";

interface ServerMemberData {
    id: string;
    role: MemberRole;
    profile: {
        imageUrl: string;
        name: string;
    } | null;
}

interface ServerData {
    id: string;
}

interface ServerMemberProps {
    member: ServerMemberData;
    server: ServerData;
}

const IconMap= {
    GUEST: null,
    MODERATOR: <ShieldCheck className="mr-2 h-4 ml-2 text-indigo-500" />,
    ADMIN: <ShieldAlert className="mr-2 h-4 ml-2 text-rose-500" />,
}
export const ServerMember = ({
    member,
    server,
}: ServerMemberProps) => {

    const params = useParams();
    const router = useRouter();

    const icon = IconMap[member.role];
    const onClick = () => {
        router.push(`/servers/${server.id}/conversations/${member.id}`);
    };
    return (
        <button
            onClick={onClick}
            className={cn(
                "group px-2 py-2 rounded-md flex items-center gap-x-2 w-full hover:bg-zinc-700/10 dark:bg-zinc-700/50 transition mb-1",
                params?.memberId === member.id && "bg-zinc-700/20 dark:bg-zinc-700"
            )}
        >
            <UserAvatar 
                src={member.profile?.imageUrl} 
                className="h-8 w-8 md:h-8 md:w-8"
            />
            <p
                className={cn(
                    "font-semibold text-sm text-zinc-500 group-hover:text-zinc-600 dark:text-zinc-400 dark:group-hover:text-zinc-300 transition",
                    params?.memberId === member.id && "text-primary dark:text-zinc-200 dark:group-hover:text-white" 
                )}
            >
                {member.profile?.name || "Unknown User"}
            </p>
           {icon} 
        </button>
            
    )
}