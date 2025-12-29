import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { users } from "../../drizzle/schema";
import { eq, like, or } from "drizzle-orm";

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
        query: z.string().min(1),
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

      const results = await db
        .select()
        .from(users)
        .where(
          or(
            like(users.email, `%${input.query}%`),
            like(users.name, `%${input.query}%`)
          )
        )
        .limit(20);

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
});
