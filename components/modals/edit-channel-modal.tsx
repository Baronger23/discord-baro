"use client";
import qs from "query-string";
import * as z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useEffect, useState } from "react";
import axios from "axios";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from "@/components/ui/dialog";

import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useParams, useRouter } from "next/navigation";
import { useModal } from "@/hooks/use-modal-store";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { CHANNEL_TYPE, CHANNEL_TYPES } from "@/lib/client-prisma";
const formSchema = z.object({
    name: z.string().min(1, { message: "Server name is required" }).max(100, { message: "Server name must be less than 100 characters" }).refine(
        name => name !== "general", 
        {
            message: "Channel name cannot be 'general'"
        }
    ),
    type: z.enum(CHANNEL_TYPES)
});

export const EditChannelModal = () => {
    const { isOpen, onClose, type, data} = useModal();
    
    const router = useRouter();
    const params = useParams();
    const { channel, server} = data;
    
    const form = useForm({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: "",
            type: channel?.type || CHANNEL_TYPE.TEXT,
        },
    });
    const isLoading = form.formState.isSubmitting;

    const isModalOpen = isOpen && type === "editChannel";

    const handleClose = () => {
        form.reset();
        onClose();
    };
    
    useEffect(() => {
        if (channel) {
            form.setValue("name", channel.name),
            form.setValue("type", channel.type);
        }
    }, [form, channel]);
    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        try {
            if (!server?.id) {
                return;
            }
            
            const url = qs.stringifyUrl({
                url: `/api/channels/${channel?.id}`,
                query: {
                    serverId: server.id,
                }
            });
            
            await axios.patch(url, values);
            
            form.reset();
            router.refresh();
            onClose();
        }
        catch (error) {
            console.error("Error editing channel:", error);
        }
    };
    return (
        <Dialog open={isModalOpen} onOpenChange={handleClose} >
            <DialogContent className="bg-white text-black p-0 overflow-hidden">
                <DialogHeader className="pt-8 px-6">
                    <DialogTitle className="text-2xl text-center">
                        Edit Channel
                    </DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                        <div className="space-y-8 px-6" >
                            <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel
                                            className="uppercase text-xs font-bold text-zinc-500 
                                            dark:text-secondary/70"
                                            >
                                            Channel Name
                                        </FormLabel>
                                        <FormControl>
                                            <Input
                                                disabled={isLoading}
                                                className="bg-zinc-300/50 border-0 focus-visible:ring-0 text-black focus-visible:ring-offset-0"
                                                placeholder="Enter channel name"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="type"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Channel Type</FormLabel>
                                        <Select
                                            disabled={isLoading}
                                            onValueChange={field.onChange}
                                            defaultValue={field.value}
                                        >
                                            <FormControl>
                                                <SelectTrigger 
                                                className="bg-zinc-300 border-0 focus:ring-0 text-black ring-offset-0
                                                focus:ring-offset-0 capitalize outline-none"
                                                >
                                                    <SelectValue placeholder="Select channel type" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {CHANNEL_TYPES.map((type) => (
                                                    <SelectItem key={type} value={type} className="capitalize">
                                                        {type.toLowerCase()}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                        <DialogFooter className="bg-gray-100 px-6 py-4">
                            <Button 
                                type="submit" 
                                disabled={isLoading} 
                                className="bg-indigo-500 hover:bg-indigo-600 text-white"
                            >
                                {isLoading ? "Saving..." : "Save"}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
};