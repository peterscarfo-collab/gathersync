/**
 * Clear all events and participants from InstantDB
 * Run with: npx tsx scripts/clear-events.ts
 */
import 'dotenv/config';
import { adminDb, tx } from '../lib/admin-db';

async function clearData() {
  try {
    console.log('Fetching all events...');
    const result = await adminDb.query({
      events: {
        participants: {},
      },
    });

    if (!result.events || result.events.length === 0) {
      console.log('No events found. Database is already clean!');
      return;
    }

    console.log(`Found ${result.events.length} events`);

    // Count participants
    let participantCount = 0;
    const deleteTransactions: any[] = [];

    for (const event of result.events) {
      console.log(`- Event: ${event.id} (${event.name})`);
      
      // Delete participants first
      if (event.participants && event.participants.length > 0) {
        participantCount += event.participants.length;
        for (const participant of event.participants) {
          deleteTransactions.push(tx.participants[participant.id].delete());
        }
      }

      // Delete event
      deleteTransactions.push(tx.events[event.id].delete());
    }

    console.log(`\nDeleting ${result.events.length} events and ${participantCount} participants...`);
    
    await adminDb.transact(deleteTransactions);

    console.log('✅ All events and participants deleted successfully!');
    console.log('You can now create new events with proper UUIDs.');
  } catch (error) {
    console.error('❌ Error clearing data:', error);
    throw error;
  }
}

clearData()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
