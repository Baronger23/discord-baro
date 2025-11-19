-- AlterTable
ALTER TABLE "DirectMessage" ADD COLUMN     "pinned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pinnedAt" TIMESTAMP(3),
ADD COLUMN     "pinnedById" TEXT;

-- CreateIndex
CREATE INDEX "DirectMessage_pinned_conversationId_idx" ON "DirectMessage"("pinned", "conversationId");
