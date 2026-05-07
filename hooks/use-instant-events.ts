// @ts-nocheck
/**
 * Real-time events hook using InstantDB
 * Provides automatic real-time sync for events and participants
 */
import { useCallback, useState } from "react";
import { db } from "@/lib/db";
import type { Event, Participant } from "@/types/models";

function normalizeEventId(value: unknown): string {
  if (typeof value !== "string") {
    const received = Array.isArray(value) ? "array" : typeof value;
    throw new Error(
      `[useEvents] Expected eventId to be a string, received ${received}. ` +
        "Pass event.id instead of the event object.",
    );
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("[useEvents] Expected eventId to be a non-empty string");
  }

  return trimmed;
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operation: string,
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new Error(`${operation} timed out after ${timeoutMs}ms`)),
        timeoutMs,
      ),
    ),
  ]);
}

function normalizeDeletedAt(value: unknown): string | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed || trimmed === "null" || trimmed === "undefined") {
      return undefined;
    }
    return Number.isNaN(Date.parse(trimmed)) ? undefined : trimmed;
  }
  return undefined;
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
    ].join("|");

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
  const [pendingDeletedEventIds, setPendingDeletedEventIds] = useState<
    Set<string>
  >(new Set());

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
      : null, // Don't query if no user
  );

  // Log errors for debugging
  if (error) {
    console.error("[useEvents] Query error:", error);
  }

  // Transform InstantDB data to our Event type
  const events: Event[] = (() => {
    if (!shouldQuery) {
      console.log("[useEvents] No user authenticated");
      return [];
    }

    if (!data?.events) {
      console.log("[useEvents] No events data");
      return [];
    }

    console.log(
      "[useEvents] Got",
      data.events.length,
      "events for user",
      user.id,
    );

    const mapped = data.events
      .filter((event: any) => event.creator?.id === user.id)
      .filter((event: any) => !pendingDeletedEventIds.has(event.id))
      .map((event: any) => ({
        id: event.id,
        name: event.name,
        eventType: event.eventType || "flexible",
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

  const deleteEvent = useCallback(
    async (eventId: unknown) => {
      const normalizedEventId = normalizeEventId(eventId);

      if (!user?.id) {
        throw new Error(
          "[useEvents] Cannot delete event without an authenticated InstantDB user",
        );
      }

      setPendingDeletedEventIds((previous) =>
        new Set(previous).add(normalizedEventId),
      );

      try {
        const { data: existingData } = await withTimeout(
          db.queryOnce({
            events: {
              $: {
                where: {
                  id: normalizedEventId,
                },
              },
              creator: {},
            },
          }),
          10000,
          `Fetch event ${normalizedEventId} before delete`,
        );

        const event = existingData?.events?.[0];
        if (!event) {
          throw new Error(
            `[useEvents] Event ${normalizedEventId} was not readable before delete. ` +
              "Confirm the current user owns the event and InstantDB permissions allow reads.",
          );
        }

        if (event.creator?.id !== user.id) {
          throw new Error(
            `[useEvents] User ${user.id} cannot delete event ${normalizedEventId} owned by ${event.creator?.id || "unknown"}`,
          );
        }

        // InstantDB accepts a transaction chunk array; using an array avoids delete sync hangs
        // seen when a single delete chunk is passed directly.
        await withTimeout(
          db.transact([db.tx.events[normalizedEventId].delete()]),
          10000,
          `Delete event ${normalizedEventId}`,
        );

        const { data: verifyData } = await withTimeout(
          db.queryOnce({
            events: {
              $: {
                where: {
                  id: normalizedEventId,
                },
              },
            },
          }),
          10000,
          `Verify event ${normalizedEventId} deletion`,
        );

        if (
          verifyData?.events?.some(
            (event: any) => event.id === normalizedEventId,
          )
        ) {
          throw new Error(
            `[useEvents] Delete transaction completed, but event ${normalizedEventId} is still readable. ` +
              "Check InstantDB delete permissions for the events collection.",
          );
        }
      } catch (error) {
        setPendingDeletedEventIds((previous) => {
          const next = new Set(previous);
          next.delete(normalizedEventId);
          return next;
        });
        console.error(
          "[useEvents] Failed to delete event:",
          normalizedEventId,
          error,
        );
        throw error;
      }
    },
    [user?.id],
  );

  return {
    events,
    isLoading: shouldQuery ? isLoading : false,
    error: shouldQuery ? error : null,
    deleteEvent,
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
      : null,
  );

  const event: Event | null = (() => {
    if (!user?.id || !data?.events || data.events.length === 0) return null;

    const e = data.events[0];
    if (e.creator?.id !== user.id) return null;
    return {
      id: e.id,
      name: e.name,
      eventType: e.eventType || "flexible",
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
