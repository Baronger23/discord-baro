-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "pinned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pinnedAt" TIMESTAMP(3),
ADD COLUMN     "pinnedById" TEXT;

-- CreateIndex
CREATE INDEX "Message_pinned_channelId_idx" ON "Message"("pinned", "channelId");
