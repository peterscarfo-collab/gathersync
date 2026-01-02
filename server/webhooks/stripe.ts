/**
 * Stripe webhook handler
 * Processes subscription events from Stripe
 */

import type { Request, Response } from 'express';
import { handleWebhookEvent } from '../stripe';
import { getDb } from '../db';
import { users } from '../../drizzle/schema';
import { eq } from 'drizzle-orm';
import { STRIPE_PRICE_IDS } from '../../constants/stripe';

// Helper to determine tier from price ID
function getTierFromPriceId(priceId: string): 'lite' | 'pro' | null {
  // Check Lite tier
  if (priceId === STRIPE_PRICE_IDS.lite.monthly || priceId === STRIPE_PRICE_IDS.lite.annual) {
    return 'lite';
  }
  // Check Pro tier
  if (priceId === STRIPE_PRICE_IDS.pro.monthly || priceId === STRIPE_PRICE_IDS.pro.annual) {
    return 'pro';
  }
  return null;
}

export async function handleStripeWebhook(req: Request, res: Response) {
  const signature = req.headers['stripe-signature'];

  if (!signature) {
    console.error('[Webhook] Missing stripe-signature header');
    return res.status(400).send('Missing signature');
  }

  try {
    // Verify webhook signature
    const event = await handleWebhookEvent(req.body, signature as string);
    
    console.log('[Webhook] Processing event:', event.type);

    const db = await getDb();
    if (!db) {
      console.error('[Webhook] Database not available');
      return res.status(500).send('Database error');
    }

    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as any;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;
        const clientReferenceId = session.client_reference_id; // User ID passed from createCheckout

        console.log('[Webhook] Checkout completed:', { customerId, subscriptionId, clientReferenceId });

        // Get subscription details to determine tier
        const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const priceId = subscription.items.data[0]?.price.id;
        const tier = getTierFromPriceId(priceId);

        if (!tier) {
          console.error('[Webhook] Could not determine tier from price ID:', priceId);
          break;
        }

        console.log('[Webhook] Determined tier:', tier);

        // Find user by client reference ID (user ID) or Stripe customer ID
        let user;
        if (clientReferenceId) {
          [user] = await db
            .select()
            .from(users)
            .where(eq(users.id, clientReferenceId))
            .limit(1);
        } else {
          [user] = await db
            .select()
            .from(users)
            .where(eq(users.stripeCustomerId, customerId))
            .limit(1);
        }

        if (user) {
          // Update user subscription with correct tier
          await db
            .update(users)
            .set({
              stripeCustomerId: customerId,
              stripeSubscriptionId: subscriptionId,
              subscriptionTier: tier,
              subscriptionStatus: 'active',
              subscriptionSource: 'stripe',
              subscriptionStartDate: new Date(),
              // Clear trial fields if upgrading from trial
              trialStartDate: null,
              trialEndDate: null,
            })
            .where(eq(users.id, user.id));

          console.log(`[Webhook] User upgraded to ${tier}:`, user.email);
        } else {
          console.error('[Webhook] User not found:', { clientReferenceId, customerId });
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as any;
        const customerId = subscription.customer as string;
        const status = subscription.status;

        console.log('[Webhook] Subscription updated:', { customerId, status });

        // Find user by Stripe customer ID
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.stripeCustomerId, customerId))
          .limit(1);

        if (user) {
          await db
            .update(users)
            .set({
              subscriptionStatus: status,
              subscriptionEndDate: subscription.cancel_at
                ? new Date(subscription.cancel_at * 1000)
                : null,
            })
            .where(eq(users.id, user.id));

          console.log('[Webhook] Subscription status updated:', status);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as any;
        const customerId = subscription.customer as string;

        console.log('[Webhook] Subscription cancelled:', customerId);

        // Find user by Stripe customer ID
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.stripeCustomerId, customerId))
          .limit(1);

        if (user) {
          await db
            .update(users)
            .set({
              subscriptionTier: 'free',
              subscriptionStatus: 'cancelled',
              subscriptionEndDate: new Date(),
            })
            .where(eq(users.id, user.id));

          console.log('[Webhook] User downgraded to Free:', user.email);
        }
        break;
      }

      default:
        console.log('[Webhook] Unhandled event type:', event.type);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('[Webhook] Error processing webhook:', error);
    res.status(400).send('Webhook error');
  }
}
