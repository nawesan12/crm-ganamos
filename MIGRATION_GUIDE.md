# Database Migration Guide

## Overview

This project uses Prisma Migrate for database schema management. Migrations are version-controlled SQL files that track changes to your database schema.

## Quick Start

### Deploy Migrations to Production

```bash
npm run migrate:deploy
```

This command will:
- Apply all pending migrations to the database
- Update the `_prisma_migrations` table to track applied migrations
- Generate the Prisma Client

### Check Migration Status

```bash
npm run migrate:status
```

This shows which migrations have been applied and which are pending.

### Generate Prisma Client

```bash
npm run db:generate
```

Regenerates the Prisma Client based on your schema. Run this after pulling schema changes.

## Current Migrations

### `20251129000000_add_guest_chat_support`

**What it does:**
- Makes `clientId` optional in `ChatMessage` table (allows guest users)
- Adds `guestUsername` field for unregistered user names
- Adds `guestPhone` field for unregistered user phone numbers
- Creates indexes for efficient guest user queries

**Why it's needed:**
- Enables chat functionality for users not yet registered in the database
- Allows auto-promotion of guests to registered clients
- Fixes production error: "No se pudieron cargar los chats recientes"

**Safe to apply:** Yes - existing data is preserved. The migration only adds new optional fields.

## Deployment Workflows

### Development Environment

For local development with an empty database:
```bash
npx prisma migrate dev
```

This will apply all migrations and create new ones interactively.

### Staging/Production Environment

**Step 1: Check status**
```bash
npm run migrate:status
```

**Step 2: Review pending migrations**
Check the SQL in `prisma/migrations/<timestamp>_<name>/migration.sql`

**Step 3: Deploy**
```bash
npm run migrate:deploy
```

**Step 4: Verify**
```bash
npm run migrate:status
# Should show: "Database schema is up to date!"
```

## Troubleshooting

### Migration Failed

If a migration fails midway:
1. Check the error message
2. Manually fix the database if needed
3. Mark the migration as applied: `npx prisma migrate resolve --applied <migration-name>`
4. Or rollback: `npx prisma migrate resolve --rolled-back <migration-name>`

### Schema Drift

If your database schema doesn't match your Prisma schema:
```bash
npx prisma db pull  # Pull current database schema
git diff prisma/schema.prisma  # Review differences
```

### "Database is not managed by Prisma Migrate"

This happens on first deployment. Initialize Prisma Migrate:
```bash
npx prisma migrate resolve --applied 20251129000000_add_guest_chat_support
```

Then future migrations will work normally with `migrate:deploy`.

## Important Notes

- ✅ **Always backup your database before running migrations in production**
- ✅ **Test migrations on staging first**
- ✅ **Review the SQL in migration files before deploying**
- ❌ **Never edit migration files after they've been applied**
- ❌ **Don't use `prisma db push` in production** - it skips the migration system

## Migration File Structure

```
prisma/
├── schema.prisma                 # Your data model
└── migrations/
    ├── migration_lock.toml      # Lock file (commit this)
    └── 20251129000000_add_guest_chat_support/
        └── migration.sql        # The SQL to run
```

## Creating New Migrations (Development Only)

When you modify `schema.prisma`:
```bash
npx prisma migrate dev --name <descriptive_name>
```

This will:
1. Create a new migration file
2. Apply it to your dev database
3. Regenerate Prisma Client

## Further Reading

- [Prisma Migrate Documentation](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [Deployment Best Practices](https://www.prisma.io/docs/guides/deployment/deploy-database-changes-with-prisma-migrate)
