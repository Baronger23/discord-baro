"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { MessageCircle, Search, UserPlus, Inbox } from "lucide-react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/user-avatar";

type FriendItem = {
  friendshipId: string;
  friendProfileId: string;
  name: string;
  imageUrl: string;
  email: string;
  dmServerId: string | null;
  friendMemberId: string | null;
};

interface MeSidebarProps {
  friends: FriendItem[];
  incomingCount: number;
}

const tabs = [
  {
    key: "add",
    label: "Thêm bạn",
    icon: UserPlus,
  },
  {
    key: "requests",
    label: "Lời mời kết bạn",
    icon: Inbox,
  },
  {
    key: "dm",
    label: "Tin nhắn trực tiếp",
    icon: MessageCircle,
  },
] as const;

export const MeSidebar = ({ friends, incomingCount }: MeSidebarProps) => {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [dmFilter, setDmFilter] = useState("");

  const activeTab = searchParams?.get("tab") || "add";

  const filteredFriends = useMemo(() => {
    const term = dmFilter.trim().toLowerCase();
    if (!term) {
      return friends;
    }

    return friends.filter((friend) => {
      return (
        friend.name.toLowerCase().includes(term) ||
        friend.email.toLowerCase().includes(term)
      );
    });
  }, [friends, dmFilter]);

  return (
    <div className="flex flex-col h-full text-primary w-full dark:bg-[#1E1F22] bg-[#F2F3F5]">
      <div className="px-3 py-3 border-b border-neutral-200 dark:border-neutral-800">
        <div className="relative">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <Input
            value={dmFilter}
            onChange={(e) => setDmFilter(e.target.value)}
            placeholder="Tim cuoc tro chuyen..."
            className="pl-9 bg-zinc-200/70 dark:bg-zinc-800 border-0"
          />
        </div>
      </div>

      <div className="px-2 py-2 space-y-1 border-b border-neutral-200 dark:border-neutral-800">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const href = `${pathname}?tab=${tab.key}`;
          const isActive = activeTab === tab.key;

          return (
            <Link
              key={tab.key}
              href={href}
              className={cn(
                "flex items-center px-3 py-2 rounded-md text-sm font-medium transition hover:bg-zinc-700/10 dark:hover:bg-zinc-700/50",
                isActive
                  ? "bg-zinc-700/20 text-zinc-900 dark:text-zinc-100"
                  : "text-zinc-600 dark:text-zinc-300"
              )}
            >
              <Icon className="h-4 w-4 mr-2" />
              <span>{tab.label}</span>
              {tab.key === "requests" && incomingCount > 0 && (
                <span className="ml-auto text-xs bg-rose-500 text-white px-2 py-[1px] rounded-full">
                  {incomingCount}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      <div className="px-3 pt-3 pb-2 text-xs uppercase tracking-wide font-semibold text-zinc-500 dark:text-zinc-400">
        Tin nhắn trực tiếp
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-1">
        {filteredFriends.map((friend) => {
          if (!friend.dmServerId || !friend.friendMemberId) {
            return null;
          }

          return (
            <Link
              key={friend.friendProfileId}
              href={`/servers/${friend.dmServerId}/conversations/${friend.friendMemberId}`}
              className="group px-2 py-2 rounded-md flex items-center gap-x-2 w-full hover:bg-zinc-700/10 dark:hover:bg-zinc-700/50 transition"
            >
              <UserAvatar src={friend.imageUrl} className="h-8 w-8 md:h-8 md:w-8" />
              <div className="min-w-0">
                <p className="font-semibold text-sm text-zinc-600 dark:text-zinc-300 truncate">
                  {friend.name}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{friend.email}</p>
              </div>
            </Link>
          );
        })}

        {!filteredFriends.length && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400 px-2 py-3">Không tìm thấy bạn bè.</p>
        )}
      </div>
    </div>
  );
};
