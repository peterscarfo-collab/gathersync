import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { publicProcedure, router } from "../_core/trpc";
import { adminDb, tx } from "../../lib/admin-db";
import { stripe } from "../stripe";
import { STRIPE_PRICE_IDS } from "../../constants/stripe";

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

      try {
        const { data } = await adminDb.query({
          $users: {},
        });

        // Filter users by email or name (client-side for now)
        const query = input.query.toLowerCase();
        const results = data.$users
          .filter((user: any) => 
            (user.email && user.email.toLowerCase().includes(query)) ||
            (user.name && user.name.toLowerCase().includes(query))
          )
          .slice(0, 20);

        return results;
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to search users",
        });
      }
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

    try {
      const { data } = await adminDb.query({
        $users: {},
      });

      const subscribers = data.$users.filter((user: any) => 
        user.subscriptionTier === "pro" || user.subscriptionTier === "enterprise"
      );

      return subscribers;
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to get subscribers",
      });
    }
  }),

  /**
   * Grant lifetime Pro access to a user
   */
  grantLifetimePro: publicProcedure
    .input(
      z.object({
        userId: z.string(),
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

      try {
        const now = new Date();

        await adminDb.transact([
          tx.$users[input.userId].update({
            subscriptionTier: "pro",
            subscriptionStatus: "active",
            subscriptionSource: "admin",
            isLifetimePro: true,
            grantedBy: ctx.user.email || ctx.user.id,
            grantedAt: now,
          }),
        ]);

        return { success: true };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to grant lifetime Pro",
        });
      }
    }),

  /**
   * Revoke lifetime Pro access
   */
  revokeLifetimePro: publicProcedure
    .input(
      z.object({
        userId: z.string(),
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

      try {
        await adminDb.transact([
          tx.$users[input.userId].update({
            subscriptionTier: "free",
            subscriptionStatus: "active",
            subscriptionSource: "free",
            isLifetimePro: false,
            grantedBy: null,
            grantedAt: null,
          }),
        ]);

        return { success: true };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to revoke lifetime Pro",
        });
      }
    }),

  /**
   * Grant temporary Pro access with expiry
   */
  grantTemporaryPro: publicProcedure
    .input(
      z.object({
        userId: z.string(),
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

      try {
        const now = new Date();
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + input.durationDays);

        await adminDb.transact([
          tx.$users[input.userId].update({
            subscriptionTier: "pro",
            subscriptionStatus: "active",
            subscriptionSource: "admin",
            subscriptionStartDate: now,
            subscriptionEndDate: expiryDate,
            isLifetimePro: false,
            grantedBy: ctx.user.email || ctx.user.id,
            grantedAt: now,
          }),
        ]);

        return { success: true, expiryDate };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to grant temporary Pro",
        });
      }
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

    try {
      const { data } = await adminDb.query({
        $users: {},
      });

      const allUsers = data.$users;

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
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to get analytics",
      });
    }
  }),

  /**
   * Business analytics report:
   * - subscriber categories
   * - cash received MTD / YTD
   * - monthly cash breakdown for current year
   */
  getBusinessReport: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Admin access required",
      });
    }

    try {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const yearStart = new Date(now.getFullYear(), 0, 1);

      const usersResult = await adminDb.query({
        $users: {},
      });
      const allUsers = usersResult.$users || [];

      const giftedActiveUsers = allUsers.filter((u: any) => {
        if (u.isLifetimePro) return false;
        if (u.subscriptionSource !== "admin") return false;
        if (!u.subscriptionEndDate) return false;
        return new Date(u.subscriptionEndDate) >= now;
      }).length;

      const giftedExpiredUsers = allUsers.filter((u: any) => {
        if (u.isLifetimePro) return false;
        if (u.subscriptionSource !== "admin") return false;
        if (!u.subscriptionEndDate) return false;
        return new Date(u.subscriptionEndDate) < now;
      }).length;

      const categories = {
        totalUsers: allUsers.length,
        freeUsers: allUsers.filter((u: any) => (u.subscriptionTier || "free") === "free").length,
        trialingUsers: allUsers.filter((u: any) => u.subscriptionStatus === "trialing").length,
        lifetimeUsers: allUsers.filter((u: any) => Boolean(u.isLifetimePro)).length,
        giftedActiveUsers,
        giftedExpiredUsers,
        stripeLiteActiveUsers: allUsers.filter(
          (u: any) =>
            u.subscriptionSource === "stripe" &&
            u.subscriptionTier === "lite" &&
            u.subscriptionStatus === "active"
        ).length,
        stripeProActiveUsers: allUsers.filter(
          (u: any) =>
            u.subscriptionSource === "stripe" &&
            u.subscriptionTier === "pro" &&
            u.subscriptionStatus === "active"
        ).length,
        cancelledUsers: allUsers.filter((u: any) => u.subscriptionStatus === "cancelled").length,
      };

      // Stripe cash report
      let revenue = {
        currency: "usd",
        monthToDateCents: 0,
        yearToDateCents: 0,
        monthToDate: 0,
        yearToDate: 0,
        monthToDateInvoiceCount: 0,
        yearToDateInvoiceCount: 0,
        monthToDateByPlan: {
          liteMonthlyCents: 0,
          liteAnnualCents: 0,
          proMonthlyCents: 0,
          proAnnualCents: 0,
          unknownCents: 0,
        },
        yearToDateByPlan: {
          liteMonthlyCents: 0,
          liteAnnualCents: 0,
          proMonthlyCents: 0,
          proAnnualCents: 0,
          unknownCents: 0,
        },
        monthlyBreakdown: [] as Array<{
          month: string;
          cashCents: number;
          cash: number;
          invoiceCount: number;
        }>,
      };

      const monthlyMap = new Map<string, { cashCents: number; invoiceCount: number }>();
      for (let m = 0; m <= now.getMonth(); m++) {
        const d = new Date(now.getFullYear(), m, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        monthlyMap.set(key, { cashCents: 0, invoiceCount: 0 });
      }

      if (process.env.STRIPE_SECRET_KEY) {
        const stripeClient = stripe();
        const yearStartUnix = Math.floor(yearStart.getTime() / 1000);

        const classifyPriceId = (priceId?: string | null) => {
          if (!priceId) return "unknown" as const;
          if (priceId === STRIPE_PRICE_IDS.lite.monthly) return "liteMonthly" as const;
          if (priceId === STRIPE_PRICE_IDS.lite.annual) return "liteAnnual" as const;
          if (priceId === STRIPE_PRICE_IDS.pro.monthly) return "proMonthly" as const;
          if (priceId === STRIPE_PRICE_IDS.pro.annual) return "proAnnual" as const;
          return "unknown" as const;
        };

        const invoices = stripeClient.invoices.list({
          status: "paid",
          limit: 100,
          created: { gte: yearStartUnix },
        });

        for await (const inv of invoices) {
          const paidAtUnix = inv.status_transitions?.paid_at;
          if (!paidAtUnix) continue;
          const paidAt = new Date(paidAtUnix * 1000);
          if (paidAt < yearStart || paidAt > now) continue;

          const amount = inv.amount_paid || 0;
          revenue.yearToDateCents += amount;
          revenue.yearToDateInvoiceCount += 1;

          const monthKey = `${paidAt.getFullYear()}-${String(paidAt.getMonth() + 1).padStart(2, "0")}`;
          const row = monthlyMap.get(monthKey);
          if (row) {
            row.cashCents += amount;
            row.invoiceCount += 1;
          }

          if (paidAt >= monthStart) {
            revenue.monthToDateCents += amount;
            revenue.monthToDateInvoiceCount += 1;
          }

          const firstPriceId = inv.lines?.data?.[0]?.price?.id || null;
          const planBucket = classifyPriceId(firstPriceId);

          const ytd = revenue.yearToDateByPlan;
          if (planBucket === "liteMonthly") ytd.liteMonthlyCents += amount;
          else if (planBucket === "liteAnnual") ytd.liteAnnualCents += amount;
          else if (planBucket === "proMonthly") ytd.proMonthlyCents += amount;
          else if (planBucket === "proAnnual") ytd.proAnnualCents += amount;
          else ytd.unknownCents += amount;

          if (paidAt >= monthStart) {
            const mtd = revenue.monthToDateByPlan;
            if (planBucket === "liteMonthly") mtd.liteMonthlyCents += amount;
            else if (planBucket === "liteAnnual") mtd.liteAnnualCents += amount;
            else if (planBucket === "proMonthly") mtd.proMonthlyCents += amount;
            else if (planBucket === "proAnnual") mtd.proAnnualCents += amount;
            else mtd.unknownCents += amount;
          }
        }
      }

      revenue.monthToDate = Number((revenue.monthToDateCents / 100).toFixed(2));
      revenue.yearToDate = Number((revenue.yearToDateCents / 100).toFixed(2));
      revenue.monthlyBreakdown = Array.from(monthlyMap.entries()).map(([month, row]) => ({
        month,
        cashCents: row.cashCents,
        cash: Number((row.cashCents / 100).toFixed(2)),
        invoiceCount: row.invoiceCount,
      }));

      return {
        generatedAt: now.toISOString(),
        period: {
          monthStart: monthStart.toISOString(),
          yearStart: yearStart.toISOString(),
        },
        categories,
        revenue,
      };
    } catch (error) {
      console.error("[Admin] Failed to generate business report:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to generate business report",
      });
    }
  }),
});
