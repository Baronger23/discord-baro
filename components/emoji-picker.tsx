"use client";

import { Smile } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useTheme } from "next-themes";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import { Theme } from "emoji-picker-react";

// ✅ LAZY LOAD: emoji-picker-react (500KB) - Only load when user opens picker
const Picker = dynamic(
    () => import("emoji-picker-react"),
    { 
        ssr: false,  // Client-only component
        loading: () => (
            <div className="flex items-center justify-center h-[350px] w-[350px]">
                <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
            </div>
        )
    }
);

interface EmojiPickerProps {
    onChange?: (emoji: string) => void;
}

export const EmojiPicker = ({ onChange }: EmojiPickerProps) => {
    const { resolvedTheme } = useTheme();

    return (
        <Popover>
            <PopoverTrigger asChild>
                <button
                    title="Select Emoji"
                    type="button"
                    className="h-[24px] w-[24px] bg-zinc-500 dark:bg-zinc-400 
                    hover:bg-zinc-600 dark:hover:bg-zinc-300 
                    transition rounded-full p-1 flex items-center justify-center"
                >
                    <Smile className="text-white dark:text-[#313338]" />
                </button>
            </PopoverTrigger>
            <PopoverContent 
                side="right" 
                sideOffset={40}
                className="bg-transparent border-none shadow-none drop-shadow-none mb-16"
            >
                <Picker
                    theme={(resolvedTheme === "dark" ? Theme.DARK : Theme.LIGHT) as Theme}
                    onEmojiClick={(emojiData) => {
                        onChange?.(emojiData.emoji);
                    }}
                />
            </PopoverContent>
        </Popover>
    );
};
