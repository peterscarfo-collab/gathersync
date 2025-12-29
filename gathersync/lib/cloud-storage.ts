import type { Event, Participant, EventSnapshot, GroupTemplate } from '@/types/models';
import { QueryClient } from '@tanstack/react-query';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import superjson from 'superjson';
import type { AppRouter } from '@/server/routers';
import { getApiBaseUrl } from '@/constants/oauth';
import * as Auth from '@/lib/auth';

/**
 * Cloud storage adapter using tRPC client
 * Replaces AsyncStorage with cloud database sync
 */

// Timeout wrapper to prevent infinite hangs
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, operation: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${operation} timed out after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
}

// Create a standalone tRPC client for imperative calls
function getTRPCClient() {
  return createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: `${getApiBaseUrl()}/api/trpc`,
        transformer: superjson,
        async headers() {
          const token = await Auth.getSessionToken();
          console.log('[CloudStorage] Session token for API call:', token ? `present (${token.substring(0, 20)}...)` : 'missing');
          return token ? { Authorization: `Bearer ${token}` } : {};
        },
        fetch(url, options) {
          console.log('[CloudStorage] Making API call to:', url);
          return fetch(url, {
            ...options,
            credentials: 'include',
          });
        },
      }),
    ],
  });
}

export const eventsCloudStorage = {
  async getAll(): Promise<Event[]> {
    try {
      console.log('[CloudStorage] getAll: Creating tRPC client...');
      const client = getTRPCClient();
      console.log('[CloudStorage] getAll: Calling events.list.query...');
      const events = await withTimeout(
        client.events.list.query(),
        10000, // 10 second timeout
        'Fetch events list'
      );
      console.log('[CloudStorage] getAll: Received', events.length, 'events');
      
      // Fetch participants for all events in parallel
      console.log('[CloudStorage] Fetching participants for all events in parallel...');
      const eventsWithParticipants = await withTimeout(
        Promise.all(
          events.map(async (event) => {
            const participants = await client.participants.list.query({ eventId: event.id });
            
            return {
              id: event.id,
              name: event.name,
              eventType: event.eventType || 'flexible',
              month: event.month,
              year: event.year,
              fixedDate: event.fixedDate,
              fixedTime: event.fixedTime,
              createdAt: event.createdAt.toISOString(),
              updatedAt: event.updatedAt.toISOString(),
              participants: participants.map((p) => ({
                id: p.id,
                name: p.name,
                phone: p.phone,
                email: p.email,
                availability: p.availability as Record<string, boolean>,
                unavailableAllMonth: p.unavailableAllMonth,
                notes: p.notes,
                source: p.source,
                rsvpStatus: p.rsvpStatus,
                deletedAt: p.deletedAt?.toISOString(),
              })),
              archived: event.archived,
              finalized: event.finalized,
              finalizedDate: event.finalizedDate,
              teamLeader: event.teamLeader,
              teamLeaderPhone: event.teamLeaderPhone,
              meetingType: event.meetingType,
              venueName: event.venueName,
              venueContact: event.venueContact,
              venuePhone: event.venuePhone,
              meetingLink: event.meetingLink,
              rsvpDeadline: event.rsvpDeadline,
              meetingNotes: event.meetingNotes,
              reminderDaysBefore: event.reminderDaysBefore,
              reminderScheduled: event.reminderScheduled,
              deletedAt: event.deletedAt?.toISOString(),
            };
          })
        ),
        20000, // 20 second timeout for all events + participants
        'Fetch all events with participants'
      );
      
      console.log('[CloudStorage] Successfully fetched all events with participants');
      // Filter out soft-deleted events
      const activeEvents = (eventsWithParticipants as Event[]).filter(e => !e.deletedAt);
      console.log(`[CloudStorage] Returning ${activeEvents.length} active events (${eventsWithParticipants.length - activeEvents.length} deleted)`);
      return activeEvents;
    } catch (error) {
      console.error('[CloudStorage] Failed to fetch events:', error);
      return [];
    }
  },

  async getById(id: string): Promise<Event | null> {
    try {
      const client = getTRPCClient();
      const event = await client.events.get.query({ id });
      
      if (!event) return null;

      const participants = await client.participants.list.query({ eventId: id });
      
      return {
        id: event.id,
        name: event.name,
        month: event.month,
        year: event.year,
        createdAt: event.createdAt.toISOString(),
        updatedAt: event.updatedAt.toISOString(),
        participants: participants.map((p) => ({
          id: p.id,
          name: p.name,
          availability: p.availability as Record<string, boolean>,
          unavailableAllMonth: p.unavailableAllMonth,
        })),
      } as Event;
    } catch (error) {
      console.error('Failed to fetch event:', error);
      return null;
    }
  },

  async add(event: Event): Promise<void> {
    try {
      const client = getTRPCClient();
      
      console.log('[CloudStorage] Creating event:', event.name);
      
      // Build event creation payload with only non-null fields
      const eventPayload: any = {
        id: event.id,
        name: event.name,
        eventType: event.eventType || 'flexible',
      };
      if (event.month !== null && event.month !== undefined) eventPayload.month = event.month;
      if (event.year !== null && event.year !== undefined) eventPayload.year = event.year;
      if (event.fixedDate !== null && event.fixedDate !== undefined) eventPayload.fixedDate = event.fixedDate;
      if (event.fixedTime !== null && event.fixedTime !== undefined) eventPayload.fixedTime = event.fixedTime;
      if (event.reminderDaysBefore !== null && event.reminderDaysBefore !== undefined) eventPayload.reminderDaysBefore = event.reminderDaysBefore;
      if (event.reminderScheduled !== null && event.reminderScheduled !== undefined) eventPayload.reminderScheduled = event.reminderScheduled;
      if (event.archived !== null && event.archived !== undefined) eventPayload.archived = event.archived;
      if (event.finalized !== null && event.finalized !== undefined) eventPayload.finalized = event.finalized;
      if (event.finalizedDate !== null && event.finalizedDate !== undefined) eventPayload.finalizedDate = event.finalizedDate;
      if (event.teamLeader !== null && event.teamLeader !== undefined) eventPayload.teamLeader = event.teamLeader;
      if (event.teamLeaderPhone !== null && event.teamLeaderPhone !== undefined) eventPayload.teamLeaderPhone = event.teamLeaderPhone;
      if (event.meetingType !== null && event.meetingType !== undefined) eventPayload.meetingType = event.meetingType;
      if (event.venueName !== null && event.venueName !== undefined) eventPayload.venueName = event.venueName;
      if (event.venueContact !== null && event.venueContact !== undefined) eventPayload.venueContact = event.venueContact;
      if (event.venuePhone !== null && event.venuePhone !== undefined) eventPayload.venuePhone = event.venuePhone;
      if (event.meetingLink !== null && event.meetingLink !== undefined) eventPayload.meetingLink = event.meetingLink;
      if (event.rsvpDeadline !== null && event.rsvpDeadline !== undefined) eventPayload.rsvpDeadline = event.rsvpDeadline;
      if (event.meetingNotes !== null && event.meetingNotes !== undefined) eventPayload.meetingNotes = event.meetingNotes;
      if (event.deletedAt !== undefined) eventPayload.deletedAt = event.deletedAt ? new Date(event.deletedAt) : null;

      console.log('[CloudStorage] Event payload:', JSON.stringify(eventPayload, null, 2));
      
      await withTimeout(
        client.events.create.mutate(eventPayload),
        30000, // 30 second timeout
        `Create event ${event.name}`
      );

      // Add participants in parallel for speed
      if (event.participants && event.participants.length > 0) {
        console.log(`[CloudStorage] Uploading ${event.participants.length} participants in parallel...`);
        await withTimeout(
          Promise.all(
            event.participants.map((participant) => {
              // Build participant payload with only non-null fields
              const participantPayload: any = {
                id: participant.id,
                eventId: event.id,
                name: participant.name,
              };
              if (participant.availability !== null && participant.availability !== undefined) participantPayload.availability = participant.availability;
              if (participant.unavailableAllMonth !== null && participant.unavailableAllMonth !== undefined) participantPayload.unavailableAllMonth = participant.unavailableAllMonth;
              if (participant.notes !== null && participant.notes !== undefined) participantPayload.notes = participant.notes;
              if (participant.source !== null && participant.source !== undefined) participantPayload.source = participant.source;
              if (participant.phone !== null && participant.phone !== undefined) participantPayload.phone = participant.phone;
              if (participant.email !== null && participant.email !== undefined) participantPayload.email = participant.email;
              if (participant.rsvpStatus !== null && participant.rsvpStatus !== undefined) participantPayload.rsvpStatus = participant.rsvpStatus;
              if (participant.deletedAt !== undefined) participantPayload.deletedAt = participant.deletedAt ? new Date(participant.deletedAt) : null;
              
              return client.participants.create.mutate(participantPayload);
            })
          ),
          30000, // 30 second timeout for all participants
          `Upload ${event.participants.length} participants`
        );
        console.log(`[CloudStorage] All participants uploaded successfully`);
      }
    } catch (error) {
      console.error('[CloudStorage] Failed to create event:', event.name);
      console.error('[CloudStorage] Error details:', error);
      if (error instanceof Error) {
        console.error('[CloudStorage] Error message:', error.message);
        console.error('[CloudStorage] Error stack:', error.stack);
      }
      throw error;
    }
  },

  async update(id: string, updates: Partial<Event>): Promise<void> {
    try {
      const client = getTRPCClient();
      
      // Update event basic info with timeout
      // Build update payload with only defined and non-null fields
      const eventUpdatePayload: any = { id };
      if (updates.name !== undefined && updates.name !== null) eventUpdatePayload.name = updates.name;
      if (updates.eventType !== undefined && updates.eventType !== null) eventUpdatePayload.eventType = updates.eventType;
      if (updates.month !== undefined && updates.month !== null) eventUpdatePayload.month = updates.month;
      if (updates.year !== undefined && updates.year !== null) eventUpdatePayload.year = updates.year;
      if (updates.fixedDate !== undefined && updates.fixedDate !== null) eventUpdatePayload.fixedDate = updates.fixedDate;
      if (updates.fixedTime !== undefined && updates.fixedTime !== null) eventUpdatePayload.fixedTime = updates.fixedTime;
      if (updates.reminderDaysBefore !== undefined && updates.reminderDaysBefore !== null) eventUpdatePayload.reminderDaysBefore = updates.reminderDaysBefore;
      if (updates.reminderScheduled !== undefined && updates.reminderScheduled !== null) eventUpdatePayload.reminderScheduled = updates.reminderScheduled;
      if (updates.archived !== undefined && updates.archived !== null) eventUpdatePayload.archived = updates.archived;
      if (updates.finalized !== undefined && updates.finalized !== null) eventUpdatePayload.finalized = updates.finalized;
      if (updates.finalizedDate !== undefined && updates.finalizedDate !== null) eventUpdatePayload.finalizedDate = updates.finalizedDate;
      if (updates.teamLeader !== undefined && updates.teamLeader !== null) eventUpdatePayload.teamLeader = updates.teamLeader;
      if (updates.teamLeaderPhone !== undefined && updates.teamLeaderPhone !== null) eventUpdatePayload.teamLeaderPhone = updates.teamLeaderPhone;
      if (updates.meetingType !== undefined && updates.meetingType !== null) eventUpdatePayload.meetingType = updates.meetingType;
      if (updates.venueName !== undefined && updates.venueName !== null) eventUpdatePayload.venueName = updates.venueName;
      if (updates.venueContact !== undefined && updates.venueContact !== null) eventUpdatePayload.venueContact = updates.venueContact;
      if (updates.venuePhone !== undefined && updates.venuePhone !== null) eventUpdatePayload.venuePhone = updates.venuePhone;
      if (updates.meetingLink !== undefined && updates.meetingLink !== null) eventUpdatePayload.meetingLink = updates.meetingLink;
      if (updates.rsvpDeadline !== undefined && updates.rsvpDeadline !== null) eventUpdatePayload.rsvpDeadline = updates.rsvpDeadline;
      if (updates.meetingNotes !== undefined && updates.meetingNotes !== null) eventUpdatePayload.meetingNotes = updates.meetingNotes;
      if (updates.deletedAt !== undefined) eventUpdatePayload.deletedAt = updates.deletedAt ? new Date(updates.deletedAt) : null;

      // Only call update if there are fields to update beyond the ID
      if (Object.keys(eventUpdatePayload).length > 1) {
        console.log(`[CloudStorage] Updating event with payload:`, eventUpdatePayload);
        await withTimeout(
          client.events.update.mutate(eventUpdatePayload),
          30000,
          `Update event ${id}`
        );
      }

      // Update participants if provided
      if (updates.participants) {
        console.log(`[CloudStorage] Updating participants for event ${id}...`);
        const existingParticipants = await withTimeout(
          client.participants.list.query({ eventId: id }),
          10000,
          'Fetch existing participants'
        );
        const existingIds = new Set(existingParticipants.map((p) => p.id));
        const newIds = new Set(updates.participants.map((p) => p.id));

        // Delete removed participants in parallel
        const participantsToDelete = existingParticipants.filter((p) => !newIds.has(p.id));
        if (participantsToDelete.length > 0) {
          console.log(`[CloudStorage] Deleting ${participantsToDelete.length} removed participants...`);
          await withTimeout(
            Promise.all(
              participantsToDelete.map((p) => client.participants.delete.mutate({ id: p.id }))
            ),
            10000,
            `Delete ${participantsToDelete.length} participants`
          );
        }

        // Add or update participants in parallel
        console.log(`[CloudStorage] Updating/creating ${updates.participants.length} participants in parallel...`);
        await withTimeout(
          Promise.all(
            updates.participants.map((participant) => {
              // Build payload with only non-null fields
              const payload: any = {
                id: participant.id,
                eventId: id,
                name: participant.name,
              };
              if (participant.availability !== null && participant.availability !== undefined) payload.availability = participant.availability;
              if (participant.unavailableAllMonth !== null && participant.unavailableAllMonth !== undefined) payload.unavailableAllMonth = participant.unavailableAllMonth;
              if (participant.notes !== null && participant.notes !== undefined) payload.notes = participant.notes;
              if (participant.source !== null && participant.source !== undefined) payload.source = participant.source;
              if (participant.phone !== null && participant.phone !== undefined) payload.phone = participant.phone;
              if (participant.email !== null && participant.email !== undefined) payload.email = participant.email;
              if (participant.rsvpStatus !== null && participant.rsvpStatus !== undefined) payload.rsvpStatus = participant.rsvpStatus;
              if (participant.deletedAt !== undefined) payload.deletedAt = participant.deletedAt ? new Date(participant.deletedAt) : null;

              if (existingIds.has(participant.id)) {
                // Update existing
                return client.participants.update.mutate(payload);
              } else {
                // Add new
                return client.participants.create.mutate(payload);
              }
            })
          ),
          30000,
          `Update/create ${updates.participants.length} participants`
        );
        console.log(`[CloudStorage] Participants updated successfully`);
      }
    } catch (error) {
      console.error('Failed to update event:', error);
      throw error;
    }
  },

  async delete(id: string): Promise<void> {
    try {
      const client = getTRPCClient();
      await client.events.delete.mutate({ id });
    } catch (error) {
      console.error('Failed to delete event:', error);
      throw error;
    }
  },
};

