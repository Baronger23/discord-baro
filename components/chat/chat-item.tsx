"use client";

import { useState, useEffect, memo } from "react";
import { Member, MemberRole, Profile } from "@prisma/client";
import { UserAvatar } from "@/components/user-avatar";
import { ActionTooltip } from "@/components/ui/action-tooltip";
import { 
    Edit, 
    FileIcon, 
    ShieldAlert, 
    ShieldCheck, 
    Trash,
    Download,
    FileText,
    FileImage,
    FileVideo,
    FileAudio,
    Volume2,
    Play,
    Pin,
    PinOff,
    Reply,
} from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import axios from "axios";
import qs from "query-string";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem } from "@/components/ui/form";
import { useModal } from "@/hooks/use-modal-store";
import { useReplyStore } from "@/hooks/use-reply-store";


interface ChatItemProps {
    id: string;
    content: string;
    member: Member & {
        profile: Profile
    };
    timestamp: string;
    fileUrl: string | null;
    deleted: boolean;
    currentMember: Member;
    isUpdated: boolean;
    socketUrl: string;
    socketQuery: Record<string, string>;
    pinned?: boolean;
    pinnedAt?: Date | null;
    type?: "channel" | "conversation"; // To determine API endpoint
    replyTo?: {
        id: string;
        content: string;
        fileUrl?: string | null;
        deleted: boolean;
        authorName: string;
    } | null;
    onJumpToMessage?: (messageId: string) => Promise<void> | void;
}

const roleIconMap = {
    "GUEST": null,
    "MODERATOR": <ShieldCheck className="h-4 w-4 ml-2 text-indigo-500" />,
    "ADMIN": <ShieldAlert className="h-4 w-4 ml-2 text-rose-500" />
}

const formSchema = z.object({
    content: z.string().min(1)
});

