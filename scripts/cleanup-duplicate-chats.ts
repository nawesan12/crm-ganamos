/**
 * Database Cleanup Script: Remove Duplicate Guest Chat Data
 *
 * This script identifies and consolidates duplicate chat messages for guest users.
 *
 * Run with: npx tsx scripts/cleanup-duplicate-chats.ts
 * Or with Bun: bun run scripts/cleanup-duplicate-chats.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Starting duplicate chat cleanup...\n');

  try {
    // Step 1: Find all guest usernames that might have been duplicated
    console.log('Step 1: Identifying duplicate guest chats...');

    const guestMessages = await prisma.chatMessage.groupBy({
      by: ['guestUsername'],
      where: {
        guestUsername: {
          not: null,
        },
        clientId: null, // Only guest messages (not converted to clients)
      },
      _count: {
        id: true,
      },
    });

    console.log(`   Found ${guestMessages.length} unique guest usernames`);

    // Step 2: Check if any of these guests were later converted to clients
    console.log('\nStep 2: Checking for guests converted to clients...');

    let convertedCount = 0;
    let linkedMessagesCount = 0;

    for (const guest of guestMessages) {
      if (!guest.guestUsername) continue;

      // Check if a client exists with this username
      const client = await prisma.client.findUnique({
        where: { username: guest.guestUsername },
      });

      if (client) {
        console.log(`   ✓ Found client "${client.username}" (ID: ${client.id}) - linking guest messages...`);

        // Update all guest messages to link to this client
        const result = await prisma.chatMessage.updateMany({
          where: {
            guestUsername: guest.guestUsername,
            clientId: null,
          },
          data: {
            clientId: client.id,
            // Keep guestUsername and guestPhone for historical reference
          },
        });

        linkedMessagesCount += result.count;
        convertedCount++;
        console.log(`     → Linked ${result.count} messages to client ID ${client.id}`);
      }
    }

    console.log(`\n   Total converted guests: ${convertedCount}`);
    console.log(`   Total messages linked: ${linkedMessagesCount}`);

    // Step 3: Identify and report on remaining guest duplicates
    console.log('\nStep 3: Analyzing remaining guest messages...');

    const remainingGuests = await prisma.chatMessage.groupBy({
      by: ['guestUsername'],
      where: {
        guestUsername: {
          not: null,
        },
        clientId: null,
      },
      _count: {
        id: true,
      },
    });

    console.log(`\n   Remaining unique guest usernames: ${remainingGuests.length}`);

    // Show guests with multiple messages
    const guestsWithMultipleMessages = remainingGuests.filter(g => g._count.id > 1);
    if (guestsWithMultipleMessages.length > 0) {
      console.log(`\n   Guests with multiple messages (still active):`);
      for (const guest of guestsWithMultipleMessages.slice(0, 10)) {
        console.log(`     - ${guest.guestUsername}: ${guest._count.id} messages`);
      }
      if (guestsWithMultipleMessages.length > 10) {
        console.log(`     ... and ${guestsWithMultipleMessages.length - 10} more`);
      }
    }

    // Step 4: Report summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 CLEANUP SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Guests converted to clients: ${convertedCount}`);
    console.log(`✅ Messages linked to clients: ${linkedMessagesCount}`);
    console.log(`ℹ️  Active guest chats remaining: ${remainingGuests.length}`);
    console.log('='.repeat(60));

    console.log('\n✨ Cleanup completed successfully!');
    console.log('\nℹ️  Note: Guest messages are kept as guests until manually converted.');
    console.log('   The updated code now ensures each guest gets a unique ID to prevent');
    console.log('   future selection issues.\n');

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
