/**
 * Stripe payment and subscription service
 * Handles subscription creation, management, and webhooks
 */

import Stripe from 'stripe';

// Initialize Stripe with secret key
// TEMPORARY: Hardcoded for testing - TODO: Move to environment variables
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';

// Lazy initialization - only create Stripe instance when needed
let stripeInstance: Stripe | null = null;
function getStripe(): Stripe {
  if (!stripeInstance) {
    if (!STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY environment variable is required for payment features');
    }
    stripeInstance = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: '2025-12-15.clover',
    });
  }
  return stripeInstance;
}

// Product and price configuration
const GATHERSYNC_PRO_PRICE_ID = process.env.STRIPE_PRICE_ID || 'price_1Si0Q0QdyRdop1CxVOLbprOl';

/**
 * Create a Stripe customer for a user
 */
export async function createStripeCustomer(email: string, name?: string): Promise<string> {
  try {
    const customer = await getStripe().customers.create({
      email,
      name: name || undefined,
      metadata: {
        app: 'gathersync',
      },
    });
    
    console.log('[Stripe] Created customer:', customer.id);
    return customer.id;
  } catch (error) {
    console.error('[Stripe] Failed to create customer:', error);
    throw new Error('Failed to create Stripe customer');
  }
}

/**
 * Create a checkout session for subscription
 */
export async function createCheckoutSession(
  customerId: string,
  priceId: string,
  successUrl: string,
  cancelUrl: string,
  userId?: string
): Promise<string> {
  try {
    const session = await getStripe().checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: userId, // Pass user ID to webhook
      subscription_data: {
        metadata: {
          app: 'gathersync',
        },
      },
    });
    
    console.log('[Stripe] Created checkout session:', session.id);
    return session.url || '';
  } catch (error) {
    console.error('[Stripe] Failed to create checkout session:', error);
    throw new Error('Failed to create checkout session');
  }
}

/**
 * Create a billing portal session for subscription management
 */
export async function createPortalSession(
  customerId: string,
  returnUrl: string
): Promise<string> {
  try {
    const session = await getStripe().billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
    
    console.log('[Stripe] Created portal session for customer:', customerId);
    return session.url;
  } catch (error) {
    console.error('[Stripe] Failed to create portal session:', error);
    throw new Error('Failed to create portal session');
  }
}

/**
 * Get subscription details for a customer
 */
export async function getSubscription(subscriptionId: string): Promise<Stripe.Subscription | null> {
  try {
    const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
    return subscription;
  } catch (error) {
    console.error('[Stripe] Failed to retrieve subscription:', error);
    return null;
  }
}

/**
 * Cancel a subscription
 */
export async function cancelSubscription(subscriptionId: string): Promise<boolean> {
  try {
    await getStripe().subscriptions.cancel(subscriptionId);
    console.log('[Stripe] Cancelled subscription:', subscriptionId);
    return true;
  } catch (error) {
    console.error('[Stripe] Failed to cancel subscription:', error);
    return false;
  }
}

/**
 * Handle Stripe webhook events
 */
export async function handleWebhookEvent(
  payload: string | Buffer,
  signature: string
): Promise<Stripe.Event> {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
  
  try {
    const event = getStripe().webhooks.constructEvent(payload, signature, webhookSecret);
    console.log('[Stripe] Webhook event received:', event.type);
    return event;
  } catch (error) {
    console.error('[Stripe] Webhook signature verification failed:', error);
    throw new Error('Invalid webhook signature');
  }
}

/**
 * Create GatherSync Pro product and price in Stripe
 * This is a one-time setup function
 */
export async function setupGatherSyncProduct(): Promise<{ productId: string; priceId: string }> {
  try {
    // Create product
    const product = await getStripe().products.create({
      name: 'GatherSync Pro',
      description: 'Unlimited events, priority support, and advanced features',
      metadata: {
        app: 'gathersync',
      },
    });
    
    // Create price (monthly subscription)
    const price = await getStripe().prices.create({
      product: product.id,
      unit_amount: 999, // $9.99 per month
      currency: 'usd',
      recurring: {
        interval: 'month',
      },
      metadata: {
        app: 'gathersync',
      },
    });
    
    console.log('[Stripe] Created product:', product.id);
    console.log('[Stripe] Created price:', price.id);
    console.log('[Stripe] Add this to your .env file:');
    console.log(`STRIPE_PRICE_ID=${price.id}`);
    
    return {
      productId: product.id,
      priceId: price.id,
    };
  } catch (error) {
    console.error('[Stripe] Failed to setup product:', error);
    throw new Error('Failed to setup GatherSync product');
  }
}

export { getStripe as stripe };
