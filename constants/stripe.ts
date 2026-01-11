/**
 * Stripe configuration for frontend
 */

// TEMPORARY: Hardcoded for testing - TODO: Move to environment variables
export const STRIPE_PUBLISHABLE_KEY = 'pk_test_51Jyi16QdyRdop1Cx3ov8dIntl5HSedDqXP78qddI0RNcn1aVcIcjCITRNGuLxHIyxdMOHkq9aIXjBeHwmoHdDcjh00fr33FA8Z';

// Price IDs from Stripe
export const STRIPE_PRICE_IDS = {
  lite: {
    monthly: 'price_1Si2LWQdyRdop1CxqsM4HvCL', // $4.99/month
    annual: 'price_1Si2LXQdyRdop1CxoMKcEpKA', // $49/year
  },
  pro: {
    monthly: 'price_1Si2LXQdyRdop1CxPpvp9YpY', // $7.99/month
    annual: 'price_1Si2LYQdyRdop1CxgXRNHP9L', // $79/year
  },
} as const;

export const SUBSCRIPTION_PLANS = {
  free: {
    name: 'Free',
    tier: 'free' as const,
    monthlyPrice: 0,
    annualPrice: 0,
    monthlyPriceDisplay: 'Free forever',
    annualPriceDisplay: 'Free forever',
    eventLimit: 5,
    features: [
      'Up to 5 events per month',
      'Up to 50 participants per event',
      'Cloud sync across devices',
      'Mobile app access',
    ],
  },
  lite: {
    name: 'Lite',
    tier: 'lite' as const,
    monthlyPrice: 4.99,
    annualPrice: 49,
    monthlyPriceDisplay: '$4.99/month',
    annualPriceDisplay: '$49/year',
    annualSavings: 'Save $10.88',
    eventLimit: 50,
    stripePriceIds: STRIPE_PRICE_IDS.lite,
    features: [
      'Up to 50 events per month',
      'Up to 100 participants per event',
      'Cloud sync across devices',
      'Mobile app access',
      'Priority email support',
    ],
  },
  pro: {
    name: 'Pro',
    tier: 'pro' as const,
    monthlyPrice: 7.99,
    annualPrice: 79,
    monthlyPriceDisplay: '$7.99/month',
    annualPriceDisplay: '$79/year',
    annualSavings: 'Save $16.88',
    eventLimit: null, // unlimited
    stripePriceIds: STRIPE_PRICE_IDS.pro,
    features: [
      'Unlimited events',
      'Unlimited participants',
      'Cloud sync across devices',
      'Mobile app access',
      'Priority support',
      'Advanced analytics',
      'Export data',
    ],
  },
} as const;

export type SubscriptionTier = 'free' | 'lite' | 'pro';
