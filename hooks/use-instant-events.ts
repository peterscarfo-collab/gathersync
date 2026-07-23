// @ts-nocheck
/**
 * Real-time events hook using InstantDB
 * Provides automatic real-time sync for events and participants
 */
import { db } from '@/lib/db';
import type { Event, Participant } from '@/types/models';

const pendingDeleteEventIds = new Set<string>();

function normalizeDeletedAt(value: unknown): string | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed || trimmed === 'null' || trimmed === 'undefined') {
      return undefined;
    }
    return Number.isNaN(Date.parse(trimmed)) ? undefined : trimmed;
  }
  return undefined;
}

function normalizeEventId(eventId: unknown): string {
  if (typeof eventId !== 'string') {
    throw new Error(`Expected eventId to be a string, received ${typeof eventId}`);
  }

  const trimmed = eventId.trim();
  if (!trimmed) {
    throw new Error('Expected eventId to be a non-empty string');
  }

  return trimmed;
}

async function queryInstantEventById(eventId: string): Promise<any | null | undefined> {
  if (typeof db.queryOnce !== 'function') {
    return undefined;
  }

  const result = await db.queryOnce({
    events: {
      $: {
        where: {
          id: eventId,
        },
      },
      creator: {},
    },
  });

  const events = result?.data?.events ?? result?.events ?? [];
  return events[0] ?? null;
}

function assertCanDeleteEvent(event: any, eventId: string, currentUserId?: string) {
  if (event === undefined || !currentUserId) {
    return;
  }

  if (!event) {
    throw new Error(`Event ${eventId} was not found or is not readable by the current user`);
  }

  const creatorId = event.creator?.id;
  if (creatorId && creatorId !== currentUserId) {
    throw new Error(`Current user is not allowed to delete event ${eventId}`);
  }
}

function dedupeEvents(events: Event[]): Event[] {
  if (events.length <= 1) return events;

  const bySignature = new Map<string, Event>();
  for (const event of events) {
    const signature = [
      event.name,
      event.eventType,
      event.month,
      event.year,
      event.fixedDate,
      event.fixedTime,
    ].join('|');

    const existing = bySignature.get(signature);
    if (!existing) {
      bySignature.set(signature, event);
      continue;
    }

    const existingDeleted = Boolean(existing.deletedAt);
    const candidateDeleted = Boolean(event.deletedAt);

    if (existingDeleted && !candidateDeleted) {
      bySignature.set(signature, event);
      continue;
    }

    if (!existingDeleted && candidateDeleted) {
      continue;
    }

    const existingUpdated = new Date(existing.updatedAt).getTime();
    const candidateUpdated = new Date(event.updatedAt).getTime();
    if (candidateUpdated >= existingUpdated) {
      bySignature.set(signature, event);
    }
  }

  return Array.from(bySignature.values());
}

export function useEvents() {
  // Get the current user from InstantDB auth
  const { user } = db.useAuth();
  const shouldQuery = Boolean(user?.id);
  
  // Query events with participants in real-time
  // Only fetch events created by the current user (permission-filtered)
  const { data, isLoading, error } = db.useQuery(
    shouldQuery
      ? {
          events: {
            creator: {},
            participants: {},
          },
        }
      : null // Don't query if no user
  );

  // Log errors for debugging
  if (error) {
    console.error('[useEvents] Query error:', error);
  }

  // Transform InstantDB data to our Event type
  const events: Event[] = (() => {
    if (!shouldQuery) {
      console.log('[useEvents] No user authenticated');
      return [];
    }
    
    if (!data?.events) {
      console.log('[useEvents] No events data');
      return [];
    }

    console.log('[useEvents] Got', data.events.length, 'events for user', user.id);

    const mapped = data.events
      .filter((event: any) => (
        event.creator?.id === user.id &&
        !pendingDeleteEventIds.has(event.id) &&
        !normalizeDeletedAt(event.deletedAt)
      ))
      .map((event: any) => ({
      id: event.id,
      name: event.name,
      eventType: event.eventType || 'flexible',
      month: event.month,
      year: event.year,
      fixedDate: event.fixedDate,
      fixedTime: event.fixedTime,
      createdAt: event.createdAt,
      updatedAt: event.updatedAt,
      archived: event.archived || false,
      finalized: event.finalized || false,
      finalizedDate: event.finalizedDate,
      teamLeader: event.teamLeader,
      teamLeaderPhone: event.teamLeaderPhone,
      teamLeaderEmail: event.teamLeaderEmail,
      meetingType: event.meetingType,
      venueName: event.venueName,
      venueAddress: event.venueAddress,
      venueContact: event.venueContact,
      venuePhone: event.venuePhone,
      meetingLink: event.meetingLink,
      rsvpDeadline: event.rsvpDeadline,
      meetingNotes: event.meetingNotes,
      reminderDaysBefore: event.reminderDaysBefore,
      reminderScheduled: event.reminderScheduled,
      deletedAt: normalizeDeletedAt(event.deletedAt),
      // Map participants (exclude event back-reference)
      participants: (event.participants || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        phone: p.phone,
        email: p.email,
        availability: p.availability as Record<string, boolean>,
        unavailableAllMonth: p.unavailableAllMonth,
        notes: p.notes,
        source: p.source,
        rsvpStatus: p.rsvpStatus,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        deletedAt: normalizeDeletedAt(p.deletedAt),
      })),
    }));

    return dedupeEvents(mapped);
  })();

  return {
    events,
    isLoading: shouldQuery ? isLoading : false,
    error: shouldQuery ? error : null,
  };
}