const ChatItemComponent = ({
    id,
    content,
    member,
    timestamp,
    fileUrl,
    deleted,
    currentMember,
    isUpdated,
    socketUrl,
    socketQuery,
    pinned = false,
    pinnedAt = null,
    type = "channel",
    replyTo = null,
    onJumpToMessage,
}: ChatItemProps) => {
    const [isEditing, setIsEditing] = useState(false);
    const [isPinning, setIsPinning] = useState(false);
    const { onOpen } = useModal();
    const router = useRouter();
    const { setReply } = useReplyStore();
    
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            content: content
        }
    });

    useEffect(() => {
        form.reset({
            content: content
        });
    }, [content, form]);

    const onMemberClick = () => {
        if (member.id === currentMember.id) {
            return;
        }
        router.push(`/servers/${socketQuery.serverId}/conversations/${member.id}`);
    };
    
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape" || event.keyCode === 27) {
                setIsEditing(false);
            }
        };

        window.addEventListener("keydown", handleKeyDown);

        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    const isLoading = form.formState.isSubmitting;

    const getFileNameFromUrl = (url: string) => {
        try {
            const parsedUrl = new URL(url);
            return decodeURIComponent(parsedUrl.pathname.split('/').filter(Boolean).pop() || 'file');
        } catch {
            return decodeURIComponent(url.split('/').filter(Boolean).pop() || 'file');
        }
    };

    const fileName = fileUrl ? getFileNameFromUrl(fileUrl) : 'file';
    const fileType = fileName.includes('.')
        ? fileName.split('.').pop()?.toLowerCase()
        : undefined;

    const isAdmin = currentMember.role === MemberRole.ADMIN;
    const isModerator = currentMember.role === MemberRole.MODERATOR;
    const isOwner = currentMember.id === member.id;
    const canDeleteMessage = !deleted && (isAdmin || isModerator || isOwner);
    const canEditMessage = !deleted && isOwner && !fileUrl;
    const canPinMessage = !deleted && (isAdmin || isModerator); // Only ADMIN/MODERATOR can pin
    const canReply = !deleted;

    // File type checks
    const isImage = fileType && ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'].includes(fileType);
    const isVideo = fileType && ['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(fileType);
    const isAudio = fileType && ['mp3', 'wav', 'ogg', 'flac', 'm4a'].includes(fileType);
    const isPDF = fileType === 'pdf';
    const isDocument = fileType && ['doc', 'docx', 'txt', 'rtf'].includes(fileType);


    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        try {
            const url = qs.stringifyUrl({
                url: socketUrl,
                query: {
                    ...socketQuery,
                    messageId: id, // Gửi qua query params
                },
            });

            await axios.patch(url, values);
            
            form.reset();
            setIsEditing(false);
        } catch (error) {
            console.error(error);
        }
    };

    const handlePinToggle = async (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        
        try {
            setIsPinning(true);
            
            // Use different API endpoint based on type
            const pinEndpoint = type === "conversation" 
                ? `/api/direct-messages/${id}/pin`
                : `/api/messages/${id}/pin`;
            
            if (pinned) {
                await axios.delete(pinEndpoint);
            } else {
                await axios.post(pinEndpoint);
            }
            router.refresh();
        } catch (error) {
            console.error("Failed to toggle pin:", error);
        } finally {
            setIsPinning(false);
        }
    };

    const getFileIcon = () => {
        if (isImage) return <FileImage className="h-10 w-10 text-blue-500" />;
        if (isVideo) return <FileVideo className="h-10 w-10 text-purple-500" />;
        if (isAudio) return <FileAudio className="h-10 w-10 text-green-500" />;
        if (isPDF) return <FileText className="h-10 w-10 text-red-500" />;
        if (isDocument) return <FileText className="h-10 w-10 text-blue-600" />;
        return <FileIcon className="h-10 w-10 text-zinc-500" />;
    };

    const formatFileSize = (url: string) => {
        // This is a placeholder - ideally you'd store file size in database
        return "File";
    };

    const onReply = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();

        const contextId = type === "channel"
            ? String(socketQuery.channelId || "")
            : String(socketQuery.conversationId || "");

        if (!contextId) {
            return;
        }

        setReply({
            id,
            content,
            fileUrl,
            memberName: member.profile.name,
            type,
            contextId,
        });
    };

    const jumpToRepliedMessage = async () => {
        if (!replyTo) {
            return;
        }

        if (onJumpToMessage) {
            await onJumpToMessage(replyTo.id);
            return;
        }

        const target = document.getElementById(`message-${replyTo.id}`);
        target?.scrollIntoView({ behavior: "smooth", block: "center" });
    };

    return (
        <div 
            id={`message-${id}`}
            className="relative group flex items-start hover:bg-black/5 dark:hover:bg-zinc-700/10 p-4 transition w-full"
        >
            {/* Avatar */}
            <div 
                onClick={onMemberClick}
                className="cursor-pointer hover:drop-shadow-md transition"
            >
                <UserAvatar src={member.profile.imageUrl} className="h-10 w-10" />
            </div>

            {/* Content */}
            <div className="flex flex-col w-full ml-4">
                {/* Header: Name, Role, Timestamp */}
                <div className="flex items-center gap-x-2">
                    <div className="flex items-center">
                        <p 
                            onClick={onMemberClick}
                            className="font-semibold text-sm hover:underline cursor-pointer"
                        >
                            {member.profile.name}
                        </p>
                        <ActionTooltip label={member.role}>
                            {roleIconMap[member.role]}
                        </ActionTooltip>
                    </div>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                        {timestamp}
                    </span>
                    {isUpdated && !deleted && (
                        <span className="text-[10px] mx-2 text-zinc-500 dark:text-zinc-400">
                            (edited)
                        </span>
                    )}
                </div>

                {/* Message Content */}
                {!deleted && replyTo && (
                    <button
                        type="button"
                        onClick={jumpToRepliedMessage}
                        className="mt-2 text-left border-l-2 border-zinc-300 dark:border-zinc-600 pl-3 py-1 bg-zinc-100/70 dark:bg-zinc-800/40 rounded-r-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                    >
                        <p className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
                            Đang trả lời {replyTo.authorName}
                        </p>
                        <p className="text-xs text-zinc-600 dark:text-zinc-400 truncate max-w-[360px]">
                            {replyTo.deleted
                                ? "This message has been deleted."
                                : replyTo.content || (replyTo.fileUrl ? "Attachment" : "Message")}
                        </p>
                    </button>
                )}
                {!deleted && !isEditing && (
                    <p className={cn(
                        "text-sm text-zinc-600 dark:text-zinc-300 mt-1",
                        deleted && "italic text-zinc-500 dark:text-zinc-400 text-xs mt-1"
                    )}>
                        {content}
                    </p>
                )}

                {/* Edit Form */}
                {!deleted && isEditing && (
                    <Form {...form}>
                        <form 
                            onSubmit={form.handleSubmit(onSubmit)}
                            className="flex items-center w-full gap-x-2 pt-2"
                        >
                            <FormField
                                control={form.control}
                                name="content"
                                render={({ field }) => (
                                    <FormItem className="flex-1">
                                        <FormControl>
                                            <div className="relative w-full">
                                                <Input
                                                    disabled={isLoading}
                                                    className="p-2 bg-zinc-200/90 dark:bg-zinc-700/75 border-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-zinc-600 dark:text-zinc-200"
                                                    placeholder="Edited message"
                                                    {...field}
                                                />
                                            </div>
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                            <Button disabled={isLoading} size="sm" variant="primary">
                                Save
                            </Button>
                        </form>
                        <span className="text-[10px] mt-1 text-zinc-400">
                            Press escape to cancel, enter to save
                        </span>
                    </Form>
                )}

                {deleted && (
                    <p className="italic text-zinc-500 dark:text-zinc-400 text-xs mt-1">
                        Message has been deleted.
                    </p>
                )}

                {/* File Attachments */}
                {fileUrl && !deleted && (
                    <div className="mt-2">
                        {/* Image Preview */}
                        {isImage && (
                            <a
                                title="View Image"
                                href={fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="relative aspect-square rounded-md overflow-hidden border flex items-center bg-secondary max-w-sm group/image"
                            >
                                <Image
                                    src={fileUrl}
                                    alt={content || "Image"}
                                    width={400}
                                    height={400}
                                    className="object-cover w-full h-full hover:scale-105 transition"
                                />
                                <div className="absolute inset-0 bg-black/0 group-hover/image:bg-black/10 transition flex items-center justify-center">
                                    <Download className="h-6 w-6 text-white opacity-0 group-hover/image:opacity-100 transition" />
                                </div>
                            </a>
                        )}

                        {/* Video Preview */}
                        {isVideo && (
                            <div className="relative max-w-sm rounded-md overflow-hidden border bg-secondary">
                                <video 
                                    controls 
                                    className="w-full h-auto max-h-96"
                                    preload="metadata"
                                >
                                    <source src={fileUrl} type={`video/${fileType}`} />
                                    Your browser does not support video playback.
                                </video>
                            </div>
                        )}

                        {/* Audio Player */}
                        {isAudio && (
                            <div className="flex items-center gap-x-3 p-3 rounded-md bg-zinc-100 dark:bg-zinc-800 max-w-md border">
                                <Volume2 className="h-8 w-8 text-green-500 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                                        {fileName}
                                    </p>
                                    <audio controls className="w-full mt-2">
                                        <source src={fileUrl} type={`audio/${fileType}`} />
                                        Your browser does not support audio playback.
                                    </audio>
                                </div>
                            </div>
                        )}

                        {/* PDF Preview */}
                        {isPDF && (
                            <a
                                href={fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-x-3 p-3 rounded-md bg-red-50 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/20 transition border border-red-200 dark:border-red-900/30 max-w-md group/pdf"
                            >
                                <FileText className="h-10 w-10 text-red-500 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                                        {fileName}
                                    </p>
                                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                        PDF Document
                                    </p>
                                </div>
                                <Download className="h-5 w-5 text-red-500 opacity-0 group-hover/pdf:opacity-100 transition flex-shrink-0" />
                            </a>
                        )}

                        {/* Other Documents */}
                        {isDocument && (
                            <a
                                href={fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-x-3 p-3 rounded-md bg-blue-50 dark:bg-blue-900/10 hover:bg-blue-100 dark:hover:bg-blue-900/20 transition border border-blue-200 dark:border-blue-900/30 max-w-md group/doc"
                            >
                                <FileText className="h-10 w-10 text-blue-600 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                                        {fileName}
                                    </p>
                                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                        {fileType?.toUpperCase()} Document
                                    </p>
                                </div>
                                <Download className="h-5 w-5 text-blue-600 opacity-0 group-hover/doc:opacity-100 transition flex-shrink-0" />
                            </a>
                        )}

                        {/* Generic File (fallback) */}
                        {!isImage && !isVideo && !isAudio && !isPDF && !isDocument && (
                            <a
                                href={fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-x-3 p-3 rounded-md bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition border max-w-md group/file"
                            >
                                {getFileIcon()}
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                                        {fileName}
                                    </p>
                                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                        {fileType?.toUpperCase() || 'File'}
                                    </p>
                                </div>
                                <Download className="h-5 w-5 text-zinc-500 opacity-0 group-hover/file:opacity-100 transition flex-shrink-0" />
                            </a>
                        )}
                    </div>
                )}
            </div>

            {/* Action Buttons (Pin, Edit & Delete) */}
            {(canDeleteMessage || canPinMessage || canReply) && (
                <div className="hidden group-hover:flex items-center gap-x-2 absolute p-1 -top-2 right-5 bg-white dark:bg-zinc-800 border rounded-sm">
                    {canReply && (
                        <ActionTooltip label="Reply">
                            <Reply
                                onClick={onReply}
                                className="cursor-pointer ml-auto w-4 h-4 text-zinc-500 hover:text-blue-500 dark:hover:text-blue-400 transition"
                            />
                        </ActionTooltip>
                    )}
                    {canPinMessage && (
                        <ActionTooltip label={pinned ? "Unpin" : "Pin"}>
                            {pinned ? (
                                <PinOff
                                    onClick={(e) => {
                                        if (!isPinning) handlePinToggle(e);
                                    }}
                                    className={cn(
                                        "cursor-pointer ml-auto w-4 h-4 text-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition",
                                        isPinning && "opacity-50 cursor-not-allowed"
                                    )}
                                />
                            ) : (
                                <Pin
                                    onClick={(e) => {
                                        if (!isPinning) handlePinToggle(e);
                                    }}
                                    className={cn(
                                        "cursor-pointer ml-auto w-4 h-4 text-zinc-500 hover:text-indigo-500 dark:hover:text-indigo-400 transition",
                                        isPinning && "opacity-50 cursor-not-allowed"
                                    )}
                                />
                            )}
                        </ActionTooltip>
                    )}
                    {canEditMessage && (
                        <ActionTooltip label="Edit">
                            <Edit
                                onClick={() => setIsEditing(true)}
                                className="cursor-pointer ml-auto w-4 h-4 text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition"
                            />
                        </ActionTooltip>
                    )}
                    {canDeleteMessage && (
                        <ActionTooltip label="Delete">
                            <Trash
                                onClick={() => onOpen("deleteMessage", {
                                    apiUrl: socketUrl,
                                    query: socketQuery,
                                    messageId: id,
                                })}
                                className="cursor-pointer ml-auto w-4 h-4 text-zinc-500 hover:text-rose-500 dark:hover:text-rose-400 transition"
                            />
                        </ActionTooltip>
                    )}
                </div>
            )}
        </div>
    );
};

// Export memoized version để tối ưu performance
export const ChatItem = memo(ChatItemComponent);