/*
  Warnings:

  - A unique constraint covering the columns `[serverId,profileId]` on the table `Member` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE INDEX "Channel_serverId_type_idx" ON "Channel"("serverId", "type");

-- CreateIndex
CREATE INDEX "Channel_serverId_isPrivate_idx" ON "Channel"("serverId", "isPrivate");

-- CreateIndex
CREATE INDEX "Channel_createdAt_idx" ON "Channel"("createdAt");

-- CreateIndex
CREATE INDEX "ChannelPermission_channelId_memberId_idx" ON "ChannelPermission"("channelId", "memberId");

-- CreateIndex
CREATE INDEX "ChannelPermission_channelId_canView_idx" ON "ChannelPermission"("channelId", "canView");

-- CreateIndex
CREATE INDEX "Conversation_memberOneId_idx" ON "Conversation"("memberOneId");

-- CreateIndex
CREATE INDEX "Conversation_memberOneId_memberTwoId_idx" ON "Conversation"("memberOneId", "memberTwoId");

-- CreateIndex
CREATE INDEX "Conversation_createdAt_idx" ON "Conversation"("createdAt");

-- CreateIndex
CREATE INDEX "DirectMessage_conversationId_createdAt_idx" ON "DirectMessage"("conversationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "DirectMessage_conversationId_deleted_createdAt_idx" ON "DirectMessage"("conversationId", "deleted", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "DirectMessage_memberId_createdAt_idx" ON "DirectMessage"("memberId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "DirectMessage_createdAt_idx" ON "DirectMessage"("createdAt");

-- CreateIndex
CREATE INDEX "Member_serverId_profileId_idx" ON "Member"("serverId", "profileId");

-- CreateIndex
CREATE INDEX "Member_serverId_role_idx" ON "Member"("serverId", "role");

-- CreateIndex
CREATE INDEX "Member_createdAt_idx" ON "Member"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Member_serverId_profileId_key" ON "Member"("serverId", "profileId");

-- CreateIndex
CREATE INDEX "Message_channelId_createdAt_idx" ON "Message"("channelId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Message_channelId_deleted_createdAt_idx" ON "Message"("channelId", "deleted", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Message_memberId_createdAt_idx" ON "Message"("memberId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Message_createdAt_idx" ON "Message"("createdAt");

-- CreateIndex
CREATE INDEX "Profile_userId_idx" ON "Profile"("userId");

-- CreateIndex
CREATE INDEX "Profile_email_idx" ON "Profile"("email");

-- CreateIndex
CREATE INDEX "Server_inviteCode_idx" ON "Server"("inviteCode");

-- CreateIndex
CREATE INDEX "Server_createdAt_idx" ON "Server"("createdAt");
