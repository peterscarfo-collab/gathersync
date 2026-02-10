/**
 * Complete reset - clears everything
 * Run with: npx tsx scripts/reset-all.ts
 */
import 'dotenv/config';
import { adminDb, tx } from '../lib/admin-db';

async function resetAll() {
  try {
    console.log('🔄 Starting complete reset...\n');

    // 1. Clear all database data
    console.log('1️⃣ Fetching all data from InstantDB...');
    const result = await adminDb.query({
      events: { participants: {} },
      eventSnapshots: {},
      groupTemplates: {},
      pushTokens: {},
    });

    const deleteTransactions: any[] = [];
    let counts = {
      events: 0,
      participants: 0,
      snapshots: 0,
      templates: 0,
      tokens: 0,
    };

    // Delete events and their participants
    if (result.events && result.events.length > 0) {
      counts.events = result.events.length;
      for (const event of result.events) {
        if (event.participants) {
          counts.participants += event.participants.length;
          for (const p of event.participants) {
            deleteTransactions.push(tx.participants[p.id].delete());
          }
        }
        deleteTransactions.push(tx.events[event.id].delete());
      }
    }

    // Delete snapshots
    if (result.eventSnapshots && result.eventSnapshots.length > 0) {
      counts.snapshots = result.eventSnapshots.length;
      for (const s of result.eventSnapshots) {
        deleteTransactions.push(tx.eventSnapshots[s.id].delete());
      }
    }

    // Delete templates
    if (result.groupTemplates && result.groupTemplates.length > 0) {
      counts.templates = result.groupTemplates.length;
      for (const t of result.groupTemplates) {
        deleteTransactions.push(tx.groupTemplates[t.id].delete());
      }
    }

    // Delete push tokens
    if (result.pushTokens && result.pushTokens.length > 0) {
      counts.tokens = result.pushTokens.length;
      for (const token of result.pushTokens) {
        deleteTransactions.push(tx.pushTokens[token.id].delete());
      }
    }

    console.log('\n📊 Found:');
    console.log(`   - ${counts.events} events`);
    console.log(`   - ${counts.participants} participants`);
    console.log(`   - ${counts.snapshots} snapshots`);
    console.log(`   - ${counts.templates} templates`);
    console.log(`   - ${counts.tokens} push tokens`);

    if (deleteTransactions.length > 0) {
      console.log(`\n🗑️  Deleting ${deleteTransactions.length} items from InstantDB...`);
      await adminDb.transact(deleteTransactions);
      console.log('✅ Database cleared!');
    } else {
      console.log('\n✅ Database already empty!');
    }

    console.log('\n📝 To clear browser local storage:');
    console.log('   1. Open browser console');
    console.log('   2. Run: localStorage.clear()');
    console.log('   3. Refresh the page');
    
    console.log('\n✨ Reset complete! Ready for fresh start.\n');
  } catch (error) {
    console.error('❌ Reset failed:', error);
    throw error;
  }
}

resetAll()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
