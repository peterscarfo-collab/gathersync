#!/usr/bin/env tsx
import 'dotenv/config';
import { adminDb, tx } from '../lib/admin-db.js';

const targetName = process.argv.slice(2).join(' ').trim();

if (!targetName) {
  console.error('Usage: pnpm tsx scripts/remove-duplicate-by-name.ts "<event name>"');
  process.exit(1);
}

type EventRecord = {
  id: string;
  name: string;
  updatedAt: string;
  deletedAt?: string | null;
  creator?: { id: string; email?: string | null } | null;
};

async function removeDuplicatesByName() {
  console.log(`Searching for events named "${targetName}"...`);
  const result = await adminDb.query({
    events: {
      creator: {},
      $: {
        where: {
          name: targetName,
        },
      },
    },
  });

  const events = (result.events || []) as EventRecord[];
  const active = events.filter((e) => !e.deletedAt);

  if (active.length <= 1) {
    console.log('No duplicates found.');
    return;
  }

  active.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  const [keep, ...duplicates] = active;

  console.log('Keeping:', keep.id, keep.updatedAt);
  console.log('Removing:', duplicates.map((d) => d.id).join(', '));

  const now = new Date().toISOString();
  await adminDb.transact(
    duplicates.map((duplicate) =>
      tx.events[duplicate.id].update({
        deletedAt: now,
        updatedAt: now,
      })
    )
  );

  console.log(`✅ Soft-deleted ${duplicates.length} duplicate event(s).`);
}

removeDuplicatesByName().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
