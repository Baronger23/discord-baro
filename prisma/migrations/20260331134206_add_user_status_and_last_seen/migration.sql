-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ONLINE', 'IDLE', 'DND', 'OFFLINE');

-- AlterEnum
ALTER TYPE "ChannelType" ADD VALUE 'WHITEBOARD';

-- AlterTable
ALTER TABLE "DirectMessage" ADD COLUMN     "replyToDirectMessageId" TEXT;

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "replyToMessageId" TEXT;

-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "status" "UserStatus" NOT NULL DEFAULT 'OFFLINE';

-- CreateIndex
CREATE INDEX "DirectMessage_replyToDirectMessageId_idx" ON "DirectMessage"("replyToDirectMessageId");

-- CreateIndex
CREATE INDEX "Message_replyToMessageId_idx" ON "Message"("replyToMessageId");

-- CreateIndex
CREATE INDEX "Profile_status_idx" ON "Profile"("status");

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_replyToMessageId_fkey" FOREIGN KEY ("replyToMessageId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectMessage" ADD CONSTRAINT "DirectMessage_replyToDirectMessageId_fkey" FOREIGN KEY ("replyToDirectMessageId") REFERENCES "DirectMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
