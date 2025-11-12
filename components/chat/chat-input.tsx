"use client"
import { useForm } from "react-hook-form";
import * as z from "zod";
import axios from "axios";
import { zodResolver } from "@hookform/resolvers/zod";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Plus, ShieldAlert } from "lucide-react";
import { useModal } from "@/hooks/use-modal-store";
import { EmojiPicker } from "../emoji-picker";
import { useChannelPermissions } from "@/hooks/use-channel-permissions";
import { useParams } from "next/navigation";

interface ChatInputProps {
    apiUrl: string;
    query: Record<string, any>;
    name: string;
    type: "conversation" | "channel";
}

const formSchema = z.object({
    content: z.string().min(1),

});
export const ChatInput = ({
    apiUrl,
    query,
    name,
    type
}: ChatInputProps) => {
    const { onOpen } = useModal();
    const params = useParams();
    
    // Get channel permissions if this is a channel chat
    const channelId = type === "channel" ? params?.channelId as string : undefined;
    const { canSendMessages, loading } = useChannelPermissions(channelId);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            content: "",
        }
    });
    const isLoading  = form.formState.isSubmitting;
    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        try {
            await axios.post(apiUrl, {
                ...values,
                ...query,
            });
            
            form.reset();
            
            // Keep focus on input after sending
            setTimeout(() => {
                const input = document.querySelector('input[name="content"]') as HTMLInputElement;
                input?.focus();
            }, 0);
        }
        catch(error ){
            console.error("Error sending message:", error);
        }
    }

    // Show permission denied message for channels without send permission
    if (type === "channel" && !loading && !canSendMessages) {
        return (
            <div className="p-4 border-t border-neutral-200 dark:border-neutral-800">
                <div className="flex items-center justify-center gap-x-2 p-4 bg-red-500/10 dark:bg-red-500/20 rounded-md text-red-600 dark:text-red-400">
                    <ShieldAlert className="h-5 w-5" />
                    <p className="text-sm font-medium">
                        You don't have permission to send messages in this channel
                    </p>
                </div>
            </div>
        );
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="p-3 border-t border-neutral-200 dark:border-neutral-800">
                <FormField
                    control={form.control}
                    name="content"
                    render={({ field }) => (
                        <FormItem>
                            <FormControl>
                                <div className="relative p-4 pb-6">
                                    <button
                                        type="button"
                                        onClick={() => onOpen("messageFile", { apiUrl, query})}
                                        disabled={type === "channel" && !canSendMessages}
                                        className="absolute top-7 left-8 h-[24px] w-[24px]
                                        bg-zinc-500 dark:bg-zinc-400 hover:bg-zinc-600
                                        dark:hover:bg-zinc-300 transition rounded-full p-1 flex items-center justify-center
                                        disabled:opacity-50 disabled:cursor-not-allowed"

                                    >
                                        <Plus className="text-white dark:text-[#313338]"/>
                                    </button>
                                    <Input
                                        disabled={isLoading || (type === "channel" && !canSendMessages)}
                                        className="px-14 py-6 bg-zinc-200/90 dark:bg-zinc-700/75 border-none border-0
                                        focus-visible:ring-0 focus-visible:ring-offset-0
                                        text-zinc-600 dark:text-zinc-200"
                                        placeholder={`Message ${type === "conversation" ? name : "#" + name}`}
                                        {...field}
                                    />
                                    <div className="absolute top-7 right-8">
                                        <EmojiPicker
                                            onChange={(emoji: string) => field.onChange(`${field.value}${emoji}`)}
                                        />
                                    </div>
                                </div>
                            </FormControl>
                        </FormItem>
                    )}
                />
            </form>
        </Form>
    );
}