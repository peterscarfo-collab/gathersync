/**
 * InstantDB mutation helpers for events and participants
 * Provides optimistic updates and real-time sync
 */
import { db } from '@/lib/db';
import { tx, id } from '@instantdb/react';
import type { Event, Participant } from '@/types/models';

export const eventMutations = {
  /**
   * Create a new event with participants
   * Must be called when user is authenticated
   */
  async createEvent(event: Event, userId: string) {
    const eventId = event.id || id();
    const now = new Date().toISOString();

    // Create event and link to creator
    await db.transact([
      tx.events[eventId]
        .update({
          name: event.name,
          eventType: event.eventType || 'flexible',
          month: event.month,
          year: event.year,
          fixedDate: event.fixedDate,
          fixedTime: event.fixedTime,
          archived: event.archived || false,
          finalized: event.finalized || false,
          finalizedDate: event.finalizedDate,
          teamLeader: event.teamLeader,
          teamLeaderPhone: event.teamLeaderPhone,
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
          createdAt: now,
          updatedAt: now,
        })
        .link({ creator: userId }), // Link event to creator
    ]);

    // Create participants if any
    if (event.participants && event.participants.length > 0) {
      const participantTransactions = event.participants.map((p) => {
        const participantId = id();
        return tx.participants[participantId]
          .update({
            name: p.name,
            phone: p.phone,
            email: p.email,
            availability: p.availability || {},
            unavailableAllMonth: p.unavailableAllMonth || false,
            notes: p.notes,
            source: p.source || 'manual',
            rsvpStatus: p.rsvpStatus || 'no-response',
            createdAt: now,
            updatedAt: now,
          })
          .link({ event: eventId });
      });

      await db.transact(participantTransactions);
    }

    return eventId;
  },

  /**
   * Update an existing event
   */
  async updateEvent(eventId: string, updates: Partial<Event>) {
    const now = new Date().toISOString();
    
    const { participants, ...eventUpdates } = updates;

    await db.transact([
      tx.events[eventId].update({
        ...eventUpdates,
        updatedAt: now,
      }),
    ]);
  },

  /**
   * Delete an event (soft delete)
   */
  async deleteEvent(eventId: string) {
    await db.transact([
      tx.events[eventId].update({
        deletedAt: new Date().toISOString(),
      }),
    ]);
  },

  /**
   * Add a participant to an event
   */
  async addParticipant(eventId: string, participant: Omit<Participant, 'id' | 'createdAt' | 'updatedAt'>) {
    const participantId = id();
    const now = new Date().toISOString();

    await db.transact([
      tx.participants[participantId]
        .update({
          name: participant.name,
          phone: participant.phone,
          email: participant.email,
          availability: participant.availability || {},
          unavailableAllMonth: participant.unavailableAllMonth || false,
          notes: participant.notes,
          source: participant.source || 'manual',
          rsvpStatus: participant.rsvpStatus || 'no-response',
          createdAt: now,
          updatedAt: now,
        })
        .link({ event: eventId }),
    ]);

    return participantId;
  },

  /**
   * Update a participant
   */
  async updateParticipant(participantId: string, updates: Partial<Participant>) {
    const now = new Date().toISOString();

    await db.transact([
      tx.participants[participantId].update({
        ...updates,
        updatedAt: now,
      }),
    ]);
  },

  /**
   * Delete a participant (soft delete)
   */
  async deleteParticipant(participantId: string) {
    await db.transact([
      tx.participants[participantId].update({
        deletedAt: new Date().toISOString(),
      }),
    ]);
  },

  /**
   * Update participant availability for a specific date
   */
  async updateAvailability(participantId: string, date: string, available: boolean) {
    const now = new Date().toISOString();

    // Fetch current participant to merge availability
    const { data } = await db.query({
      participants: {
        $: {
          where: {
            id: participantId,
          },
        },
      },
    });

    if (data.participants.length > 0) {
      const currentAvailability = data.participants[0].availability || {};
      
      await db.transact([
        tx.participants[participantId].update({
          availability: {
            ...currentAvailability,
            [date]: available,
          },
          updatedAt: now,
        }),
      ]);
    }
  },
};
