# Database Cleanup Scripts

## Cleanup Duplicate Chats

### Problem
Previously, all guest users (unregistered chat users) were assigned the same ID (`0`), causing:
- Duplicate client IDs like `"client_0"` for all guests
- Multiple chats appearing selected when clicking one
- Incorrect message display for guest chats

### Solution
The codebase has been fixed to:
1. Generate unique IDs for each guest based on their username hash
2. Filter out duplicates when loading chats
3. Prevent duplicate chat entries

### Running the Cleanup Script

This script will:
- Link guest messages to their corresponding client accounts (if they were converted)
- Report on remaining guest chats
- Show statistics about the cleanup

#### With Bun (recommended):
```bash
bun run scripts/cleanup-duplicate-chats.ts
```

#### With Node.js/tsx:
```bash
npx tsx scripts/cleanup-duplicate-chats.ts
```

### What the Script Does

1. **Identifies converted guests**: Finds guests who were later registered as clients
2. **Links messages**: Updates guest messages to link to the proper client ID
3. **Reports duplicates**: Shows statistics about guest chats
4. **Non-destructive**: Does NOT delete any messages, only updates relationships

### Before Running

- ✅ Make sure you have a database backup
- ✅ Ensure `.env` has the correct `DATABASE_URL`
- ✅ Run `npm install` or `bun install` to have all dependencies

### After Running

The script will output:
- Number of guests converted to clients
- Number of messages linked
- List of active guest chats still in the system

### Safety

- This script is **read-heavy** and only updates relationships
- No data is deleted
- Guest username and phone are preserved for historical reference
- Can be run multiple times safely (idempotent)

### Example Output

```
🔍 Starting duplicate chat cleanup...

Step 1: Identifying duplicate guest chats...
   Found 15 unique guest usernames

Step 2: Checking for guests converted to clients...
   ✓ Found client "user123" (ID: 5) - linking guest messages...
     → Linked 12 messages to client ID 5
   ✓ Found client "player456" (ID: 8) - linking guest messages...
     → Linked 8 messages to client ID 8

   Total converted guests: 2
   Total messages linked: 20

Step 3: Analyzing remaining guest messages...
   Remaining unique guest usernames: 13

============================================================
📊 CLEANUP SUMMARY
============================================================
✅ Guests converted to clients: 2
✅ Messages linked to clients: 20
ℹ️  Active guest chats remaining: 13
============================================================

✨ Cleanup completed successfully!
```

### Need Help?

If you encounter any issues:
1. Check the error message
2. Verify database connection
3. Ensure Prisma schema is up to date: `npx prisma generate`
4. Contact the development team
