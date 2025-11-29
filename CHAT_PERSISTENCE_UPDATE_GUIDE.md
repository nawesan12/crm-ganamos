# Chat Persistence Update Guide

## Overview

This update enables **ALL conversations to be persisted**, even from users who are not yet saved in the database as clients. This ensures no conversation history is lost.

## What Changed

### Database Schema Updates

1. **ChatMessage.clientId** - Now optional (nullable)
2. **ChatMessage.guestUsername** - New field to store username for unregistered users
3. **ChatMessage.guestPhone** - New field to store phone for unregistered users
4. **New indexes** - Added for efficient guest user queries

### Backend Updates

1. **Auto-client creation** - When a guest user sends a message, a Client record is automatically created
2. **Guest chat support** - Messages can be saved without a clientId
3. **Updated actions** - All chat actions now support both registered clients and guests

## Migration Steps

### Step 1: Apply Database Migration

Run the SQL migration on your database:

```bash
# Option 1: Using psql
psql -h your-db-host -U your-user -d your-database -f migrations_manual/add_guest_chat_fields.sql

# Option 2: Using Supabase SQL Editor
# Copy the contents of migrations_manual/add_guest_chat_fields.sql
# Paste into Supabase SQL Editor and run
```

### Step 2: Verify Migration

Check that the new columns exist:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'ChatMessage'
  AND column_name IN ('clientId', 'guestUsername', 'guestPhone');
```

Expected output:
```
 column_name   | data_type | is_nullable
---------------+-----------+-------------
 clientId      | integer   | YES
 guestUsername | text      | YES
 guestPhone    | text      | YES
```

### Step 3: Restart Your Application

```bash
npm run dev
# or
npm run build && npm start
```

## How It Works

### Message Flow for New Guest Users

1. **Guest connects to chat** via socket.io with username "guest123"
2. **Guest sends first message**
   - Frontend calls `saveChatMessageAction()`
   - Backend checks if client exists with username "guest123"
   - If not found, creates new Client record automatically
   - Saves message with both `clientId` and `guestUsername`

3. **Subsequent messages**
   - All messages linked to the auto-created Client
   - Full conversation history preserved

### Message Flow for Existing Clients

- Works exactly as before
- No changes needed
- Messages saved with `clientId`

## Key Features

### ✅ Zero Message Loss
- Every message is persisted, regardless of user registration status
- Guest conversations automatically converted to client conversations

### ✅ Automatic Client Creation
- Guests become clients transparently
- No manual intervention needed
- Preserves all conversation context

### ✅ Backward Compatible
- Existing chat functionality unchanged
- All existing messages remain accessible
- No data migration required for existing messages

## API Updates

### saveChatMessageAction

**Before:**
```typescript
{
  clientId: number,  // Required
  text: string,
  ...
}
```

**After:**
```typescript
{
  clientId?: number,       // Optional
  guestUsername?: string,  // For guests
  guestPhone?: string,     // For guests
  text: string,
  ...
}
```

### getChatHistoryAction

**Before:**
```typescript
{
  clientId: number  // Required
}
```

**After:**
```typescript
{
  clientId?: number,         // Optional
  guestUsername?: string,    // Alternative identifier
  clientSocketId?: string    // Alternative identifier
}
```

### getRecentChatsAction

Now returns both:
- Registered client conversations
- Guest conversations (auto-promotes to client on first message)

### markMessagesAsReadAction

**Before:**
```typescript
{
  clientId: number,
  operatorId: number
}
```

**After:**
```typescript
{
  clientId?: number,        // Optional
  guestUsername?: string,   // Alternative identifier
  operatorId: number
}
```

## Testing

### Test Case 1: New Guest User
1. Open client chat widget (not logged in)
2. Enter username "testguest"
3. Send message "Hello"
4. **Expected:** Message saved, Client created automatically
5. Check database:
   ```sql
   SELECT * FROM "Client" WHERE username = 'testguest';
   SELECT * FROM "ChatMessage" WHERE "guestUsername" = 'testguest';
   ```

### Test Case 2: Existing Client
1. Open chat as existing client
2. Send message
3. **Expected:** Works as before, saved with clientId

### Test Case 3: Conversation Continuity
1. Guest sends message
2. Guest closes chat
3. Guest returns and sends another message
4. **Expected:** Both messages linked to same Client record

## Rollback Plan

If issues occur, you can rollback:

```sql
-- Remove new columns (WARNING: Loses guest data)
ALTER TABLE "ChatMessage" DROP COLUMN IF EXISTS "guestUsername";
ALTER TABLE "ChatMessage" DROP COLUMN IF EXISTS "guestPhone";
ALTER TABLE "ChatMessage" ALTER COLUMN "clientId" SET NOT NULL;

-- Remove indexes
DROP INDEX IF EXISTS "ChatMessage_guestUsername_createdAt_idx";
DROP INDEX IF EXISTS "ChatMessage_clientSocketId_createdAt_idx";
```

Then revert the code changes and regenerate Prisma client:
```bash
git revert <commit-hash>
npx prisma generate
```

## Monitoring

Monitor these metrics after deployment:

1. **Auto-created clients**
   ```sql
   SELECT COUNT(*) FROM "Client"
   WHERE "createdAt" > NOW() - INTERVAL '1 day';
   ```

2. **Guest messages**
   ```sql
   SELECT COUNT(*) FROM "ChatMessage"
   WHERE "guestUsername" IS NOT NULL
   AND "createdAt" > NOW() - INTERVAL '1 day';
   ```

3. **Messages without clientId (should be rare)**
   ```sql
   SELECT COUNT(*) FROM "ChatMessage"
   WHERE "clientId" IS NULL;
   ```

## FAQ

**Q: What happens to old messages without guestUsername?**
A: They remain unchanged and work normally with their existing clientId.

**Q: Can a guest have multiple conversations?**
A: The same guest username will be linked to the same auto-created Client, maintaining conversation continuity.

**Q: What if a guest and registered client have the same username?**
A: The system checks for existing clients before auto-creating, so they'll be linked to the existing client.

**Q: Will this impact performance?**
A: Minimal impact. New indexes ensure efficient guest queries. Auto-creation happens once per guest.

## Support

If you encounter issues:
1. Check database migration was applied successfully
2. Verify Prisma client was regenerated
3. Check application logs for errors
4. Test with a simple guest conversation

## Summary

✅ **All conversations are now persisted, even from unregistered users**
✅ **Automatic client creation from guest data**
✅ **Zero message loss**
✅ **Backward compatible with existing functionality**
✅ **Simple SQL migration, no data loss**
