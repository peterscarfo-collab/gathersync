import { describe, it, expect } from 'vitest';
import {
  getSubscriptionLimits,
  canCreateEvent,
  isSubscriptionActive,
  getTierDisplayName,
  getTierPricing,
  formatPricing,
  shouldResetMonthlyCounter,
  type SubscriptionTier,
  type SubscriptionStatus,
} from '../lib/subscription';

describe('Subscription System', () => {
  describe('getSubscriptionLimits', () => {
    it('should return correct limits for free tier', () => {
      const limits = getSubscriptionLimits('free');
      
      expect(limits.eventsPerMonth).toBe(5);
      expect(limits.participantsPerEvent).toBe(50);
      expect(limits.features.cloudSync).toBe(true);
      expect(limits.features.advancedAnalytics).toBe(false);
      expect(limits.features.customBranding).toBe(false);
    });

    it('should return correct limits for pro tier', () => {
      const limits = getSubscriptionLimits('pro');
      
      expect(limits.eventsPerMonth).toBe(Infinity);
      expect(limits.participantsPerEvent).toBe(Infinity);
      expect(limits.features.cloudSync).toBe(true);
      expect(limits.features.advancedAnalytics).toBe(true);
      expect(limits.features.prioritySupport).toBe(true);
    });

    it('should return correct limits for enterprise tier', () => {
      const limits = getSubscriptionLimits('enterprise');
      
      expect(limits.eventsPerMonth).toBe(Infinity);
      expect(limits.features.customBranding).toBe(true);
      expect(limits.features.prioritySupport).toBe(true);
    });
  });

  describe('canCreateEvent', () => {
    it('should allow free users to create events under limit', () => {
      const result = canCreateEvent('free', 3);
      
      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should block free users at event limit', () => {
      const result = canCreateEvent('free', 5);
      
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('reached your limit');
      expect(result.reason).toContain('5 events');
    });

    it('should always allow pro users to create events', () => {
      const result = canCreateEvent('pro', 100);
      
      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should always allow enterprise users to create events', () => {
      const result = canCreateEvent('enterprise', 1000);
      
      expect(result.allowed).toBe(true);
    });
  });

  describe('isSubscriptionActive', () => {
    it('should return true for active status', () => {
      expect(isSubscriptionActive('active')).toBe(true);
    });

    it('should return true for trialing status', () => {
      expect(isSubscriptionActive('trialing')).toBe(true);
    });

    it('should return false for cancelled status', () => {
      expect(isSubscriptionActive('cancelled')).toBe(false);
    });

    it('should return false for expired status', () => {
      expect(isSubscriptionActive('expired')).toBe(false);
    });
  });

  describe('getTierDisplayName', () => {
    it('should return correct display names', () => {
      expect(getTierDisplayName('free')).toBe('Free');
      expect(getTierDisplayName('pro')).toBe('Pro');
      expect(getTierDisplayName('enterprise')).toBe('Enterprise');
    });
  });

  describe('getTierPricing', () => {
    it('should return correct pricing for free tier', () => {
      const pricing = getTierPricing('free');
      
      expect(pricing.amount).toBe(0);
      expect(pricing.currency).toBe('USD');
      expect(pricing.period).toBe('forever');
    });

    it('should return correct pricing for pro tier', () => {
      const pricing = getTierPricing('pro');
      
      expect(pricing.amount).toBe(3.99);
      expect(pricing.currency).toBe('USD');
      expect(pricing.period).toBe('month');
    });

    it('should return custom pricing for enterprise tier', () => {
      const pricing = getTierPricing('enterprise');
      
      expect(pricing.amount).toBe(0);
      expect(pricing.period).toBe('custom');
    });
  });

  describe('formatPricing', () => {
    it('should format free tier as "Free"', () => {
      expect(formatPricing('free')).toBe('Free');
    });

    it('should format pro tier with price', () => {
      expect(formatPricing('pro')).toBe('$3.99/month');
    });

    it('should format enterprise tier as "Contact Us"', () => {
      expect(formatPricing('enterprise')).toBe('Contact Us');
    });
  });

  describe('shouldResetMonthlyCounter', () => {
    it('should return false for same month', () => {
      const now = new Date();
      const lastReset = new Date(now.getFullYear(), now.getMonth(), 1);
      
      expect(shouldResetMonthlyCounter(lastReset)).toBe(false);
    });

    it('should return true for different month', () => {
      const now = new Date();
      const lastReset = new Date(now.getFullYear(), now.getMonth() - 1, 15);
      
      expect(shouldResetMonthlyCounter(lastReset)).toBe(true);
    });

    it('should return true for different year', () => {
      const now = new Date();
      const lastReset = new Date(now.getFullYear() - 1, now.getMonth(), 15);
      
      expect(shouldResetMonthlyCounter(lastReset)).toBe(true);
    });

    it('should handle year boundary correctly', () => {
      const now = new Date(2025, 0, 15); // January 2025
      const lastReset = new Date(2024, 11, 20); // December 2024
      
      expect(shouldResetMonthlyCounter(lastReset)).toBe(true);
    });
  });
});
