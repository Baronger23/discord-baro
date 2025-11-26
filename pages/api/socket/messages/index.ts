import { currentProfilePages } from '@/lib/current-profile-pages';
import { db } from '@/lib/db';
import type { NextApiRequest } from 'next';
import type { NextApiResponseServerIo } from '@/type';
import { emitChannelMessage } from '@/lib/socket/server';
import { MemberRole } from '@prisma/client';
import { canSendMessages, canManageMessages } from '@/lib/channel-permissions';

export default async function handler (
    req: NextApiRequest,
    res: NextApiResponseServerIo
) {
    if (req.method !== "POST" && req.method !== "DELETE" && req.method !== "PATCH")
    {
        return res.status(405).json ({error: "Method not allowed "});
    }
    try {
        const profile = await currentProfilePages(req);

        if (!profile) {
            return res.status(401).json({ error : "Unauthorized" });
        }

        // POST: Create new message
        if (req.method === "POST") {
            const { content, fileUrl } = req.body;
            const { serverId, channelId } = req.body;

            if (!serverId) {
                return res.status(400).json({ error : "Server ID is missing" });
            }
            if (!channelId) {
                return res.status(401).json({ error : "Channel ID is missing" });
            }
            if (!content) {
                return res.status(401).json({ error : "Content is missing" });
            }

            const server = await db.server.findFirst({
                where :{
                    id : serverId as string,
                    members: {
                        some : {
                            profileId: profile.id
                        }
                    }
                },
                include : {
                    members: true
                }
            });

            if (!server) {
                return res.status(404).json({ error : "Server not found" });
            }

            const channel = await db.channel.findFirst({
                where: {
                    id: channelId as string,
                    serverId: server.id
                }
            });
            if (!channel) {
                return res.status(404).json({ error : "Channel not found" });
            }
            const member = server.members.find((member) => member.profileId === profile.id);

            if (!member) {
                return res.status(403).json({ error : "You are not a member of this server" });
            }

            // Check if member can send messages in this channel
            const hasPermission = await canSendMessages(member.id, channel.id);
            if (!hasPermission) {
                return res.status(403).json({ error: "You don't have permission to send messages in this channel" });
            }

            const message = await db.message.create({
                data: {
                    content,
                    fileUrl,
                    channelId: channel.id,
                    memberId: member.id,
                },
                include: {
                    member: {
                        include: {
                            profile: true
                        }
                    },
                    channel: true,
                }
            });

            const io = res?.socket?.server?.io;
            if (io) {
                // Emit message to channel
                io.to(`channel:${channel.id}`).emit("chat:message", {
                    channelId: channel.id,
                    message
                });

                // Emit notification to users in channel, except sender
                const room = io.sockets.adapter.rooms.get(`channel:${channel.id}`);
                
                if (room) {
                    for (const socketId of room) {
                        const socket = io.sockets.sockets.get(socketId);
                        
                        // Only emit if socket is NOT the sender
                        if (socket && socket.data.profileId !== member.profileId) {
                            socket.emit("notification:new", {
                                serverId: member.serverId,
                                channelId: channel.id,
                                messageId: message.id,
                                preview: content.slice(0, 120),
                                senderName: message.member.profile.name,
                            });
                        }
                    }
                }
            }

            return res.status(200).json(message);
        }

        // DELETE or PATCH: Edit/Delete message
        if (req.method === "DELETE" || req.method === "PATCH") {
            const { messageId, serverId, channelId } = req.query;

            if (!serverId) {
                return res.status(400).json({ error: "Server ID missing" });
            }

            if (!channelId) {
                return res.status(400).json({ error: "Channel ID missing" });
            }

            if (!messageId) {
                return res.status(400).json({ error: "Message ID missing" });
            }

            // Find server and verify membership
            const server = await db.server.findFirst({
                where: {
                    id: serverId as string,
                    members: {
                        some: {
                            profileId: profile.id
                        }
                    }
                },
                include: {
                    members: true
                }
            });

            if (!server) {
                return res.status(404).json({ error: "Server not found" });
            }

            // Find channel
            const channel = await db.channel.findFirst({
                where: {
                    id: channelId as string,
                    serverId: serverId as string
                }
            });

            if (!channel) {
                return res.status(404).json({ error: "Channel not found" });
            }

            // Find member
            const member = server.members.find((member) => member.profileId === profile.id);

            if (!member) {
                return res.status(404).json({ error: "Member not found" });
            }

            // Find message
            let message = await db.message.findFirst({
                where: {
                    id: messageId as string,
                    channelId: channelId as string
                },
                include: {
                    member: {
                        include: {
                            profile: true
                        }
                    },
                    channel: true
                }
            });

            if (!message || message.deleted) {
                return res.status(404).json({ error: "Message not found" });
            }

            // Check permissions
            const isMessageOwner = message.memberId === member.id;
            const isAdmin = member.role === MemberRole.ADMIN;
            const isModerator = member.role === MemberRole.MODERATOR;
            
            // For DELETE/EDIT: Check manage messages permission
            const hasManagePermission = await canManageMessages(member.id, channel.id);
            const canModify = isMessageOwner || hasManagePermission;

            if (!canModify) {
                return res.status(401).json({ error: "Unauthorized" });
            }

            // DELETE: Mark message as deleted (soft delete)
            if (req.method === "DELETE") {
                message = await db.message.update({
                    where: {
                        id: messageId as string
                    },
                    data: {
                        fileUrl: null,
                        content: "This message has been deleted.",
                        deleted: true
                    },
                    include: {
                        member: {
                            include: {
                                profile: true
                            }
                        },
                        channel: true
                    }
                });

                // Emit update to all clients
                emitChannelMessage(channel.id, message);

                return res.status(200).json(message);
            }

            // PATCH: Edit message (only owner can edit)
            if (req.method === "PATCH") {
                if (!isMessageOwner) {
                    return res.status(401).json({ error: "Only message owner can edit" });
                }

                const { content } = req.body;

                if (!content) {
                    return res.status(400).json({ error: "Content missing" });
                }

                message = await db.message.update({
                    where: {
                        id: messageId as string
                    },
                    data: {
                        content
                    },
                    include: {
                        member: {
                            include: {
                                profile: true
                            }
                        },
                        channel: true
                    }
                });

                // Emit update to all clients
                emitChannelMessage(channel.id, message);

                return res.status(200).json(message);
            }
        }
    }
    catch( error ) {
        console.log("[MESSAGES_POST]", error);
        return res.status(500).json({ message : "Interal Error" });
    }
}