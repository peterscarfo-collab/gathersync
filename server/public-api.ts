import { Router } from "express";
import * as db from "./db";

/**
 * Public REST API endpoints (no authentication required)
 * Used for web-based event sharing and RSVP
 */
export const publicApiRouter = Router();

// Debug endpoint to test database connection
publicApiRouter.get("/debug/db-test", async (req, res) => {
  try {
    const hasDbUrl = !!process.env.DATABASE_URL;
    const allEvents = await db.getUserEvents(1); // Try to get events for user 1
    res.json({
      hasDbUrl,
      eventCount: allEvents.length,
      firstEventId: allEvents[0]?.id || null,
    });
  } catch (error: any) {
    res.json({ error: error.message, stack: error.stack });
  }
});

// Get event by ID (public access)
publicApiRouter.get("/events/:eventId", async (req, res) => {
  try {
    const { eventId } = req.params;
    console.log('[PublicAPI] Fetching event:', eventId);
    console.log('[PublicAPI] DATABASE_URL exists:', !!process.env.DATABASE_URL);
    const event = await db.getEventById(eventId);
    console.log('[PublicAPI] Event found:', event ? 'yes' : 'no');
    if (event) {
      console.log('[PublicAPI] Event name:', event.name);
    }
    
    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    const participants = await db.getEventParticipants(eventId);

    // Convert database types to app types
    const response = {
      id: event.id,
      userId: event.userId,
      name: event.name,
      eventType: event.eventType,
      month: event.month,
      year: event.year,
      fixedDate: event.fixedDate || undefined,
      fixedTime: event.fixedTime || undefined,
      reminderDaysBefore: event.reminderDaysBefore || undefined,
      reminderScheduled: event.reminderScheduled || undefined,
      archived: event.archived || undefined,
      finalized: event.finalized || undefined,
      finalizedDate: event.finalizedDate || undefined,
      teamLeader: event.teamLeader || undefined,
      teamLeaderPhone: event.teamLeaderPhone || undefined,
      meetingType: event.meetingType || undefined,
      venueName: event.venueName || undefined,
      venueContact: event.venueContact || undefined,
      venuePhone: event.venuePhone || undefined,
      meetingLink: event.meetingLink || undefined,
      rsvpDeadline: event.rsvpDeadline || undefined,
      meetingNotes: event.meetingNotes || undefined,
      createdAt: event.createdAt.toISOString(),
      updatedAt: event.updatedAt.toISOString(),
      participants: participants.map((p) => ({
        id: p.id,
        eventId: p.eventId,
        name: p.name,
        availability: p.availability,
        unavailableAllMonth: p.unavailableAllMonth,
        notes: p.notes || undefined,
        source: p.source || undefined,
        phone: p.phone || undefined,
        email: p.email || undefined,
        rsvpStatus: p.rsvpStatus || undefined,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      })),
    };

    res.json(response);
  } catch (error) {
    console.error("[PublicAPI] Error fetching event:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update participant availability/RSVP (public access)
publicApiRouter.post("/events/:eventId/participants", async (req, res) => {
  try {
    const { eventId } = req.params;
    const { participantName, availability, rsvpStatus } = req.body;

    if (!participantName) {
      return res.status(400).json({ error: "participantName is required" });
    }

    const event = await db.getEventById(eventId);
    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    // Get participants for this event
    const eventParticipants = await db.getEventParticipants(eventId);

    // Find existing participant
    const existingParticipant = eventParticipants.find(
      (p) => p.name.toLowerCase() === participantName.toLowerCase()
    );

    if (existingParticipant) {
      // Update existing participant
      await db.updateParticipant(existingParticipant.id, {
        availability: availability as Record<string, boolean> | undefined,
        rsvpStatus: rsvpStatus as "attending" | "not-attending" | "no-response" | undefined,
      });
    } else {
      // Create new participant
      await db.createParticipant({
        id: `participant-${Date.now()}`,
        eventId: eventId,
        name: participantName,
        availability: (availability as Record<string, boolean>) || {},
        unavailableAllMonth: false,
        source: "manual",
        rsvpStatus: (rsvpStatus as "attending" | "not-attending" | "no-response") || "no-response",
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("[PublicAPI] Error updating participant:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
