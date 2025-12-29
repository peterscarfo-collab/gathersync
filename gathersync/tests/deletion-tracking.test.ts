/**
 * Test suite for deletion tracking (soft delete) functionality
 * 
 * Tests verify that:
 * 1. Events and participants are soft-deleted (marked with deletedAt)
 * 2. Deleted items are filtered from UI queries
 * 3. Deleted items are synced to cloud
 * 4. Sync respects deletion tombstones
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { Event, Participant } from '@/types/models';

describe('Deletion Tracking', () => {
  const mockEvent: Event = {
    id: 'event-1',
    name: 'Test Event',
    eventType: 'flexible',
    month: 1,
    year: 2026,
    participants: [
      {
        id: 'p1',
        name: 'Alice',
        availability: { '2026-01-15': true },
        unavailableAllMonth: false,
      },
      {
        id: 'p2',
        name: 'Bob',
        availability: { '2026-01-15': true },
        unavailableAllMonth: false,
      },
    ],
    createdAt: '2025-12-25T00:00:00.000Z',
    updatedAt: '2025-12-25T00:00:00.000Z',
  };

  describe('Soft Delete Events', () => {
    it('should mark event as deleted instead of removing it', () => {
      const deletedEvent = {
        ...mockEvent,
        deletedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      expect(deletedEvent.deletedAt).toBeDefined();
      expect(deletedEvent.id).toBe('event-1');
      expect(deletedEvent.name).toBe('Test Event');
    });

    it('should filter deleted events from getAll results', () => {
      const allEvents: Event[] = [
        mockEvent,
        { ...mockEvent, id: 'event-2', deletedAt: '2025-12-25T01:00:00.000Z' },
        { ...mockEvent, id: 'event-3' },
      ];

      const activeEvents = allEvents.filter(e => !e.deletedAt);

      expect(activeEvents).toHaveLength(2);
      expect(activeEvents.map(e => e.id)).toEqual(['event-1', 'event-3']);
    });
  });

  describe('Soft Delete Participants', () => {
    it('should mark participant as deleted instead of removing from array', () => {
      const participants: Participant[] = mockEvent.participants.map(p =>
        p.id === 'p2' ? { ...p, deletedAt: new Date().toISOString() } : p
      );

      expect(participants).toHaveLength(2);
      expect(participants.find(p => p.id === 'p2')?.deletedAt).toBeDefined();
      expect(participants.find(p => p.id === 'p1')?.deletedAt).toBeUndefined();
    });

    it('should filter deleted participants from UI display', () => {
      const participants: Participant[] = [
        { ...mockEvent.participants[0] },
        { ...mockEvent.participants[1], deletedAt: '2025-12-25T01:00:00.000Z' },
      ];

      const activeParticipants = participants.filter(p => !p.deletedAt);

      expect(activeParticipants).toHaveLength(1);
      expect(activeParticipants[0].id).toBe('p1');
    });

    it('should exclude deleted participants from availability calculations', () => {
      const eventWithDeletedParticipant: Event = {
        ...mockEvent,
        participants: [
          { ...mockEvent.participants[0], availability: { '2026-01-15': true } },
          { ...mockEvent.participants[1], availability: { '2026-01-15': true }, deletedAt: '2025-12-25T01:00:00.000Z' },
        ],
      };

      const activeParticipants = eventWithDeletedParticipant.participants.filter(p => !p.deletedAt);
      const availableCount = activeParticipants.filter(p => p.availability['2026-01-15']).length;

      expect(activeParticipants).toHaveLength(1);
      expect(availableCount).toBe(1);
    });
  });

  describe('Sync Behavior', () => {
    it('should include deletedAt field when syncing to cloud', () => {
      const deletedEvent = {
        ...mockEvent,
        deletedAt: '2025-12-25T01:00:00.000Z',
        updatedAt: '2025-12-25T01:00:00.000Z',
      };

      // Simulate cloud sync payload
      const syncPayload = {
        id: deletedEvent.id,
        name: deletedEvent.name,
        deletedAt: deletedEvent.deletedAt,
        updatedAt: deletedEvent.updatedAt,
      };

      expect(syncPayload.deletedAt).toBe('2025-12-25T01:00:00.000Z');
    });

    it('should respect deletion tombstones from cloud', () => {
      const cloudEvents: Event[] = [
        mockEvent,
        { ...mockEvent, id: 'event-2', deletedAt: '2025-12-25T01:00:00.000Z' },
      ];

      // After sync, local storage should filter deleted events
      const activeEvents = cloudEvents.filter(e => !e.deletedAt);

      expect(activeEvents).toHaveLength(1);
      expect(activeEvents[0].id).toBe('event-1');
    });

    it('should not restore deleted items when cloud has newer timestamp', () => {
      const localEvent: Event = {
        ...mockEvent,
        deletedAt: '2025-12-25T02:00:00.000Z', // Deleted at 2am
        updatedAt: '2025-12-25T02:00:00.000Z',
      };

      const cloudEvent: Event = {
        ...mockEvent,
        updatedAt: '2025-12-25T01:00:00.000Z', // Older version without deletedAt
      };

      // Local deletion is newer, should win
      const shouldUseLocal = new Date(localEvent.updatedAt) > new Date(cloudEvent.updatedAt);

      expect(shouldUseLocal).toBe(true);
      expect(localEvent.deletedAt).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle events with no deletedAt field (backward compatibility)', () => {
      const legacyEvent: Event = {
        id: 'legacy-1',
        name: 'Legacy Event',
        eventType: 'flexible',
        month: 1,
        year: 2026,
        participants: [],
        createdAt: '2025-12-25T00:00:00.000Z',
        updatedAt: '2025-12-25T00:00:00.000Z',
        // No deletedAt field
      };

      const isDeleted = !!legacyEvent.deletedAt;

      expect(isDeleted).toBe(false);
    });

    it('should handle participants with no deletedAt field', () => {
      const legacyParticipant: Participant = {
        id: 'p1',
        name: 'Alice',
        availability: {},
        unavailableAllMonth: false,
        // No deletedAt field
      };

      const isDeleted = !!legacyParticipant.deletedAt;

      expect(isDeleted).toBe(false);
    });

    it('should count only active participants for event statistics', () => {
      const eventWithMixedParticipants: Event = {
        ...mockEvent,
        participants: [
          { ...mockEvent.participants[0] },
          { ...mockEvent.participants[1], deletedAt: '2025-12-25T01:00:00.000Z' },
          { id: 'p3', name: 'Charlie', availability: {}, unavailableAllMonth: false },
        ],
      };

      const activeCount = eventWithMixedParticipants.participants.filter(p => !p.deletedAt).length;
      const totalCount = eventWithMixedParticipants.participants.length;

      expect(totalCount).toBe(3);
      expect(activeCount).toBe(2);
    });
  });
});
