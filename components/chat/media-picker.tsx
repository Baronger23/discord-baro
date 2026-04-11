"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Clapperboard, Sticker } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { GiphyFetch } from "@giphy/js-fetch-api";
import type { IGif } from "@giphy/js-types";

type MediaKind = "gif" | "sticker";

interface MediaItem {
  label: string;
  url: string;
}

interface MediaPickerProps {
  kind: MediaKind;
  onPick: (item: MediaItem) => void;
  disabled?: boolean;
}

const GIPHY_API_KEY = process.env.NEXT_PUBLIC_GIPHY_API_KEY || "";
const PAGE_SIZE = 24;
const MAX_RECENT_ITEMS = 20;
const RECENT_HISTORY_KEY = "media-picker-recent-history-v1";

interface RecentItem extends MediaItem {
  kind: MediaKind;
  usedAt: number;
}

const readRecentHistory = (): RecentItem[] => {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(RECENT_HISTORY_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as RecentItem[];
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((item) => !!item?.url && !!item?.kind);
  } catch {
    return [];
  }
};

const writeRecentHistory = (items: RecentItem[]) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(RECENT_HISTORY_KEY, JSON.stringify(items));
};

const getBestGifUrl = (gif: IGif) => {
  return (
    gif.images.fixed_height?.url ||
    gif.images.original?.url ||
    gif.images.downsized?.url ||
    ""
  );
};