export function useEvent(eventId: string | null) {
  // Get the current user from InstantDB auth
  const { user } = db.useAuth();
  
  // Query single event with participants
  const { data, isLoading, error } = db.useQuery(
    user?.id && eventId
      ? {
          events: {
            $: {
              where: {
                id: eventId,
              },
            },
            creator: {},
            participants: {},
          },
        }
      : null
  );

  const event: Event | null = (() => {
    if (!user?.id || !data?.events || data.events.length === 0) return null;

    const e = data.events[0];
    if (pendingDeleteEventIds.has(e.id) || normalizeDeletedAt(e.deletedAt)) return null;
    if (e.creator?.id !== user.id) return null;
    return {
      id: e.id,
      name: e.name,
      eventType: e.eventType || 'flexible',
      month: e.month,
      year: e.year,
      fixedDate: e.fixedDate,
      fixedTime: e.fixedTime,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
      archived: e.archived || false,
      finalized: e.finalized || false,
      finalizedDate: e.finalizedDate,
      teamLeader: e.teamLeader,
      teamLeaderPhone: e.teamLeaderPhone,
      teamLeaderEmail: e.teamLeaderEmail,
      meetingType: e.meetingType,
      venueName: e.venueName,
      venueAddress: e.venueAddress,
      venueContact: e.venueContact,
      venuePhone: e.venuePhone,
      meetingLink: e.meetingLink,
      rsvpDeadline: e.rsvpDeadline,
      meetingNotes: e.meetingNotes,
      reminderDaysBefore: e.reminderDaysBefore,
      reminderScheduled: e.reminderScheduled,
      deletedAt: normalizeDeletedAt(e.deletedAt),
      participants: (e.participants || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        phone: p.phone,
        email: p.email,
        availability: p.availability as Record<string, boolean>,
        unavailableAllMonth: p.unavailableAllMonth,
        notes: p.notes,
        source: p.source,
        rsvpStatus: p.rsvpStatus,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        deletedAt: normalizeDeletedAt(p.deletedAt),
      })),
    };
  })();

  return {
    event,
    isLoading,
    error,
  };
}

interface DeleteEventOptions {
  currentUserId?: string;
}

export async function deleteEvent(eventId: string, options: DeleteEventOptions = {}): Promise<void> {
  const normalizedEventId = normalizeEventId(eventId);
  pendingDeleteEventIds.add(normalizedEventId);

  try {
    const event = await queryInstantEventById(normalizedEventId);
    assertCanDeleteEvent(event, normalizedEventId, options.currentUserId);

    // InstantDB accepts either one chunk or a batch; use the batch form consistently.
    await db.transact([db.tx.events[normalizedEventId].delete()]);

    const deletedEvent = await queryInstantEventById(normalizedEventId);
    if (deletedEvent) {
      throw new Error(`Event ${normalizedEventId} still exists after delete transaction`);
    }
  } catch (error) {
    pendingDeleteEventIds.delete(normalizedEventId);
    throw error;
  }
}

export function useInstantEventMutations() {
  const { user } = db.useAuth();

  return {
    deleteEvent: async (eventId: string): Promise<void> => {
      if (!user?.id) {
        throw new Error('Cannot delete event without an authenticated InstantDB user');
      }

      await deleteEvent(eventId, { currentUserId: user.id });
    },
  };
}
