/**
 * Subscription management router
 * Handles Stripe subscription operations
 */

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { protectedProcedure, publicProcedure, router } from '../_core/trpc';
import {
  createStripeCustomer,
  createCheckoutSession,
  createPortalSession,
  getSubscription,
} from '../stripe';
import { getDb } from '../db';
import { users } from '../../drizzle/schema';
import { eq } from 'drizzle-orm';

export const subscriptionRouter = router({
  /**
   * Create a checkout session for subscription
   */
  createCheckout: protectedProcedure
    .input(
      z.object({
        priceId: z.string(),
        successUrl: z.string(),
        cancelUrl: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Database not available',
        });
      }

      const user = ctx.user;
      if (!user) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'User not found',
        });
      }

      try {
        // Get or create Stripe customer
        let stripeCustomerId = user.stripeCustomerId;

        if (!stripeCustomerId) {
          // Create new Stripe customer
          stripeCustomerId = await createStripeCustomer(
            user.email || '',
            user.name || undefined
          );

          // Save customer ID to database
          await db
            .update(users)
            .set({ stripeCustomerId })
            .where(eq(users.id, user.id));
        }

        // Create checkout session
        const checkoutUrl = await createCheckoutSession(
          stripeCustomerId,
          input.priceId,
          input.successUrl,
          input.cancelUrl,
          user.id.toString() // Pass user ID for webhook identification
        );

        return { url: checkoutUrl };
      } catch (error) {
        console.error('[Subscription] Failed to create checkout:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create checkout session',
        });
      }
    }),

  /**
   * Create a billing portal session
   */
  createPortal: protectedProcedure
    .input(
      z.object({
        returnUrl: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = ctx.user;
      if (!user || !user.stripeCustomerId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'No subscription found',
        });
      }

      try {
        const portalUrl = await createPortalSession(user.stripeCustomerId, input.returnUrl);
        return { url: portalUrl };
      } catch (error) {
        console.error('[Subscription] Failed to create portal:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create portal session',
        });
      }
    }),

  /**
   * Get current subscription status
   */
  getStatus: protectedProcedure.query(async ({ ctx }) => {
    const user = ctx.user;
    if (!user) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'User not found',
      });
    }

    // Return user's subscription info from database
    return {
      tier: user.subscriptionTier,
      status: user.subscriptionStatus,
      stripeCustomerId: user.stripeCustomerId,
      stripeSubscriptionId: user.stripeSubscriptionId,
      subscriptionStartDate: user.subscriptionStartDate,
      subscriptionEndDate: user.subscriptionEndDate,
      isLifetimePro: user.isLifetimePro,
      trialUsed: user.trialUsed,
      trialEndDate: user.trialEndDate,
    };
  }),

  /**
   * Get subscription details from Stripe
   */
  getDetails: protectedProcedure.query(async ({ ctx }) => {
    const user = ctx.user;
    if (!user || !user.stripeSubscriptionId) {
      return null;
    }

    try {
      const subscription = await getSubscription(user.stripeSubscriptionId);
      if (!subscription) {
        return null;
      }

      const sub = subscription as any;
      return {
        id: sub.id,
        status: sub.status,
        currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000) : null,
        cancelAtPeriodEnd: sub.cancel_at_period_end || false,
      };
    } catch (error) {
      console.error('[Subscription] Failed to get details:', error);
      return null;
    }
  }),

  /**
   * Start a 14-day free trial for Lite or Pro
   */
  startTrial: protectedProcedure
    .input(
      z.object({
        tier: z.enum(['lite', 'pro']),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Database not available',
        });
      }

      const user = ctx.user;
      if (!user) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'User not found',
        });
      }

      // Check if user has already used their trial
      if (user.trialUsed) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'You have already used your free trial',
        });
      }

      // Check if user is already on a paid plan
      // Free users with 'active' status are eligible for trials
      // Only block if they're on a paid tier (lite/pro) or currently trialing
      if (user.subscriptionTier !== 'free' || user.subscriptionStatus === 'trialing') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'You already have an active subscription or trial',
        });
      }

      try {
        const now = new Date();
        const trialEnd = new Date(now);
        trialEnd.setDate(trialEnd.getDate() + 14); // 14 days from now

        // Update user with trial information
        await db
          .update(users)
          .set({
            subscriptionTier: input.tier,
            subscriptionStatus: 'trialing',
            subscriptionSource: 'trial',
            trialStartDate: now,
            trialEndDate: trialEnd,
            trialUsed: true,
          })
          .where(eq(users.id, user.id));

        return {
          success: true,
          tier: input.tier,
          trialEndDate: trialEnd,
        };
      } catch (error) {
        console.error('[Subscription] Failed to start trial:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to start trial',
        });
      }
    }),
});

