/**
 * Stripe configuration for frontend
 */

// TEMPORARY: Hardcoded for testing - TODO: Move to environment variables
export const STRIPE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || 'pk_test_51Jyi16QdyRdop1Cx3ov8dIntl5HSedDqXP78qddI0RNcn1aVcIcjCITRNGuLxHIyxdMOHkq9aIXjBeHwmoHdDcjh00fr33FA8Z';

// Price IDs from Stripe
export const STRIPE_PRICE_IDS = {
  lite: {
    monthly: 'price_1TU0BTQdyRdop1CxRkDGC5R1', // $4.99/month
    annual: 'price_1TU0GxQdyRdop1CxnVRKnHwg', // $49/year
  },
  pro: {
    monthly: 'price_1TU0KuQdyRdop1CxNlhhNVop', // $7.99/month
    annual: 'price_1TU0LYQdyRdop1CxM8HQsU1m', // $79/year
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
      'Up to 5 events',
      'Up to 10 participants per event',
      'Smart availability calendar',
      'Mobile & Web app access',
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
      'Up to 50 events',
      'Up to 100 participants per event',
      'CSV Import for Contacts',
      'Export Event to CSV',
      'Direct Native Messaging',
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
      'Unlimited events & participants',
      'CSV Imports & Exports',
      'Live Attendance Tracking',
      'Custom Reminder Templates',
      'Advanced Analytics Dashboard',
      'Priority support',
    ],
  },
} as const;

export type SubscriptionTier = 'free' | 'lite' | 'pro';
