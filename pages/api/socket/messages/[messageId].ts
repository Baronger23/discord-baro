import { currentProfilePages } from '@/lib/current-profile-pages';
import { db } from '@/lib/db';
import type { NextApiRequest } from 'next';
import type { NextApiResponseServerIo } from '@/type';
import { emitChannelMessageUpdate } from '@/lib/socket/server';
import { MemberRole } from '@prisma/client';

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponseServerIo
) {
    if (req.method !== "DELETE" && req.method !== "PATCH") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    try {
        const profile = await currentProfilePages(req);
        const { messageId } = req.query;
        const { serverId, channelId } = req.query;

        if (!profile) {
            return res.status(401).json({ error: "Unauthorized" });
        }

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
        const canModify = isMessageOwner || isAdmin || isModerator;

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
            emitChannelMessageUpdate(channel.id, message);

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
                    content,
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
            emitChannelMessageUpdate(channel.id, message);

            return res.status(200).json(message);
        }

    } catch (error) {
        console.log("[MESSAGE_ID]", error);
        return res.status(500).json({ error: "Internal error" });
    }
}
