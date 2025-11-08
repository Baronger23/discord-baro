import { currentProfilePages } from '@/lib/current-profile-pages';
import { db } from '@/lib/db';
import type { NextApiRequest } from 'next';
import type { NextApiResponseServerIo } from '@/type';
import { SOCKET_EVENTS } from '@/lib/socket/constants';

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponseServerIo
) {
    if (req.method !== "DELETE" && req.method !== "PATCH") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    try {
        const profile = await currentProfilePages(req);
        const { directMessageId } = req.query;
        const { conversationId } = req.query;

        if (!profile) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        if (!conversationId) {
            return res.status(400).json({ error: "Conversation ID missing" });
        }

        if (!directMessageId) {
            return res.status(400).json({ error: "Message ID missing" });
        }

        // Find conversation and verify membership
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
                id: directMessageId as string,
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

        // Check permissions - only owner can modify
        const isMessageOwner = message.memberId === member.id;

        if (!isMessageOwner) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        // DELETE: Mark message as deleted (soft delete)
        if (req.method === "DELETE") {
            message = await db.directMessage.update({
                where: {
                    id: directMessageId as string
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
            const { content } = req.body;

            if (!content) {
                return res.status(400).json({ error: "Content missing" });
            }

            message = await db.directMessage.update({
                where: {
                    id: directMessageId as string
                },
                data: {
                    content,
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

    } catch (error) {
        console.log("[DIRECT_MESSAGE_ID]", error);
        return res.status(500).json({ error: "Internal error" });
    }
}
