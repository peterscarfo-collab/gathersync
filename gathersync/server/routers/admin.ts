import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { users, events } from "../../drizzle/schema";
import { eq, like, or, and, inArray } from "drizzle-orm";

/**
 * Admin router for subscription management
 * Only accessible by users with role="admin"
 */
export const adminRouter = router({
  /**
   * Search users by email or name
   */
  searchUsers: publicProcedure
    .input(
      z.object({
        query: z.string().optional(),
        tier: z.enum(["all", "free", "lite", "pro", "enterprise"]).optional(),
        eventSearch: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      // Check if user is admin
      if (!ctx.user || ctx.user.role !== "admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Admin access required",
        });
      }

      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database not available",
        });
      }

      let conditions = [];

      if (input.query && input.query.trim().length > 0) {
        conditions.push(
          or(
            like(users.email, `%${input.query}%`),
            like(users.name, `%${input.query}%`)
          )
        );
      }

      if (input.tier && input.tier !== "all") {
        conditions.push(eq(users.subscriptionTier, input.tier));
      }

      if (input.eventSearch && input.eventSearch.trim().length > 0) {
        // If eventSearch is provided, find users who have created an event matching the search
        const matchingEvents = await db
          .select({ userId: events.userId })
          .from(events)
          .where(like(events.name, `%${input.eventSearch}%`));
        
        const userIds = matchingEvents.map(e => e.userId);
        if (userIds.length > 0) {
          conditions.push(inArray(users.id, userIds));
        } else {
          // If no events match, return empty array early
          return [];
        }
      }

      let results;
      if (conditions.length > 0) {
        results = await db
          .select()
          .from(users)
          .where(and(...conditions))
          .limit(50);
      } else {
        results = await db
          .select()
          .from(users)
          .limit(50);
      }

      return results;
    }),

  /**
   * Get all subscribers (Pro and Enterprise users)
   */
  getAllSubscribers: publicProcedure.query(async ({ ctx }) => {
    // Check if user is admin
    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Admin access required",
      });
    }

    const db = await getDb();
    if (!db) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Database not available",
      });
    }

    const subscribers = await db
      .select()
      .from(users)
      .where(or(eq(users.subscriptionTier, "pro"), eq(users.subscriptionTier, "enterprise")));

    return subscribers;
  }),

  /**
   * Grant lifetime Pro access to a user
   */
  grantLifetimePro: publicProcedure
    .input(
      z.object({
        userId: z.number(),
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check if user is admin
      if (!ctx.user || ctx.user.role !== "admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Admin access required",
        });
      }

      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database not available",
        });
      }

      const now = new Date();

      await db
        .update(users)
        .set({
          subscriptionTier: "pro",
          subscriptionStatus: "active",
          subscriptionSource: "admin",
          isLifetimePro: true,
          grantedBy: ctx.user.email || ctx.user.openId,
          grantedAt: now,
          updatedAt: now,
        })
        .where(eq(users.id, input.userId));

      return { success: true };
    }),

  /**
   * Revoke lifetime Pro access
   */
  revokeLifetimePro: publicProcedure
    .input(
      z.object({
        userId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check if user is admin
      if (!ctx.user || ctx.user.role !== "admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Admin access required",
        });
      }

      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database not available",
        });
      }

      const now = new Date();

      await db
        .update(users)
        .set({
          subscriptionTier: "free",
          subscriptionStatus: "active",
          subscriptionSource: "free",
          isLifetimePro: false,
          grantedBy: null,
          grantedAt: null,
          updatedAt: now,
        })
        .where(eq(users.id, input.userId));

      return { success: true };
    }),

  /**
   * Grant temporary Pro access with expiry
   */
  grantTemporaryPro: publicProcedure
    .input(
      z.object({
        userId: z.number(),
        durationDays: z.number().min(1).max(365),
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check if user is admin
      if (!ctx.user || ctx.user.role !== "admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Admin access required",
        });
      }

      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database not available",
        });
      }

      const now = new Date();
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + input.durationDays);

      await db
        .update(users)
        .set({
          subscriptionTier: "pro",
          subscriptionStatus: "active",
          subscriptionSource: "admin",
          subscriptionStartDate: now,
          subscriptionEndDate: expiryDate,
          grantedBy: ctx.user.email || ctx.user.openId,
          grantedAt: now,
          updatedAt: now,
        })
        .where(eq(users.id, input.userId));

      return { success: true, expiryDate };
    }),

  /**
   * Get subscription analytics
   */
  getAnalytics: publicProcedure.query(async ({ ctx }) => {
    // Check if user is admin
    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Admin access required",
      });
    }

    const db = await getDb();
    if (!db) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Database not available",
      });
    }

    const allUsers = await db.select().from(users);

    const totalUsers = allUsers.length;
    const freeUsers = allUsers.filter((u: any) => u.subscriptionTier === "free").length;
    const proUsers = allUsers.filter((u: any) => u.subscriptionTier === "pro").length;
    const enterpriseUsers = allUsers.filter((u: any) => u.subscriptionTier === "enterprise").length;
    const lifetimeProUsers = allUsers.filter((u: any) => u.isLifetimePro).length;
    const trialUsers = allUsers.filter((u: any) => u.subscriptionStatus === "trialing").length;

    return {
      totalUsers,
      freeUsers,
      proUsers,
      enterpriseUsers,
      lifetimeProUsers,
      trialUsers,
      conversionRate: totalUsers > 0 ? ((proUsers + enterpriseUsers) / totalUsers) * 100 : 0,
    };
  }),

  /**
   * Create an account for a participant (Admin only)
   */
  createParticipantAccount: publicProcedure
    .input(
      z.object({
        name: z.string(),
        email: z.string().email(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check if user is admin
      if (!ctx.user || ctx.user.role !== "admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Admin access required",
        });
      }

      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database not available",
        });
      }

      // Check if user already exists with this email
      const existingUsers = await db.select().from(users).where(eq(users.email, input.email));
      if (existingUsers.length > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "A user with this email already exists",
        });
      }

      const crypto = await import("crypto");
      const openId = `manual-${crypto.randomUUID()}`;

      // Insert the new user
      await db.insert(users).values({
        openId,
        name: input.name,
        email: input.email,
        loginMethod: "manual",
        role: "user",
        subscriptionTier: "free",
      });

      // Generate a session token for the new user
      const { sdk } = await import("../_core/sdk");
      const token = await sdk.createSessionToken(openId, { name: input.name });

      return {
        success: true,
        token,
        openId,
      };
    }),
});