export const snapshotsCloudStorage = {
  async getAll(): Promise<EventSnapshot[]> {
    try {
      const client = getTRPCClient();
      const snapshots = await client.snapshots.list.query();
      
      return snapshots.map((s) => ({
        id: s.id,
        eventId: s.eventId,
        name: s.name,
        savedAt: s.savedAt.toISOString(),
        event: s.eventData,
      }));
    } catch (error) {
      console.error('Failed to fetch snapshots:', error);
      return [];
    }
  },

  async add(snapshot: EventSnapshot): Promise<void> {
    try {
      const client = getTRPCClient();
      await client.snapshots.create.mutate({
        id: snapshot.id,
        eventId: snapshot.eventId,
        name: snapshot.name,
        eventData: snapshot.event,
      });
    } catch (error) {
      console.error('Failed to create snapshot:', error);
      throw error;
    }
  },

  async delete(id: string): Promise<void> {
    try {
      const client = getTRPCClient();
      await client.snapshots.delete.mutate({ id });
    } catch (error) {
      console.error('Failed to delete snapshot:', error);
      throw error;
    }
  },
};

export const templatesCloudStorage = {
  async getAll(): Promise<GroupTemplate[]> {
    try {
      const client = getTRPCClient();
      const templates = await client.templates.list.query();
      
      return templates.map((t) => ({
        id: t.id,
        name: t.name,
        participantNames: t.participantNames as string[],
        createdAt: t.createdAt.toISOString(),
      }));
    } catch (error) {
      console.error('Failed to fetch templates:', error);
      return [];
    }
  },

  async add(template: GroupTemplate): Promise<void> {
    try {
      const client = getTRPCClient();
      await client.templates.create.mutate({
        id: template.id,
        name: template.name,
        participantNames: template.participantNames,
      });
    } catch (error) {
      console.error('Failed to create template:', error);
      throw error;
    }
  },

  async delete(id: string): Promise<void> {
    try {
      const client = getTRPCClient();
      await client.templates.delete.mutate({ id });
    } catch (error) {
      console.error('Failed to delete template:', error);
      throw error;
    }
  },
};
