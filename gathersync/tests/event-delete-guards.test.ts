import { describe, expect, it } from 'vitest';
import {
  deletionTimestamp,
  normalizeEventId,
  shouldPreserveLocalDeletion,
} from '../lib/event-delete-guards';
import type { Event } from '../types/models';

const baseEvent: Event = {
  id: 'event-1',
  name: 'Board Meeting',
  eventType: 'flexible',
  month: 6,
  year: 2026,
  participants: [],
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-01T00:00:00.000Z',
};

describe('event delete guards', () => {
  it('normalizes string IDs and rejects object payloads', () => {
    expect(normalizeEventId(' event-1 ')).toBe('event-1');
    expect(() => normalizeEventId({ id: 'event-1' })).toThrow(
      'Expected eventId to be a string, received object'
    );
    expect(() => normalizeEventId('   ')).toThrow('Expected eventId to be a non-empty string');
  });

  it('uses the newest local deletion timestamp', () => {
    const deletedEvent: Event = {
      ...baseEvent,
      deletedAt: '2026-06-18T11:00:00.000Z',
      updatedAt: '2026-06-18T11:01:00.000Z',
    };

    expect(deletionTimestamp(deletedEvent)).toBe(
      new Date('2026-06-18T11:01:00.000Z').getTime()
    );
  });

  it('preserves local deletion tombstones over active cloud rows', () => {
    const localDeletedEvent: Event = {
      ...baseEvent,
      deletedAt: '2026-06-18T11:00:00.000Z',
      updatedAt: '2026-06-18T11:00:00.000Z',
    };
    const newerCloudEvent: Event = {
      ...baseEvent,
      updatedAt: '2026-06-18T11:05:00.000Z',
    };

    expect(shouldPreserveLocalDeletion(localDeletedEvent, newerCloudEvent)).toBe(true);
  });

  it('preserves pending deletes even when timestamps are invalid', () => {
    const localDeletedEvent: Event = {
      ...baseEvent,
      deletedAt: 'pending',
      updatedAt: 'invalid',
    };
    const activeCloudEvent: Event = {
      ...baseEvent,
      updatedAt: '2026-06-18T11:05:00.000Z',
    };

    expect(shouldPreserveLocalDeletion(localDeletedEvent, activeCloudEvent, true)).toBe(true);
  });

  it('allows cloud deletion tombstones to flow through', () => {
    const localDeletedEvent: Event = {
      ...baseEvent,
      deletedAt: '2026-06-18T11:00:00.000Z',
      updatedAt: '2026-06-18T11:00:00.000Z',
    };
    const cloudDeletedEvent: Event = {
      ...baseEvent,
      deletedAt: '2026-06-18T11:05:00.000Z',
      updatedAt: '2026-06-18T11:05:00.000Z',
    };

    expect(shouldPreserveLocalDeletion(localDeletedEvent, cloudDeletedEvent)).toBe(false);
  });
});
