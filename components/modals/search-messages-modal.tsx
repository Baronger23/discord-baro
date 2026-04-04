"use client";

import axios from "axios";
import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useModal } from "@/hooks/use-modal-store";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Search, FileIcon } from "lucide-react";
import { format } from "date-fns";

interface SearchResultItem {
  id: string;
  content: string;
  fileUrl: string | null;
  createdAt: string;
  member: {
    profile: {
      name: string;
    };
  };
}

const SEARCH_STORAGE_KEY = "message-search-keywords-v1";

type SearchStorageMap = Record<string, string>;

const getContextKey = (chatType: "channel" | "conversation", targetId: string) =>
  `${chatType}:${targetId}`;

const readSearchStorage = (): SearchStorageMap => {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(SEARCH_STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as SearchStorageMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const writeSearchStorage = (value: SearchStorageMap) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(SEARCH_STORAGE_KEY, JSON.stringify(value));
};

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const isValidDateInput = (value: string) => {
  if (!value) {
    return false;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return false;
  }

  return true;
};

export const SearchMessagesModal = () => {
  const { isOpen, onClose, type, data } = useModal();

  const isModalOpen = isOpen && type === "searchMessages";
  const { channelId, conversationId, type: chatType = "channel" } = data;

  const targetId = chatType === "channel" ? channelId : conversationId;
  const contextKey = useMemo(
    () => (targetId ? getContextKey(chatType, targetId) : null),
    [chatType, targetId]
  );

  const [searchTerm, setSearchTerm] = useState("");
  const [senderTerm, setSenderTerm] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResultItem[]>([]);

  useEffect(() => {
    if (!isModalOpen || !contextKey) {
      return;
    }

    const storage = readSearchStorage();
    setSearchTerm(storage[contextKey] || "");
  }, [isModalOpen, contextKey]);

  useEffect(() => {
    if (!isModalOpen || !contextKey) {
      return;
    }

    const storage = readSearchStorage();
    storage[contextKey] = searchTerm;
    writeSearchStorage(storage);
  }, [searchTerm, isModalOpen, contextKey]);

  useEffect(() => {
    if (!isModalOpen || !targetId) {
      setResults([]);
      return;
    }

    const trimmed = searchTerm.trim();
    const trimmedSender = senderTerm.trim();
    const hasFromDate = isValidDateInput(fromDate);
    const hasToDate = isValidDateInput(toDate);
    const hasFilter = !!(trimmed || trimmedSender || hasFromDate || hasToDate);

    if (!hasFilter) {
      setResults([]);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        setLoading(true);

        const endpoint =
          chatType === "channel"
            ? `/api/channels/${targetId}/search`
            : `/api/conversations/${targetId}/search`;

        const params: Record<string, string> = {};
        if (trimmed) {
          params.q = trimmed;
        }
        if (trimmedSender) {
          params.sender = trimmedSender;
        }
        if (hasFromDate) {
          params.from = fromDate;
        }
        if (hasToDate) {
          params.to = toDate;
        }

        const response = await axios.get<SearchResultItem[]>(endpoint, {
          params,
        });

        if (!cancelled) {
          setResults(response.data);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to search messages:", error);
          setResults([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchTerm, senderTerm, fromDate, toDate, isModalOpen, targetId, chatType]);

  const handleClose = () => {
    setResults([]);
    setLoading(false);
    onClose();
  };

  const highlightText = (text: string, keyword: string, markClassName: string) => {
    const trimmed = keyword.trim();
    if (!trimmed) {
      return text;
    }

    const regex = new RegExp(`(${escapeRegExp(trimmed)})`, "ig");
    const parts = text.split(regex);

    return parts.map((part, index) => {
      if (part.toLowerCase() === trimmed.toLowerCase()) {
        return (
          <mark key={`${part}-${index}`} className={markClassName}>
            {part}
          </mark>
        );
      }

      return <span key={`${part}-${index}`}>{part}</span>;
    });
  };

  const handleSelectMessage = (messageId: string) => {
    if (!targetId) {
      return;
    }

    window.dispatchEvent(
      new CustomEvent("chat:jump-to-message", {
        detail: {
          chatType,
          chatId: targetId,
          messageId,
        },
      })
    );

    handleClose();
  };

  return (
    <Dialog open={isModalOpen} onOpenChange={handleClose}>
      <DialogContent className="bg-white dark:bg-[#313338] text-black dark:text-white p-0 overflow-hidden max-w-2xl">
        <DialogHeader className="pt-6 px-6 pb-2">
          <DialogTitle className="text-xl font-bold flex items-center gap-x-2">
            <Search className="h-5 w-5 text-indigo-500" />
            Search Messages
          </DialogTitle>
          <DialogDescription className="text-zinc-500 dark:text-zinc-400">
            Search in this {chatType === "channel" ? "channel" : "conversation"}
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-4 space-y-3">
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Type to search message content..."
            autoFocus
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <Input
              value={senderTerm}
              onChange={(e) => setSenderTerm(e.target.value)}
              placeholder="Sender name"
            />
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              placeholder="From"
            />
            <Input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              placeholder="To"
            />
          </div>
        </div>

        <ScrollArea className="max-h-[420px] px-6 pb-6">
          {!searchTerm.trim() && !senderTerm.trim() && !fromDate && !toDate && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400 py-4">
              Enter content, sender name, or a date range to search messages.
            </p>
          )}

          {(searchTerm.trim() || senderTerm.trim() || fromDate || toDate) && loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
            </div>
          )}

          {(searchTerm.trim() || senderTerm.trim() || fromDate || toDate) && !loading && results.length === 0 && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400 py-4">
              No messages found.
            </p>
          )}

          {results.length > 0 && (
            <div className="space-y-2">
              {results.map((message) => (
                <button
                  key={message.id}
                  onClick={() => handleSelectMessage(message.id)}
                  className="w-full text-left p-3 rounded-md bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                >
                  <div className="flex items-center justify-between gap-x-2 mb-1">
                    <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 truncate">
                      {highlightText(
                        message.member.profile.name,
                        senderTerm,
                        "bg-yellow-200 dark:bg-yellow-500/30 px-0.5 rounded"
                      )}
                    </span>
                    <span className="text-[11px] text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                      {format(new Date(message.createdAt), "d MMM, yyyy HH:mm")}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-700 dark:text-zinc-200 line-clamp-2 break-words">
                    {message.content
                      ? highlightText(
                          message.content,
                          searchTerm,
                          "bg-yellow-200 dark:bg-yellow-500/30 px-0.5 rounded"
                        )
                      : (
                        <span className="inline-flex items-center gap-x-1 text-zinc-500 dark:text-zinc-400">
                          <FileIcon className="h-3.5 w-3.5" />
                          Attachment message
                        </span>
                      )}
                  </p>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
