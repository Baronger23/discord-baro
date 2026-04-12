"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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

type IncomingRequestItem = {
  id: string;
  senderProfile: {
    id: string;
    name: string;
    imageUrl: string;
    email: string;
  };
};

type SearchResultItem = {
  id: string;
  name: string;
  imageUrl: string;
  email: string;
  state: "NONE" | "PENDING_SENT" | "PENDING_RECEIVED" | "FRIEND";
};

interface FriendsHomeProps {
  activeTab: string;
  friends: FriendItem[];
  incomingRequests: IncomingRequestItem[];
}

export const FriendsHome = ({
  activeTab,
  friends,
  incomingRequests,
}: FriendsHomeProps) => {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [results, setResults] = useState<SearchResultItem[]>([]);

  const friendRoutes = useMemo(() => {
    return friends.filter((f) => !!f.dmServerId && !!f.friendMemberId);
  }, [friends]);

  const runSearch = async () => {
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      return;
    }

    try {
      setSearching(true);
      const response = await fetch(`/api/friends/search?q=${encodeURIComponent(term)}`);
      if (!response.ok) {
        throw new Error("Thất bại khi tìm kiếm người dùng");
      }

      const data = (await response.json()) as SearchResultItem[];
      setResults(data);
    } catch (error) {
      toast.error("Không tìm được người dùng phù hợp");
    } finally {
      setSearching(false);
    }
  };

  const sendFriendRequest = async (receiverProfileId: string) => {
    try {
      setSendingTo(receiverProfileId);
      const response = await fetch("/api/friends/requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ receiverProfileId }),
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Cannot send request");
      }

      toast.success("Đã gửi lời mời kết bạn");
      await runSearch();
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gửi lời mời thất bại");
    } finally {
      setSendingTo(null);
    }
  };

  const acceptRequest = async (requestId: string) => {
    try {
      setAcceptingId(requestId);
      const response = await fetch(`/api/friends/requests/${requestId}/accept`, {
        method: "POST",
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Cannot accept request");
      }

      const data = (await response.json()) as {
        dmServerId: string;
        friendMemberId: string | null;
      };

      toast.success("Đã chấp nhận lời mời kết bạn");

      if (data.dmServerId && data.friendMemberId) {
        router.push(`/servers/${data.dmServerId}/conversations/${data.friendMemberId}`);
        return;
      }

      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Chấp nhận thất bại");
    } finally {
      setAcceptingId(null);
    }
  };

  if (activeTab === "requests") {
    return (
      <div className="p-6 space-y-4">
        <h2 className="text-xl font-bold">Lời mời kết bạn</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Danh sách lời mời kết bạn đã nhận.</p>

        <div className="space-y-2">
          {incomingRequests.map((request) => (
            <div
              key={request.id}
              className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3 flex items-center gap-3"
            >
              <UserAvatar src={request.senderProfile.imageUrl} className="h-10 w-10 md:h-10 md:w-10" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{request.senderProfile.name}</p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 truncate">{request.senderProfile.email}</p>
              </div>
              <Button
                onClick={() => acceptRequest(request.id)}
                disabled={acceptingId === request.id}
              >
                {acceptingId === request.id ? "Đang xử lý..." : "Chấp nhận"}
              </Button>
            </div>
          ))}

          {!incomingRequests.length && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Bạn không có lời mời nào.</p>
          )}
        </div>
      </div>
    );
  }

  if (activeTab === "dm") {
    return (
      <div className="p-6 space-y-4">
        <h2 className="text-xl font-bold">Tin nhắn trực tiếp</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Chọn một người bạn bên trái để bắt đầu trò chuyện.</p>

        <div className="grid gap-2">
          {friendRoutes.map((friend) => (
            <Link
              key={friend.friendProfileId}
              href={`/servers/${friend.dmServerId}/conversations/${friend.friendMemberId}`}
              className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3 flex items-center gap-3 hover:bg-zinc-100/60 dark:hover:bg-zinc-900/50 transition"
            >
              <UserAvatar src={friend.imageUrl} className="h-10 w-10 md:h-10 md:w-10" />
              <div>
                <p className="font-semibold">{friend.name}</p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">{friend.email}</p>
              </div>
            </Link>
          ))}

          {!friendRoutes.length && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Bạn chưa có cuộc trò chuyện nào.</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <h2 className="text-xl font-bold">Thêm bạn</h2>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">Tìm người dùng theo tên hoặc email và gửi lời mời kết bạn.</p>

      <div className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Nhập tên hoặc email..."
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              runSearch();
            }
          }}
        />
        <Button onClick={runSearch} disabled={searching}>
          {searching ? "Dang tim..." : "Tim"}
        </Button>
      </div>

      <div className="space-y-2">
        {results.map((user) => {
          const canSend = user.state === "NONE";

          return (
            <div
              key={user.id}
              className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3 flex items-center gap-3"
            >
              <UserAvatar src={user.imageUrl} className="h-10 w-10 md:h-10 md:w-10" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{user.name}</p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 truncate">{user.email}</p>
              </div>
              <Button
                variant={canSend ? "default" : "secondary"}
                disabled={!canSend || sendingTo === user.id}
                onClick={() => sendFriendRequest(user.id)}
              >
                {user.state === "FRIEND"
                  ? "Da la ban"
                  : user.state === "PENDING_SENT"
                  ? "Da gui"
                  : user.state === "PENDING_RECEIVED"
                  ? "Da gui cho ban"
                  : sendingTo === user.id
                  ? "Dang gui..."
                  : "Gui ket ban"}
              </Button>
            </div>
          );
        })}

        {!results.length && query.trim().length >= 2 && !searching && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Khong tim thay nguoi dung phu hop.</p>
        )}
      </div>
    </div>
  );
};
