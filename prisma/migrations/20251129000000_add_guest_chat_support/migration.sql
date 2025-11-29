-- AddGuestChatSupport: Make clientId optional and add guest fields

-- AlterTable: Make clientId nullable for guest users
ALTER TABLE "ChatMessage" ALTER COLUMN "clientId" DROP NOT NULL;

-- AlterTable: Add guest user fields
ALTER TABLE "ChatMessage" ADD COLUMN IF NOT EXISTS "guestUsername" TEXT;
ALTER TABLE "ChatMessage" ADD COLUMN IF NOT EXISTS "guestPhone" TEXT;

-- CreateIndex: Add indexes for guest queries
CREATE INDEX IF NOT EXISTS "ChatMessage_guestUsername_createdAt_idx" ON "ChatMessage"("guestUsername", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "ChatMessage_clientSocketId_createdAt_idx" ON "ChatMessage"("clientSocketId", "createdAt" DESC);
