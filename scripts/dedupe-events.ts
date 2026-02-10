#!/usr/bin/env tsx
import 'dotenv/config';
import { adminDb, tx } from '../lib/admin-db.js';

type EventRecord = {
  id: string;
  name: string;
  eventType?: string;
  month?: number;
  year?: number;
  fixedDate?: string | null;
  fixedTime?: string | null;
  updatedAt: string;
  deletedAt?: string | null;
  creator?: { id: string; email?: string | null } | null;
};

function getSignature(event: EventRecord) {
  return [
    event.name,
    event.eventType ?? '',
    event.month ?? '',
    event.year ?? '',
    event.fixedDate ?? '',
    event.fixedTime ?? '',
  ].join('|');
}

async function dedupeEvents() {
  try {
    console.log('Fetching events for de-duplication...');
    const result = await adminDb.query({
      events: {
        creator: {},
      },
    });

    const events = (result.events || []) as EventRecord[];
    console.log('Found', events.length, 'events');

    if (events.length <= 1) {
      console.log('No duplicates possible.');
      return;
    }

    const byOwner = new Map<string, EventRecord[]>();
    for (const event of events) {
      if (event.deletedAt) continue;
      const ownerId = event.creator?.id ?? 'unknown';
      const list = byOwner.get(ownerId) ?? [];
      list.push(event);
      byOwner.set(ownerId, list);
    }

    const updates = [];
    let dedupedCount = 0;

    for (const [ownerId, ownerEvents] of byOwner.entries()) {
      const bySignature = new Map<string, EventRecord>();
      for (const event of ownerEvents) {
        const signature = getSignature(event);
        const existing = bySignature.get(signature);
        if (!existing) {
          bySignature.set(signature, event);
          continue;
        }

        const existingUpdated = new Date(existing.updatedAt).getTime();
        const candidateUpdated = new Date(event.updatedAt).getTime();
        if (candidateUpdated > existingUpdated) {
          bySignature.set(signature, event);
        }
      }

      const keepIds = new Set(Array.from(bySignature.values()).map((e) => e.id));
      const duplicates = ownerEvents.filter((e) => !keepIds.has(e.id));

      if (duplicates.length > 0) {
        console.log(`Owner ${ownerId}: removing ${duplicates.length} duplicate events`);
        for (const duplicate of duplicates) {
          updates.push(
            tx.events[duplicate.id].update({
              deletedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            })
          );
          dedupedCount += 1;
        }
      }
    }

    if (updates.length === 0) {
      console.log('No duplicates found.');
      return;
    }

    console.log('Applying', updates.length, 'soft-delete updates...');
    await adminDb.transact(updates);
    console.log('✅ De-duplication complete. Soft-deleted', dedupedCount, 'events');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

dedupeEvents();
