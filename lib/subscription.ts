/**
 * Subscription management utilities for GatherSync
 */

export type SubscriptionTier = 'free' | 'lite' | 'pro' | 'enterprise';
export type SubscriptionStatus = 'active' | 'cancelled' | 'expired' | 'trialing';

export interface SubscriptionLimits {
  eventsPerMonth: number;
  participantsPerEvent: number;
  features: {
    cloudSync: boolean;
    advancedAnalytics: boolean;
    customBranding: boolean;
    prioritySupport: boolean;
    exportData: boolean;
  };
}

/**
 * Get subscription limits for a given tier
 */
export function getSubscriptionLimits(tier: SubscriptionTier): SubscriptionLimits {
  switch (tier) {
    case 'free':
      return {
        eventsPerMonth: 5,
        participantsPerEvent: 50,
        features: {
          cloudSync: true,
          advancedAnalytics: false,
          customBranding: false,
          prioritySupport: false,
          exportData: true,
        },
      };
    case 'lite':
      return {
        eventsPerMonth: 50,
        participantsPerEvent: 100,
        features: {
          cloudSync: true,
          advancedAnalytics: false,
          customBranding: false,
          prioritySupport: false,
          exportData: true,
        },
      };
    case 'pro':
      return {
        eventsPerMonth: Infinity,
        participantsPerEvent: Infinity,
        features: {
          cloudSync: true,
          advancedAnalytics: true,
          customBranding: false,
          prioritySupport: true,
          exportData: true,
        },
      };
    case 'enterprise':
      return {
        eventsPerMonth: Infinity,
        participantsPerEvent: Infinity,
        features: {
          cloudSync: true,
          advancedAnalytics: true,
          customBranding: true,
          prioritySupport: true,
          exportData: true,
        },
      };
  }
}

/**
 * Check if user can create a new event based on their subscription
 */
export function canCreateEvent(
  tier: SubscriptionTier,
  eventsCreatedThisMonth: number
): { allowed: boolean; reason?: string } {
  const limits = getSubscriptionLimits(tier);
  
  if (eventsCreatedThisMonth >= limits.eventsPerMonth) {
    return {
      allowed: false,
      reason: `You've reached your limit of ${limits.eventsPerMonth} events per month. Upgrade to Pro for unlimited events!`,
    };
  }
  
  return { allowed: true };
}

/**
 * Check if user's subscription is active
 */
export function isSubscriptionActive(status: SubscriptionStatus): boolean {
  return status === 'active' || status === 'trialing';
}

/**
 * Get display name for subscription tier
 */
export function getTierDisplayName(tier: SubscriptionTier): string {
  switch (tier) {
    case 'free':
      return 'Free';
    case 'lite':
      return 'Lite';
    case 'pro':
      return 'Pro';
    case 'enterprise':
      return 'Enterprise';
  }
}

/**
 * Get pricing for subscription tier
 */
export function getTierPricing(tier: SubscriptionTier): { amount: number; currency: string; period: string } {
  switch (tier) {
    case 'free':
      return { amount: 0, currency: 'USD', period: 'forever' };
    case 'lite':
      return { amount: 4.99, currency: 'USD', period: 'month' };
    case 'pro':
      return { amount: 7.99, currency: 'USD', period: 'month' };
    case 'enterprise':
      return { amount: 0, currency: 'USD', period: 'custom' };
  }
}

/**
 * Format pricing for display
 */
export function formatPricing(tier: SubscriptionTier): string {
  const pricing = getTierPricing(tier);
  
  if (tier === 'free') {
    return 'Free';
  }
  
  if (tier === 'enterprise') {
    return 'Contact Us';
  }
  
  return `$${pricing.amount.toFixed(2)}/${pricing.period}`;
}

/**
 * Check if it's time to reset monthly event counter
 */
export function shouldResetMonthlyCounter(lastReset: Date): boolean {
  const now = new Date();
  const lastResetMonth = lastReset.getMonth();
  const currentMonth = now.getMonth();
  const lastResetYear = lastReset.getFullYear();
  const currentYear = now.getFullYear();
  
  // Reset if we're in a different month or year
  return currentMonth !== lastResetMonth || currentYear !== lastResetYear;
}

/**
 * Check if user is currently in a trial period
 */
export function isInTrialPeriod(trialEndDate: Date | null): boolean {
  if (!trialEndDate) return false;
  return new Date() < trialEndDate;
}

/**
 * Get days remaining in trial
 */
export function getTrialDaysRemaining(trialEndDate: Date | null): number {
  if (!trialEndDate) return 0;
  const now = new Date();
  const diffTime = trialEndDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

/**
 * Get effective subscription tier (considering trial status)
 * If user is in trial, return the trial tier; otherwise return their actual tier
 */
export function getEffectiveTier(
  subscriptionTier: SubscriptionTier,
  subscriptionStatus: SubscriptionStatus,
  trialEndDate: Date | null
): SubscriptionTier {
  // If user is trialing and trial hasn't expired, they get the trial tier benefits
  if (subscriptionStatus === 'trialing' && isInTrialPeriod(trialEndDate)) {
    return subscriptionTier; // The tier is already set to the trial tier in the database
  }
  
  // If trial expired but status is still 'trialing', they should be downgraded to free
  if (subscriptionStatus === 'trialing' && !isInTrialPeriod(trialEndDate)) {
    return 'free';
  }
  
  return subscriptionTier;
}

/**
 * Start a 14-day free trial for a user
 */
export function startTrial(tier: 'lite' | 'pro'): {
  trialStartDate: Date;
  trialEndDate: Date;
  subscriptionTier: SubscriptionTier;
  subscriptionStatus: SubscriptionStatus;
  subscriptionSource: 'trial';
} {
  const now = new Date();
  const trialEnd = new Date(now);
  trialEnd.setDate(trialEnd.getDate() + 14); // 14 days from now
  
  return {
    trialStartDate: now,
    trialEndDate: trialEnd,
    subscriptionTier: tier,
    subscriptionStatus: 'trialing',
    subscriptionSource: 'trial',
  };
}
