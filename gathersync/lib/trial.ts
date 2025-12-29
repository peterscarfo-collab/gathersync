/**
 * Trial and promotional subscription management utilities
 */

export const TRIAL_DURATION_DAYS = 14;

export interface TrialInfo {
  isActive: boolean;
  daysRemaining: number;
  startDate: Date | null;
  endDate: Date | null;
  hasUsedTrial: boolean;
}

export interface SubscriptionInfo {
  tier: 'free' | 'lite' | 'pro' | 'enterprise';
  source: 'trial' | 'promo' | 'stripe' | 'admin' | 'free';
  isLifetime: boolean;
  expiryDate: Date | null;
  trialInfo: TrialInfo | null;
}

/**
 * Check if user is eligible for free trial
 */
export function isEligibleForTrial(user: any): boolean {
  // User must not have used trial before
  if (user.trialUsed) {
    return false;
  }
  
  // User must be on free tier
  if (user.subscriptionTier !== 'free') {
    return false;
  }
  
  // User must not have lifetime Pro
  if (user.isLifetimePro) {
    return false;
  }
  
  return true;
}

/**
 * Calculate trial info from user data
 */
export function getTrialInfo(user: any): TrialInfo {
  const now = new Date();
  
  if (!user.trialStartDate || !user.trialEndDate) {
    return {
      isActive: false,
      daysRemaining: 0,
      startDate: null,
      endDate: null,
      hasUsedTrial: user.trialUsed || false,
    };
  }
  
  const startDate = new Date(user.trialStartDate);
  const endDate = new Date(user.trialEndDate);
  const isActive = now >= startDate && now <= endDate;
  
  const msRemaining = endDate.getTime() - now.getTime();
  const daysRemaining = Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));
  
  return {
    isActive,
    daysRemaining,
    startDate,
    endDate,
    hasUsedTrial: user.trialUsed || false,
  };
}

/**
 * Get comprehensive subscription info
 */
export function getSubscriptionInfo(user: any): SubscriptionInfo {
  const trialInfo = getTrialInfo(user);
  
  // Lifetime Pro granted by admin
  if (user.isLifetimePro) {
    return {
      tier: 'pro',
      source: 'admin',
      isLifetime: true,
      expiryDate: null,
      trialInfo: null,
    };
  }
  
  // Active trial
  if (trialInfo.isActive) {
    return {
      tier: user.subscriptionTier || 'pro', // Use the trial tier from database
      source: 'trial',
      isLifetime: false,
      expiryDate: trialInfo.endDate,
      trialInfo,
    };
  }
  
  // Promo code
  if (user.appliedPromoCode && user.promoExpiry) {
    const promoExpiry = new Date(user.promoExpiry);
    const now = new Date();
    
    if (now <= promoExpiry) {
      return {
        tier: 'pro',
        source: 'promo',
        isLifetime: false,
        expiryDate: promoExpiry,
        trialInfo: null,
      };
    }
  }
  
  // Stripe subscription
  if ((user.subscriptionTier === 'lite' || user.subscriptionTier === 'pro') && user.subscriptionSource === 'stripe') {
    return {
      tier: user.subscriptionTier,
      source: 'stripe',
      isLifetime: false,
      expiryDate: user.subscriptionEndDate ? new Date(user.subscriptionEndDate) : null,
      trialInfo: null,
    };
  }
  
  // Default: Free tier
  return {
    tier: user.subscriptionTier || 'free',
    source: 'free',
    isLifetime: false,
    expiryDate: null,
    trialInfo: trialInfo.hasUsedTrial ? trialInfo : null,
  };
}

/**
 * Start a free trial for a user
 */
export function startTrial(): { startDate: Date; endDate: Date } {
  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + TRIAL_DURATION_DAYS);
  
  return { startDate, endDate };
}

/**
 * Check if trial has expired
 */
export function hasTrialExpired(user: any): boolean {
  if (!user.trialEndDate) {
    return false;
  }
  
  const now = new Date();
  const endDate = new Date(user.trialEndDate);
  
  return now > endDate;
}

/**
 * Get display text for subscription status
 */
export function getSubscriptionDisplayText(info: SubscriptionInfo): string {
  if (info.isLifetime) {
    return 'Pro (Lifetime)';
  }
  
  if (info.source === 'trial' && info.trialInfo) {
    const days = info.trialInfo.daysRemaining;
    const tierName = info.tier.charAt(0).toUpperCase() + info.tier.slice(1);
    return `${tierName} Trial (${days} day${days !== 1 ? 's' : ''} remaining)`;
  }
  
  if (info.source === 'promo') {
    return `${info.tier.charAt(0).toUpperCase() + info.tier.slice(1)} (Promo)`;
  }
  
  if (info.source === 'stripe') {
    return info.tier.charAt(0).toUpperCase() + info.tier.slice(1);
  }
  
  return 'Free';
}
