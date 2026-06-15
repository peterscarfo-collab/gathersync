import { z } from "zod";
import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import * as db from "./db";
import * as notifications from "./notifications";
import { sendInvitationEmail } from "./email";
import { adminRouter } from "./routers/admin";
import { trialRouter } from "./routers/trial";
import { subscriptionRouter } from "./routers/subscription";

const sessionKindEnum = z.enum(["talk", "breakfast", "lunch", "dinner", "coffee", "break"]);

export const appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // Public endpoints (no authentication required)
  public: router({
    // Get event by ID with participants (public access for sharing)
    getEvent: publicProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ input }) => {
        const event = await db.getEventById(input.id);
        if (!event) return null;
        
        const participants = await db.getEventParticipants(input.id);
        return {
          id: event.id,
          userId: event.userId,
          name: event.name,
          eventType: event.eventType,
          month: event.month,
          year: event.year,
          fixedDate: event.fixedDate || undefined,
          fixedTime: event.fixedTime || undefined,
          reminderDaysBefore: event.reminderDaysBefore || undefined,
          reminderScheduled: event.reminderScheduled ?? undefined,
          archived: event.archived ?? undefined,
          finalized: event.finalized ?? undefined,
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
          hideAttendeeNames: event.hideAttendeeNames ?? undefined,
          showAttendeeNames: event.showAttendeeNames ?? undefined,
          showAttendeeEmails: event.showAttendeeEmails ?? undefined,
          showAttendeePhones: event.showAttendeePhones ?? undefined,
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
            designation: p.designation || undefined,
            organization: p.organization || undefined,
            leadSource: p.leadSource || undefined,
            rsvpStatus: p.rsvpStatus || undefined,
            createdAt: p.createdAt.toISOString(),
            updatedAt: p.updatedAt.toISOString(),
          })),
        };
      }),

    // Update participant availability/RSVP (public access)
    updateParticipant: publicProcedure
      .input(
        z.object({
          eventId: z.string(),
          participantName: z.string(),
          availability: z.record(z.string(), z.boolean()).optional(),
          rsvpStatus: z.enum(["attending", "not-attending", "no-response"]).optional(),
        })
      )
      .mutation(async ({ input }) => {
        const event = await db.getEventById(input.eventId);
        if (!event) throw new Error("Event not found");

        // Get participants for this event
        const eventParticipants = await db.getEventParticipants(input.eventId);
        
        // Find existing participant
        const existingParticipant = eventParticipants.find(
          (p: { name: string }) => p.name.toLowerCase() === input.participantName.toLowerCase()
        );

        if (existingParticipant) {
          // Update existing participant
          await db.updateParticipant(existingParticipant.id, {
            availability: input.availability as Record<string, boolean> | undefined,
            rsvpStatus: input.rsvpStatus,
          });
        } else {
          // Create new participant
          await db.createParticipant({
            id: `participant-${Date.now()}`,
            eventId: input.eventId,
            name: input.participantName,
            availability: input.availability as Record<string, boolean> || {},
            unavailableAllMonth: false,
            source: "manual",
            rsvpStatus: input.rsvpStatus || "no-response",
          });
        }

        return { success: true };
      }),
  }),

  events: router({
    list: protectedProcedure.query(({ ctx }) => db.getUserEvents(ctx.user.id)),
    
    listInvited: protectedProcedure.query(({ ctx }) => {
      if (!ctx.user.email || !ctx.user.name) return [];
      return db.getInvitedEvents(ctx.user.email, ctx.user.name, ctx.user.id);
    }),

    get: protectedProcedure
      .input(z.object({ id: z.string() }))
      .query(({ input }) => db.getEventById(input.id)),

    create: protectedProcedure
      .input(
        z.object({
          id: z.string(),
          name: z.string().min(1).max(255),
          eventType: z.enum(["flexible", "fixed", "conference"]),
          month: z.number().min(1).max(12),
          year: z.number(),
          fixedDate: z.string().optional(),
          fixedTime: z.string().optional(),
          startDate: z.string().optional(),
          endDate: z.string().optional(),
          allDay: z.boolean().optional(),
          venueCapacity: z.number().optional(),
          selectionDeadline: z.string().optional(),
          reminderDaysBefore: z.number().optional(),
          reminderScheduled: z.boolean().optional(),
          archived: z.boolean().optional(),
          finalized: z.boolean().optional(),
          finalizedDate: z.string().optional(),
          teamLeader: z.string().optional(),
          teamLeaderPhone: z.string().optional(),
          meetingType: z.enum(["in-person", "virtual"]).optional(),
          venueName: z.string().optional(),
          venueContact: z.string().optional(),
          venuePhone: z.string().optional(),
          meetingLink: z.string().optional(),
          rsvpDeadline: z.string().optional(),
          meetingNotes: z.string().optional(),
          hideAttendeeNames: z.boolean().optional(),
          showAttendeeNames: z.boolean().optional(),
          showAttendeeEmails: z.boolean().optional(),
          showAttendeePhones: z.boolean().optional(),
          digitalTwinUrl: z.string().optional(),
          quorumType: z.enum(["number", "percentage"]).optional(),
          quorumValue: z.number().optional(),
          deletedAt: z.date().nullable().optional(),
        })
      )
      .mutation(({ ctx, input }) =>
        db.createEvent({
          ...input,
          userId: ctx.user.id,
        })
      ),

    update: protectedProcedure
      .input(
        z.object({
          id: z.string(),
          name: z.string().min(1).max(255).optional(),
          eventType: z.enum(["flexible", "fixed", "conference"]).optional(),
          month: z.number().min(1).max(12).optional(),
          year: z.number().optional(),
          fixedDate: z.string().optional(),
          fixedTime: z.string().optional(),
          startDate: z.string().optional(),
          endDate: z.string().optional(),
          allDay: z.boolean().optional(),
          venueCapacity: z.number().optional(),
          selectionDeadline: z.string().optional(),
          reminderDaysBefore: z.number().optional(),
          reminderScheduled: z.boolean().optional(),
          archived: z.boolean().optional(),
          finalized: z.boolean().optional(),
          finalizedDate: z.string().optional(),
          teamLeader: z.string().optional(),
          teamLeaderPhone: z.string().optional(),
          meetingType: z.enum(["in-person", "virtual"]).optional(),
          venueName: z.string().optional(),
          venueContact: z.string().optional(),
          venuePhone: z.string().optional(),
          meetingLink: z.string().optional(),
          rsvpDeadline: z.string().optional(),
          meetingNotes: z.string().optional(),
          hideAttendeeNames: z.boolean().optional(),
          showAttendeeNames: z.boolean().optional(),
          showAttendeeEmails: z.boolean().optional(),
          showAttendeePhones: z.boolean().optional(),
          digitalTwinUrl: z.string().optional(),
          quorumType: z.enum(["number", "percentage"]).optional(),
          quorumValue: z.number().optional(),
          deletedAt: z.date().nullable().optional(),
        })
      )
      .mutation(({ input }) => {
        const { id, ...data } = input;
        return db.updateEvent(id, data);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(({ ctx, input }) => db.deleteEvent(input.id, ctx.user.id)),
  }),

  participants: router({
    list: protectedProcedure
      .input(z.object({ eventId: z.string() }))
      .query(({ input }) => db.getEventParticipants(input.eventId)),

    create: protectedProcedure
      .input(
        z.object({
          id: z.string(),
          eventId: z.string(),
          name: z.string().min(1).max(255),
          availability: z.record(z.string(), z.boolean()).optional(),
          unavailableAllMonth: z.boolean().optional(),
          notes: z.string().optional(),
          source: z.enum(["manual", "contacts", "ai"]).optional(),
          phone: z.string().optional(),
          email: z.string().optional(),
          designation: z.string().optional(),
          organization: z.string().optional(),
          leadSource: z.string().optional(),
          digitalTwinUrl: z.string().optional(),
          rsvpStatus: z.enum(["attending", "not-attending", "no-response"]).optional(),
          deletedAt: z.date().nullable().optional(),
        })
      )
      .mutation(({ input }) => {
        console.log('[tRPC] participants.create called with input:', JSON.stringify(input));
        
        // Provide defaults for optional fields that have database defaults
        const participantData: any = {
          id: input.id,
          eventId: input.eventId,
          name: input.name,
          availability: input.availability ?? {},
          unavailableAllMonth: input.unavailableAllMonth ?? false,
        };
        
        // Only include optional fields if they are defined
        if (input.notes !== undefined) participantData.notes = input.notes;
        if (input.source !== undefined) participantData.source = input.source;
        if (input.phone !== undefined) participantData.phone = input.phone;
        if (input.email !== undefined) participantData.email = input.email;
        if (input.designation !== undefined) participantData.designation = input.designation;
        if (input.organization !== undefined) participantData.organization = input.organization;
        if (input.leadSource !== undefined) participantData.leadSource = input.leadSource;
        if (input.digitalTwinUrl !== undefined) participantData.digitalTwinUrl = input.digitalTwinUrl;
        if (input.rsvpStatus !== undefined) participantData.rsvpStatus = input.rsvpStatus;
        if (input.deletedAt !== undefined) participantData.deletedAt = input.deletedAt;
        
        console.log('[tRPC] Final participantData to insert:', JSON.stringify(participantData));
        console.log('[tRPC] participantData keys:', Object.keys(participantData));
        
        // Do NOT include createdAt/updatedAt - let database handle them
        const result = db.createParticipant(participantData);
        // Touch parent event so clients pull the new participant
        db.updateEvent(input.eventId, { updatedAt: new Date() }).catch(console.error);
        return result;
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.string(),
          eventId: z.string(),
          name: z.string().min(1).max(255).optional(),
          availability: z.record(z.string(), z.boolean()).optional(),
          unavailableAllMonth: z.boolean().optional(),
          notes: z.string().optional(),
          source: z.enum(["manual", "contacts", "ai"]).optional(),
          phone: z.string().optional(),
          email: z.string().optional(),
          designation: z.string().optional(),
          organization: z.string().optional(),
          leadSource: z.string().optional(),
          digitalTwinUrl: z.string().optional(),
          rsvpStatus: z.enum(["attending", "not-attending", "no-response"]).optional(),
          deletedAt: z.date().nullable().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { id, eventId, ...data } = input;
        await db.updateParticipant(id, data as any);

        // Touch parent event so clients pull the updated participant
        db.updateEvent(eventId, { updatedAt: new Date() }).catch(console.error);

        // Send notification to event owner
        const event = await db.getEventById(eventId);
        if (event && data.availability) {
          await notifications.notifyEventUpdate(
            eventId,
            ctx.user.id,
            {
              title: `${event.name} - Availability Updated`,
              body: `${input.name || 'Someone'} updated their availability`,
              data: { eventId, screen: 'event-detail' },
            }
          );
        }

        return;
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(({ input }) => db.deleteParticipant(input.id)),

    sendInvitations: protectedProcedure
      .input(
        z.object({
          eventId: z.string(),
          participantIds: z.array(z.string()),
          eventDetails: z.string(),
          baseUrl: z.string(),
          isUpdate: z.boolean().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const event = await db.getEventById(input.eventId);
        if (!event) throw new Error("Event not found");

        const participants = await db.getEventParticipants(input.eventId);
        const selectedParticipants = participants.filter(p => input.participantIds.includes(p.id) && p.email);
        const isUpdate = !!input.isUpdate;

        const results = [];
        for (const p of selectedParticipants) {
          const personalizedLink = `${input.baseUrl}/public-event?eventId=${event.id}&name=${encodeURIComponent(p.name)}`;
          const result = await sendInvitationEmail(
            p.email!,
            p.name,
            event.name,
            input.eventDetails,
            personalizedLink,
            { isUpdate }
          );
          results.push(result);
          
          // Add a 600ms delay between emails to respect Resend's 2 requests/second rate limit
          if (selectedParticipants.length > 1) {
            await new Promise(resolve => setTimeout(resolve, 600));
          }
        }

        return { success: true, sentCount: results.filter(r => r.success).length };
      }),
  }),

  sessions: router({
    list: protectedProcedure
      .input(z.object({ eventId: z.string() }))
      .query(({ input }) => db.getEventSessions(input.eventId)),

    create: protectedProcedure
      .input(
        z.object({
          id: z.string(),
          eventId: z.string(),
          title: z.string().min(1).max(255),
          kind: sessionKindEnum.optional(),
          date: z.string().min(10).max(10),
          startTime: z.string().min(4).max(5),
          endTime: z.string().min(4).max(5),
          room: z.string().optional(),
          speaker: z.string().optional(),
          speakerTopic: z.string().optional(),
          description: z.string().optional(),
          capacity: z.number().optional(),
          sortOrder: z.number().optional(),
        })
      )
      .mutation(({ input }) => {
        const result = db.createEventSession(input);
        db.updateEvent(input.eventId, { updatedAt: new Date() }).catch(console.error);
        return result;
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.string(),
          eventId: z.string(),
          title: z.string().min(1).max(255).optional(),
          kind: sessionKindEnum.optional(),
          date: z.string().min(10).max(10).optional(),
          startTime: z.string().min(4).max(5).optional(),
          endTime: z.string().min(4).max(5).optional(),
          room: z.string().optional(),
          speaker: z.string().optional(),
          speakerTopic: z.string().optional(),
          description: z.string().optional(),
          capacity: z.number().optional(),
          sortOrder: z.number().optional(),
        })
      )
      .mutation(({ input }) => {
        const { id, eventId, ...data } = input;
        const result = db.updateEventSession(id, data);
        db.updateEvent(eventId, { updatedAt: new Date() }).catch(console.error);
        return result;
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.string(), eventId: z.string() }))
      .mutation(({ input }) => {
        const result = db.deleteEventSession(input.id);
        db.updateEvent(input.eventId, { updatedAt: new Date() }).catch(console.error);
        return result;
      }),
  }),

  snapshots: router({
    list: protectedProcedure.query(({ ctx }) => db.getUserSnapshots(ctx.user.id)),

    create: protectedProcedure
      .input(
        z.object({
          id: z.string(),
          eventId: z.string(),
          name: z.string().min(1).max(255),
          eventData: z.any(),
        })
      )
      .mutation(({ ctx, input }) =>
        db.createSnapshot({
          ...input,
          userId: ctx.user.id,
        })
      ),

    delete: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(({ input }) => db.deleteSnapshot(input.id)),
  }),

  templates: router({
    list: protectedProcedure.query(({ ctx }) => db.getUserTemplates(ctx.user.id)),

    create: protectedProcedure
      .input(
        z.object({
          id: z.string(),
          name: z.string().min(1).max(255),
          participantNames: z.array(z.string()),
        })
      )
      .mutation(({ ctx, input }) =>
        db.createTemplate({
          ...input,
          userId: ctx.user.id,
        })
      ),

    delete: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(({ input }) => db.deleteTemplate(input.id)),
  }),

  pushNotifications: router({
    register: protectedProcedure
      .input(
        z.object({
          token: z.string(),
          deviceId: z.string().optional(),
        })
      )
      .mutation(({ ctx, input }) =>
        db.registerPushToken({
          userId: ctx.user.id,
          token: input.token,
          deviceId: input.deviceId,
        })
      ),

    unregister: protectedProcedure
      .input(z.object({ token: z.string() }))
      .mutation(({ input }) => db.unregisterPushToken(input.token)),
  }),

  influencers: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const rows = await db.getUserInfluencerProspects(ctx.user.id);
      return rows.map(r => r.prospectData);
    }),

    upsert: protectedProcedure
      .input(z.object({ prospect: z.record(z.string(), z.unknown()) }))
      .mutation(async ({ ctx, input }) => {
        await db.upsertInfluencerProspect(ctx.user.id, input.prospect);
        return { success: true };
      }),

    syncAll: protectedProcedure
      .input(z.object({ prospects: z.array(z.record(z.string(), z.unknown())) }))
      .mutation(async ({ ctx, input }) => {
        const count = await db.syncInfluencerProspects(ctx.user.id, input.prospects);
        return { success: true, count };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        await db.deleteInfluencerProspect(input.id, ctx.user.id);
        return { success: true };
      }),
  }),

  // Admin routes for subscription management
  admin: adminRouter,

  // Trial management
  trial: trialRouter,

  // Subscription and payment management
  subscription: subscriptionRouter,
});

export type AppRouter = typeof appRouter;
