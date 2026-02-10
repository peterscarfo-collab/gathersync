import { z } from "zod";
import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import * as db from "./db";
import * as notifications from "./notifications";
import { adminRouter } from "./routers/admin";
import { trialRouter } from "./routers/trial";
import { subscriptionRouter } from "./routers/subscription";

export const appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    // Debug endpoint to check authentication state
    debug: publicProcedure.query((opts) => {
      const req = opts.ctx.req;
      const cookieHeader = req.headers.cookie || '';
      const sessionUser = (req.session as any)?.user;
      return {
        hasCookieHeader: !!cookieHeader,
        cookieHeaderLength: cookieHeader.length,
        hasConnectSid: cookieHeader.includes('connect.sid'),
        hasCookieToken: cookieHeader.includes('app_session_token'),
        hasSession: !!req.session,
        sessionId: req.sessionID?.substring(0, 10),
        hasSessionUser: !!sessionUser,
        sessionUserEmail: sessionUser?.email,
        parsedCookies: req.cookies ? Object.keys(req.cookies) : [],
        origin: req.headers.origin,
        host: req.headers.host,
        user: opts.ctx.user ? {
          id: opts.ctx.user.id,
          email: opts.ctx.user.email,
        } : null,
      };
    }),
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      // Destroy express-session if it exists (for web users)
      if (ctx.req.session) {
        ctx.req.session.destroy((err) => {
          if (err) {
            console.error("[Auth Logout] Error destroying session:", err);
          } else {
            console.log("[Auth Logout] Express session destroyed");
          }
        });
      }
      
      // Also clear the COOKIE_NAME cookie (for native/legacy web)
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      
      // Clear connect.sid cookie (express-session)
      ctx.res.clearCookie('connect.sid', { 
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        path: '/',
        maxAge: -1 
      });
      
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
          // Create new participant with proper UUID
          const participantId = db.generateId();
          await db.createParticipant({
            id: participantId,
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
    list: protectedProcedure.query(({ ctx }) => db.getUserEvents(String(ctx.user.id))),

    get: protectedProcedure
      .input(z.object({ id: z.string() }))
      .query(({ input }) => db.getEventById(input.id)),

    create: protectedProcedure
      .input(
        z.object({
          id: z.string(),
          name: z.string().min(1).max(255),
          eventType: z.enum(["flexible", "fixed"]),
          month: z.number().min(1).max(12),
          year: z.number(),
          fixedDate: z.string().optional(),
          fixedTime: z.string().optional(),
          reminderDaysBefore: z.number().optional(),
          reminderScheduled: z.boolean().optional(),
          archived: z.boolean().optional(),
          finalized: z.boolean().optional(),
          finalizedDate: z.string().optional(),
          teamLeader: z.string().optional(),
          teamLeaderPhone: z.string().optional(),
          meetingType: z.enum(["in-person", "virtual"]).optional(),
          venueName: z.string().optional(),
          venueAddress: z.string().optional(),
          venueContact: z.string().optional(),
          venuePhone: z.string().optional(),
          meetingLink: z.string().optional(),
          rsvpDeadline: z.string().optional(),
          meetingNotes: z.string().optional(),
        })
      )
      .mutation(({ ctx, input }) => {
        // Generate a proper UUID for InstantDB
        const eventId = db.generateId();
        return db.createEvent({
          ...input,
          id: eventId,
          userId: String(ctx.user.id),
        });
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.string(),
          name: z.string().min(1).max(255).optional(),
          eventType: z.enum(["flexible", "fixed"]).optional(),
          month: z.number().min(1).max(12).optional(),
          year: z.number().optional(),
          fixedDate: z.string().optional(),
          fixedTime: z.string().optional(),
          reminderDaysBefore: z.number().optional(),
          reminderScheduled: z.boolean().optional(),
          archived: z.boolean().optional(),
          finalized: z.boolean().optional(),
          finalizedDate: z.string().optional(),
          teamLeader: z.string().optional(),
          teamLeaderPhone: z.string().optional(),
          meetingType: z.enum(["in-person", "virtual"]).optional(),
          venueName: z.string().optional(),
          venueAddress: z.string().optional(),
          venueContact: z.string().optional(),
          venuePhone: z.string().optional(),
          meetingLink: z.string().optional(),
          rsvpDeadline: z.string().optional(),
          meetingNotes: z.string().optional(),
        })
      )
      .mutation(({ input }) => {
        const { id, ...data } = input;
        return db.updateEvent(id, data);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(({ input }) => db.deleteEvent(input.id)),
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
          rsvpStatus: z.enum(["attending", "not-attending", "no-response"]).optional(),
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
        if (input.rsvpStatus !== undefined) participantData.rsvpStatus = input.rsvpStatus;
        
        console.log('[tRPC] Final participantData to insert:', JSON.stringify(participantData));
        console.log('[tRPC] participantData keys:', Object.keys(participantData));
        
        // Do NOT include createdAt/updatedAt - let database handle them
        return db.createParticipant(participantData);
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
          rsvpStatus: z.enum(["attending", "not-attending", "no-response"]).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { id, eventId, ...data } = input;
        await db.updateParticipant(id, data as any);

        // Send notification to event owner
        const event = await db.getEventById(eventId);
        if (event && data.availability) {
          await notifications.notifyEventUpdate(
            eventId,
            String(ctx.user.id),
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
  }),

  snapshots: router({
    list: protectedProcedure.query(({ ctx }) => db.getUserSnapshots(String(ctx.user.id))),

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
          userId: String(ctx.user.id),
        })
      ),

    delete: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(({ input }) => db.deleteSnapshot(input.id)),
  }),

  templates: router({
    list: protectedProcedure.query(({ ctx }) => db.getUserTemplates(String(ctx.user.id))),

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
          userId: String(ctx.user.id),
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
          id: db.generateId(),
          userId: String(ctx.user.id),
          token: input.token,
          deviceId: input.deviceId,
        })
      ),

    unregister: protectedProcedure
      .input(z.object({ token: z.string() }))
      .mutation(({ input }) => db.unregisterPushToken(input.token)),
  }),

  // Admin routes for subscription management
  admin: adminRouter,

  // Trial management
  trial: trialRouter,

  // Subscription and payment management
  subscription: subscriptionRouter,
});

export type AppRouter = typeof appRouter;
