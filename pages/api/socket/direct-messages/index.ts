import { currentProfilePages } from '@/lib/current-profile-pages';
import { db } from '@/lib/db';
import type { NextApiRequest } from 'next';
import type { NextApiResponseServerIo } from '@/type';
import { SOCKET_EVENTS } from '@/lib/socket/constants';

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
            const { conversationId } = req.body;

            const conversation = await db.conversation.findFirst({
                where: { id: conversationId as string,
                    OR: [
                    {
                        memberOne: {
                            profileId: profile.id
                        },
                    },
                    {
                        memberTwo: {
                            profileId: profile.id
                        },
                    }
                ]
                },
                include: {
                    memberOne: {
                        include: { profile: true }
                    },
                    memberTwo: {
                        include: { profile: true }
                    }
                }
            });
            if (!conversation) {
                return res.status(404).json({ error : "Conversation not found" });
            }
            if (!content) {
                return res.status(401).json({ error : "Content is missing" });
            }

            if (!conversationId) {
                return res.status(404).json({ error : "Conversation not found" });
            }
            const member = conversation.memberOne.profileId === profile.id ? conversation.memberOne : conversation.memberTwo;

            if (!member) {
                return res.status(404).json({ error : "Member not found" });
            }

            const message = await db.directMessage.create({
                data: {
                    content,
                    fileUrl,
                    conversationId: conversation.id,
                    memberId: member.id,
                },
                include: {
                    member: {
                        include: {
                            profile: true
                        }
                    },
                    conversation: true,
                }
            });

            // Emit to Socket.IO for real-time updates
            const conversationKey = `conversation:${conversation.id}`;
            
            const io = res?.socket?.server?.io;
            if (io) {
                // Emit message to all users in room
                io.to(conversationKey).emit(SOCKET_EVENTS.CHAT_MESSAGE, {
                    channelId: conversation.id,
                    message
                });
                
                // Emit notification chỉ cho người NHẬN (không emit cho người gửi)
                const room = io.sockets.adapter.rooms.get(conversationKey);
                if (room) {
                    for (const socketId of room) {
                        const socket = io.sockets.sockets.get(socketId);
                        // Chỉ emit notification nếu socket KHÔNG phải người gửi
                        if (socket && socket.data.profileId !== profile.id) {
                            socket.emit(SOCKET_EVENTS.NOTIFICATION, {
                                serverId: "",
                                channelId: conversation.id,
                                messageId: message.id,
                                preview: content.slice(0, 120),
                                senderName: member.profile.name,
                            });
                        }
                    }
                }
            }

            return res.status(200).json(message);
        }

        // DELETE or PATCH: Edit/Delete direct message
        if (req.method === "DELETE" || req.method === "PATCH") {
            const { messageId, conversationId } = req.query;

            if (!conversationId) {
                return res.status(400).json({ error: "Conversation ID missing" });
            }

            if (!messageId) {
                return res.status(400).json({ error: "Message ID missing" });
            }

            // Find conversation
            const conversation = await db.conversation.findFirst({
                where: {
                    id: conversationId as string,
                    OR: [
                        {
                            memberOne: {
                                profileId: profile.id
                            }
                        },
                        {
                            memberTwo: {
                                profileId: profile.id
                            }
                        }
                    ]
                },
                include: {
                    memberOne: {
                        include: { profile: true }
                    },
                    memberTwo: {
                        include: { profile: true }
                    }
                }
            });

            if (!conversation) {
                return res.status(404).json({ error: "Conversation not found" });
            }

            const member = conversation.memberOne.profileId === profile.id 
                ? conversation.memberOne 
                : conversation.memberTwo;

            // Find direct message
            let message = await db.directMessage.findFirst({
                where: {
                    id: messageId as string,
                    conversationId: conversationId as string
                },
                include: {
                    member: {
                        include: {
                            profile: true
                        }
                    }
                }
            });

            if (!message || message.deleted) {
                return res.status(404).json({ error: "Message not found" });
            }

            const isMessageOwner = message.memberId === member.id;

            // DELETE: Mark message as deleted (soft delete)
            if (req.method === "DELETE") {
                if (!isMessageOwner) {
                    return res.status(401).json({ error: "Unauthorized" });
                }

                message = await db.directMessage.update({
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
                        }
                    }
                });

                // Emit update to all clients in conversation
                const conversationKey = `conversation:${conversation.id}`;
                res?.socket?.server?.io?.to(conversationKey).emit(SOCKET_EVENTS.CHAT_MESSAGE_UPDATE, {
                    channelId: conversation.id,
                    message
                });

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

                message = await db.directMessage.update({
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
                        }
                    }
                });

                // Emit update to all clients in conversation
                const conversationKey = `conversation:${conversation.id}`;
                res?.socket?.server?.io?.to(conversationKey).emit(SOCKET_EVENTS.CHAT_MESSAGE_UPDATE, {
                    channelId: conversation.id,
                    message
                });

                return res.status(200).json(message);
            }
        }
    }
    catch( error ) {
        console.log("[MESSAGES_POST]", error);
        return res.status(500).json({ message : "Interal Error" });
    }
}