#!/usr/bin/env tsx
import 'dotenv/config';
import { adminDb, tx } from '../lib/admin-db.js';

type UserRecord = {
  id: string;
  email?: string | null;
};

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

async function restoreEvents() {
  try {
    console.log('Fetching users and events...');
    const result = await adminDb.query({
      events: {
        creator: {},
      },
      $users: {},
    });

    const users = (result.$users || []) as UserRecord[];
    const events = (result.events || []) as EventRecord[];

    console.log('Users:', users.length, 'Events:', events.length);
    if (events.length === 0) {
      console.log('No events to restore.');
      return;
    }

    const singleUser = users.length === 1 ? users[0] : null;
    const updates = [];

    // Link missing creators if we can safely infer a single user.
    if (singleUser) {
      const missingCreator = events.filter((e) => !e.creator);
      if (missingCreator.length > 0) {
        console.log('Linking', missingCreator.length, 'events to user', singleUser.email);
        for (const event of missingCreator) {
          updates.push(tx.events[event.id].link({ creator: singleUser.id }));
        }
      }
    } else {
      const missingCreatorCount = events.filter((e) => !e.creator).length;
      if (missingCreatorCount > 0) {
        console.log('Skipped linking events with missing creators (multiple users present).');
      }
    }

    // Ensure at least one active event per signature per owner.
    const byOwner = new Map<string, EventRecord[]>();
    for (const event of events) {
      const ownerId = event.creator?.id ?? 'unknown';
      const list = byOwner.get(ownerId) ?? [];
      list.push(event);
      byOwner.set(ownerId, list);
    }

    for (const [ownerId, ownerEvents] of byOwner.entries()) {
      const bySignature = new Map<string, EventRecord[]>();
      for (const event of ownerEvents) {
        const signature = getSignature(event);
        const list = bySignature.get(signature) ?? [];
        list.push(event);
        bySignature.set(signature, list);
      }

      for (const [signature, signatureEvents] of bySignature.entries()) {
        const active = signatureEvents.filter((e) => !e.deletedAt);
        if (active.length > 0) continue;

        // Restore the most recently updated deleted event.
        const sorted = [...signatureEvents].sort((a, b) => {
          const aTime = new Date(a.updatedAt).getTime();
          const bTime = new Date(b.updatedAt).getTime();
          return bTime - aTime;
        });

        const candidate = sorted[0];
        console.log(`Restoring event for owner ${ownerId}: ${signature}`);
        updates.push(
          tx.events[candidate.id].update({
            deletedAt: null,
            updatedAt: new Date().toISOString(),
          })
        );
      }
    }

    if (updates.length === 0) {
      console.log('No changes needed.');
      return;
    }

    console.log('Applying', updates.length, 'updates...');
    await adminDb.transact(updates);
    console.log('✅ Restore complete.');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

restoreEvents();
