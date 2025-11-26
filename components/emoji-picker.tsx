"use client";

import { Smile } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useTheme } from "next-themes";
import { useState } from "react";
import dynamic from "next/dynamic";
import { Theme } from "emoji-picker-react";

// Lazy load emoji picker khi user click vào button
// emoji-picker-react là thư viện nặng (~150KB)
const Picker = dynamic(
    () => import("emoji-picker-react"),
    {
        ssr: false,
        loading: () => (
            <div className="flex items-center justify-center h-[400px] w-[350px]">
                <p className="text-sm text-zinc-500">Loading emojis...</p>
            </div>
        )
    }
);

interface EmojiPickerProps {
    onChange?: (emoji: string) => void;
}

export const EmojiPicker = ({ onChange }: EmojiPickerProps) => {
    const { resolvedTheme } = useTheme();
    const [isOpen, setIsOpen] = useState(false);

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    aria-label="Pick an emoji"
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
                {/* Chỉ render Picker khi popover được mở */}
                {isOpen && (
                    <Picker
                        theme={(resolvedTheme === "dark" ? Theme.DARK : Theme.LIGHT) as Theme}
                        onEmojiClick={(emojiData) => {
                            onChange?.(emojiData.emoji);
                        }}
                    />
                )}
            </PopoverContent>
        </Popover>
    );
};
