import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { adminDb, tx } from "../../lib/admin-db";

const TRIAL_DURATION_DAYS = 14;

/**
 * Trial router for managing free trials
 */
export const trialRouter = router({
  /**
   * Start a free trial for the current user
   */
  startTrial: protectedProcedure.mutation(async ({ ctx }) => {
    const user = ctx.user;

    // Check if user has already used trial
    if (user.trialUsed) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "You have already used your free trial",
      });
    }

    // Check if user is already Pro
    if (user.subscriptionTier !== "free") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "You already have a Pro subscription",
      });
    }

    // Check if user has lifetime Pro
    if (user.isLifetimePro) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "You already have lifetime Pro access",
      });
    }

    const now = new Date();
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + TRIAL_DURATION_DAYS);

    try {
      await adminDb.transact([
        tx.$users[user.id].update({
          subscriptionTier: "pro",
          subscriptionStatus: "trialing",
          subscriptionSource: "trial",
          trialStartDate: now,
          trialEndDate: trialEndDate,
          trialUsed: true,
        }),
      ]);

      return {
        success: true,
        trialEndDate: trialEndDate.toISOString(),
        daysRemaining: TRIAL_DURATION_DAYS,
      };
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to start trial",
      });
    }
  }),

  /**
   * Check trial status for current user
   */
  getTrialStatus: protectedProcedure.query(async ({ ctx }) => {
    const user = ctx.user;

    // Check if trial has expired
    if (user.trialEndDate) {
      const now = new Date();
      const endDate = new Date(user.trialEndDate);
      const isActive = now <= endDate;
      const msRemaining = endDate.getTime() - now.getTime();
      const daysRemaining = Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));

      return {
        hasUsedTrial: user.trialUsed || false,
        isTrialing: user.subscriptionStatus === "trialing" && isActive,
        trialStartDate: user.trialStartDate ? user.trialStartDate.toISOString() : null,
        trialEndDate: user.trialEndDate ? user.trialEndDate.toISOString() : null,
        daysRemaining: isActive ? daysRemaining : 0,
        isExpired: !isActive && user.subscriptionStatus === "trialing",
      };
    }

    return {
      hasUsedTrial: user.trialUsed || false,
      isTrialing: false,
      trialStartDate: null,
      trialEndDate: null,
      daysRemaining: 0,
      isExpired: false,
    };
  }),

  /**
   * Check and expire trials (called on app launch)
   */
  checkExpiredTrials: protectedProcedure.mutation(async ({ ctx }) => {
    const user = ctx.user;

    // Only check if user is currently trialing
    if (user.subscriptionStatus !== "trialing" || !user.trialEndDate) {
      return { expired: false };
    }

    const now = new Date();
    const endDate = new Date(user.trialEndDate);

    // Check if trial has expired
    if (now > endDate) {
      try {
        // Downgrade to free tier
        await adminDb.transact([
          tx.$users[user.id].update({
            subscriptionTier: "free",
            subscriptionStatus: "expired",
            subscriptionSource: "free",
          }),
        ]);

        return { expired: true };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to expire trial",
        });
      }
    }

    return { expired: false };
  }),
});