export const MediaPicker = ({ kind, onPick, disabled = false }: MediaPickerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<MediaKind>(kind);
  const [searchValue, setSearchValue] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [items, setItems] = useState<MediaItem[]>([]);
  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const gf = useMemo(() => {
    if (!GIPHY_API_KEY) {
      return null;
    }
    return new GiphyFetch(GIPHY_API_KEY);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(kind);
      setRecentItems(readRecentHistory());
    }
  }, [isOpen, kind]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchValue.trim());
    }, 250);

    return () => clearTimeout(timer);
  }, [searchValue]);

  const mapGifToMediaItem = useCallback((gif: IGif): MediaItem | null => {
    const url = getBestGifUrl(gif);
    if (!url) {
      return null;
    }

    return {
      label: gif.title || (activeTab === "gif" ? "GIF" : "Sticker"),
      url,
    };
  }, [activeTab]);

  const fetchMedia = useCallback(async (nextOffset: number, replace: boolean) => {
    if (!gf) {
      return;
    }

    const currentRequestId = ++requestIdRef.current;
    const type = activeTab === "gif" ? "gifs" : "stickers";

    if (replace) {
      setItems([]);
      setHasMore(true);
    }

    setLoading(true);
    setError(null);

    try {
      const response = debouncedSearch
        ? await gf.search(debouncedSearch, {
            offset: nextOffset,
            limit: PAGE_SIZE,
            type,
            rating: "pg-13",
          })
        : await gf.trending({
            offset: nextOffset,
            limit: PAGE_SIZE,
            type,
            rating: "pg-13",
          });

      if (currentRequestId !== requestIdRef.current) {
        return;
      }

      const mapped = response.data
        .map((gif) => mapGifToMediaItem(gif))
        .filter((item): item is MediaItem => !!item);

      setItems((prev) => {
        const merged = replace ? mapped : [...prev, ...mapped];
        const seen = new Set<string>();
        return merged.filter((item) => {
          if (seen.has(item.url)) {
            return false;
          }
          seen.add(item.url);
          return true;
        });
      });

      const next = nextOffset + response.data.length;
      setOffset(next);
      setHasMore(next < response.pagination.total_count && response.data.length > 0);
    } catch (err) {
      console.error("Failed to load GIPHY media:", err);
      if (currentRequestId !== requestIdRef.current) {
        return;
      }
      setError("Unable to load media. Please try again.");
      if (replace) {
        setItems([]);
      }
    } finally {
      if (currentRequestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [gf, activeTab, debouncedSearch, mapGifToMediaItem]);

  useEffect(() => {
    if (!isOpen || !gf) {
      return;
    }

    void fetchMedia(0, true);
  }, [isOpen, gf, activeTab, debouncedSearch, fetchMedia]);

  const handlePick = useCallback((item: MediaItem) => {
    const nextRecent = [
      {
        ...item,
        kind: activeTab,
        usedAt: Date.now(),
      },
      ...recentItems.filter((recent) => !(recent.kind === activeTab && recent.url === item.url)),
    ].slice(0, MAX_RECENT_ITEMS);

    setRecentItems(nextRecent);
    writeRecentHistory(nextRecent);
    onPick(item);
    setIsOpen(false);
  }, [activeTab, onPick, recentItems]);

  const filteredRecentItems = useMemo(
    () => recentItems.filter((item) => item.kind === activeTab).slice(0, 8),
    [recentItems, activeTab]
  );

  const title = activeTab === "gif" ? "GIF" : "Sticker";

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          title={kind === "gif" ? "Add GIF" : "Add Sticker"}
          aria-label={kind === "gif" ? "Add GIF" : "Add Sticker"}
          className="h-[24px] w-[24px] bg-zinc-500 dark:bg-zinc-400 hover:bg-zinc-600 dark:hover:bg-zinc-300 transition rounded-full p-1 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {kind === "gif" ? (
            <Clapperboard className="text-white dark:text-[#313338]" size={14} />
          ) : (
            <Sticker className="text-white dark:text-[#313338]" size={14} />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="end"
        sideOffset={10}
        className="w-[360px] p-3 bg-white dark:bg-[#2b2d31] border-zinc-200 dark:border-zinc-700"
      >
        <div className="flex items-center justify-between gap-2 mb-2">
          <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
            {debouncedSearch ? `Search ${title}` : `Trending ${title}`}
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveTab("gif")}
              className={`px-2 py-1 text-xs rounded ${
                activeTab === "gif"
                  ? "bg-blue-500 text-white"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300"
              }`}
            >
              GIF
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("sticker")}
              className={`px-2 py-1 text-xs rounded ${
                activeTab === "sticker"
                  ? "bg-blue-500 text-white"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300"
              }`}
            >
              Sticker
            </button>
          </div>
        </div>

        {!gf && (
          <div className="text-xs text-red-500 p-2 rounded bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900">
            Missing NEXT_PUBLIC_GIPHY_API_KEY in environment.
          </div>
        )}

        {gf && (
          <>
            <Input
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder={`Search ${title.toLowerCase()}...`}
              className="mb-3 h-8"
            />

            {filteredRecentItems.length > 0 && (
              <div className="mb-3">
                <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mb-2">
                  Recent
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {filteredRecentItems.map((item) => (
                    <button
                      key={`${item.kind}-${item.url}`}
                      type="button"
                      onClick={() => handlePick(item)}
                      className="h-14 w-14 rounded-md overflow-hidden border border-zinc-200 dark:border-zinc-700 hover:border-blue-500 dark:hover:border-blue-400 transition"
                      title={item.label}
                    >
                      <img src={item.url} alt={item.label} className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="h-[320px] overflow-y-auto rounded-md border border-zinc-200 dark:border-zinc-700 p-2">
              {loading && items.length === 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {Array.from({ length: 9 }).map((_, index) => (
                    <div
                      key={index}
                      className="h-24 rounded-md bg-zinc-200 dark:bg-zinc-800 animate-pulse"
                    />
                  ))}
                </div>
              )}

              {!loading && !error && items.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center px-4">
                  <div className="h-10 w-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-3">
                    {activeTab === "gif" ? (
                      <Clapperboard className="h-5 w-5 text-zinc-500 dark:text-zinc-400" />
                    ) : (
                      <Sticker className="h-5 w-5 text-zinc-500 dark:text-zinc-400" />
                    )}
                  </div>
                  <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    No {title.toLowerCase()} found
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                    Try another keyword or clear search to see trending.
                  </p>
                </div>
              )}

              {error && !loading && (
                <div className="h-full flex flex-col items-center justify-center text-center px-4">
                  <p className="text-sm font-medium text-red-500">{error}</p>
                  <button
                    type="button"
                    onClick={() => void fetchMedia(0, true)}
                    className="mt-3 text-xs px-3 py-1.5 rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition"
                  >
                    Retry
                  </button>
                </div>
              )}

              {items.length > 0 && (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    {items.map((item) => (
                      <button
                        key={item.url}
                        type="button"
                        onClick={() => handlePick(item)}
                        className="h-24 rounded-md overflow-hidden border border-zinc-200 dark:border-zinc-700 hover:border-blue-500 dark:hover:border-blue-400 transition"
                        title={item.label}
                      >
                        <img src={item.url} alt={item.label} className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>

                  {hasMore && (
                    <div className="flex justify-center mt-3">
                      <button
                        type="button"
                        onClick={() => void fetchMedia(offset, false)}
                        disabled={loading}
                        className="text-xs px-3 py-1.5 rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition disabled:opacity-60"
                      >
                        {loading ? "Loading..." : "Load more"}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
};
