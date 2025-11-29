-- Manual migration to add guest chat support
-- Run this SQL on your database to add new fields to ChatMessage table

-- Make clientId nullable
ALTER TABLE "ChatMessage" ALTER COLUMN "clientId" DROP NOT NULL;

-- Add new fields for guest users
ALTER TABLE "ChatMessage" ADD COLUMN IF NOT EXISTS "guestUsername" TEXT;
ALTER TABLE "ChatMessage" ADD COLUMN IF NOT EXISTS "guestPhone" TEXT;

-- Create indexes for guest queries
CREATE INDEX IF NOT EXISTS "ChatMessage_guestUsername_createdAt_idx" ON "ChatMessage"("guestUsername", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "ChatMessage_clientSocketId_createdAt_idx" ON "ChatMessage"("clientSocketId", "createdAt" DESC);

-- Add comment for documentation
COMMENT ON COLUMN "ChatMessage"."guestUsername" IS 'Username for guest users not yet registered in Client table';
COMMENT ON COLUMN "ChatMessage"."guestPhone" IS 'Phone number for guest users not yet registered in Client table';
