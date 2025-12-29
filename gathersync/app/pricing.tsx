import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { SUBSCRIPTION_PLANS, type SubscriptionTier } from '@/constants/stripe';
import { useAuth } from '@/hooks/use-auth';
import { useThemeColor } from '@/hooks/use-theme-color';
import { trpc } from '@/lib/trpc';

export default function PricingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(false);
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'annual'>('monthly');
  const tintColor = useThemeColor({}, 'tint');
  const backgroundColor = useThemeColor({}, 'background');
  const textSecondaryColor = useThemeColor({}, 'textSecondary');

  const createCheckout = trpc.subscription.createCheckout.useMutation();
  const startTrial = trpc.subscription.startTrial.useMutation();

  const handleStartTrial = async (tier: 'lite' | 'pro') => {
    if (!isAuthenticated) {
      alert('Please log in to start your trial');
      return;
    }

    try {
      setLoading(true);
      const result = await startTrial.mutateAsync({ tier });
      
      if (result.success) {
        alert(`Your ${tier === 'lite' ? 'Lite' : 'Pro'} trial has started! Enjoy 14 days of premium features.`);
        router.back(); // Go back to previous screen
      }
    } catch (error: any) {
      console.error('Failed to start trial:', error);
      alert(error.message || 'Failed to start trial. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async (tier: 'lite' | 'pro') => {
    if (!isAuthenticated) {
      alert('Please log in to upgrade');
      return;
    }

    try {
      setLoading(true);
      
      // Get the correct price ID based on tier and billing interval
      const plan = SUBSCRIPTION_PLANS[tier];
      const priceId = billingInterval === 'monthly' 
        ? plan.stripePriceIds.monthly 
        : plan.stripePriceIds.annual;
      
      // Create checkout session
      // Always use web URLs for Stripe redirect, then redirect to app from web page
      const webBaseUrl = 'https://8081-ixeurgdbu2achb4x3woqe-5903680b.sg1.manus.computer';
      const deepLinkScheme = 'manus20251216190030://';
      
      const result = await createCheckout.mutateAsync({
        priceId,
        successUrl: Platform.OS === 'web'
          ? `${webBaseUrl}/subscription-success.html`
          : `${webBaseUrl}/subscription-success.html?scheme=${encodeURIComponent(deepLinkScheme)}`,
        cancelUrl: Platform.OS === 'web'
          ? `${webBaseUrl}/pricing.html`
          : `${webBaseUrl}/index.html`,
      });

      // Redirect to Stripe Checkout
      if (result.url) {
        if (Platform.OS === 'web') {
          window.location.href = result.url;
        } else {
          // On mobile, open in browser
          await WebBrowser.openBrowserAsync(result.url);
        }
      }
    } catch (error) {
      console.error('Failed to create checkout:', error);
      alert('Failed to start checkout. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const currentTier = (user?.subscriptionTier || 'free') as 'free' | 'lite' | 'pro' | 'enterprise';
  const isLite = currentTier === 'lite';
  const isPro = currentTier === 'pro' || user?.isLifetimePro;
  const hasUsedTrial = user?.trialUsed || false;
  const isTrialing = user?.subscriptionStatus === 'trialing';
  const canStartTrial = currentTier === 'free' && !hasUsedTrial && !isTrialing;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor }]}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: Math.max(insets.top, 20),
          paddingBottom: Math.max(insets.bottom, 40),
          paddingLeft: Math.max(insets.left, 20),
          paddingRight: Math.max(insets.right, 20),
        },
      ]}
    >
      <ThemedText type="title" style={styles.title}>
        Choose Your Plan
      </ThemedText>
      <ThemedText style={[styles.subtitle, { color: textSecondaryColor }]}>
        Start with Free, upgrade anytime to unlock more events
      </ThemedText>

      {/* Billing interval toggle */}
      <View style={styles.toggleContainer}>
        <Pressable
          style={[
            styles.toggleButton,
            billingInterval === 'monthly' && [styles.toggleButtonActive, { backgroundColor: tintColor }],
          ]}
          onPress={() => setBillingInterval('monthly')}
        >
          <ThemedText
            style={[
              styles.toggleText,
              billingInterval === 'monthly' && styles.toggleTextActive,
            ]}
          >
            Monthly
          </ThemedText>
        </Pressable>
        <Pressable
          style={[
            styles.toggleButton,
            billingInterval === 'annual' && [styles.toggleButtonActive, { backgroundColor: tintColor }],
          ]}
          onPress={() => setBillingInterval('annual')}
        >
          <ThemedText
            style={[
              styles.toggleText,
              billingInterval === 'annual' && styles.toggleTextActive,
            ]}
          >
            Annual
          </ThemedText>
        </Pressable>
      </View>
      <ThemedText style={[styles.savingsText, { color: tintColor }]}>
        {billingInterval === 'annual' && '💰 Save 2 months with annual billing'}
      </ThemedText>

      <View style={styles.plansContainer}>
        {/* Free Plan */}
        <View style={[styles.planCard, { borderColor: textSecondaryColor + '30' }]}>
          <ThemedText type="subtitle" style={styles.planName}>
            {SUBSCRIPTION_PLANS.free.name}
          </ThemedText>
          <ThemedText type="title" style={styles.planPrice}>
            {billingInterval === 'monthly' 
              ? SUBSCRIPTION_PLANS.free.monthlyPriceDisplay 
              : SUBSCRIPTION_PLANS.free.annualPriceDisplay}
          </ThemedText>
          <View style={styles.featuresContainer}>
            {SUBSCRIPTION_PLANS.free.features.map((feature, index) => (
              <View key={index} style={styles.featureRow}>
                <ThemedText style={[styles.checkmark, { color: tintColor }]}>✓</ThemedText>
                <ThemedText style={styles.featureText}>{feature}</ThemedText>
              </View>
            ))}
          </View>
          {currentTier === 'free' && (
            <View style={[styles.currentBadge, { backgroundColor: textSecondaryColor + '20' }]}>
              <ThemedText style={styles.currentBadgeText}>Current Plan</ThemedText>
            </View>
          )}
        </View>

        {/* Lite Plan */}
        <View style={[styles.planCard, { borderColor: tintColor + '50' }]}>
          <ThemedText type="subtitle" style={styles.planName}>
            {SUBSCRIPTION_PLANS.lite.name}
          </ThemedText>
          <ThemedText type="title" style={styles.planPrice}>
            {billingInterval === 'monthly' 
              ? SUBSCRIPTION_PLANS.lite.monthlyPriceDisplay 
              : SUBSCRIPTION_PLANS.lite.annualPriceDisplay}
          </ThemedText>
          {billingInterval === 'annual' && (
            <ThemedText style={[styles.savings, { color: tintColor }]}>
              {SUBSCRIPTION_PLANS.lite.annualSavings}
            </ThemedText>
          )}
          <View style={styles.featuresContainer}>
            {SUBSCRIPTION_PLANS.lite.features.map((feature, index) => (
              <View key={index} style={styles.featureRow}>
                <ThemedText style={[styles.checkmark, { color: tintColor }]}>✓</ThemedText>
                <ThemedText style={styles.featureText}>{feature}</ThemedText>
              </View>
            ))}
          </View>
          {isLite ? (
            <View style={[styles.currentBadge, { backgroundColor: tintColor + '20' }]}>
              <ThemedText style={[styles.currentBadgeText, { color: tintColor }]}>Current Plan</ThemedText>
            </View>
          ) : (
            <Pressable
              style={[styles.upgradeButton, { backgroundColor: tintColor, opacity: loading ? 0.6 : 1 }]}
              onPress={() => canStartTrial ? handleStartTrial('lite') : handleUpgrade('lite')}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <ThemedText style={styles.upgradeButtonText}>
                  {canStartTrial ? 'Start 14-Day Free Trial' : 'Choose Lite'}
                </ThemedText>
              )}
            </Pressable>
          )}
        </View>

        {/* Pro Plan */}
        <View style={[styles.planCard, styles.proPlan, { borderColor: tintColor }]}>
          <View style={[styles.popularBadge, { backgroundColor: tintColor }]}>
            <ThemedText style={styles.popularBadgeText}>MOST POPULAR</ThemedText>
          </View>
          <ThemedText type="subtitle" style={styles.planName}>
            {SUBSCRIPTION_PLANS.pro.name}
          </ThemedText>
          <ThemedText type="title" style={styles.planPrice}>
            {billingInterval === 'monthly' 
              ? SUBSCRIPTION_PLANS.pro.monthlyPriceDisplay 
              : SUBSCRIPTION_PLANS.pro.annualPriceDisplay}
          </ThemedText>
          {billingInterval === 'annual' && (
            <ThemedText style={[styles.savings, { color: tintColor }]}>
              {SUBSCRIPTION_PLANS.pro.annualSavings}
            </ThemedText>
          )}
          <View style={styles.featuresContainer}>
            {SUBSCRIPTION_PLANS.pro.features.map((feature, index) => (
              <View key={index} style={styles.featureRow}>
                <ThemedText style={[styles.checkmark, { color: tintColor }]}>✓</ThemedText>
                <ThemedText style={styles.featureText}>{feature}</ThemedText>
              </View>
            ))}
          </View>
          {isPro ? (
            <View style={[styles.currentBadge, { backgroundColor: tintColor + '20' }]}>
              <ThemedText style={[styles.currentBadgeText, { color: tintColor }]}>Current Plan</ThemedText>
            </View>
          ) : (
            <Pressable
              style={[styles.upgradeButton, { backgroundColor: tintColor, opacity: loading ? 0.6 : 1 }]}
              onPress={() => canStartTrial ? handleStartTrial('pro') : handleUpgrade('pro')}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <ThemedText style={styles.upgradeButtonText}>
                  {canStartTrial ? 'Start 14-Day Free Trial' : 'Choose Pro'}
                </ThemedText>
              )}
            </Pressable>
          )}
        </View>
      </View>

      <ThemedText style={[styles.footer, { color: textSecondaryColor }]}>
        All plans include cloud sync and mobile app access. Cancel anytime.
      </ThemedText>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    alignItems: 'center',
  },
  title: {
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: 24,
    fontSize: 16,
    lineHeight: 24,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 12,
    padding: 4,
    marginBottom: 8,
  },
  toggleButton: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  toggleButtonActive: {
    // backgroundColor set dynamically
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
  },
  toggleTextActive: {
    color: '#fff',
  },
  savingsText: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 24,
    minHeight: 20,
  },
  plansContainer: {
    width: '100%',
    maxWidth: 1000,
    gap: 16,
  },
  planCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
    borderRadius: 16,
    padding: 24,
    borderWidth: 2,
    position: 'relative',
  },
  proPlan: {
    // borderColor set dynamically
  },
  popularBadge: {
    position: 'absolute',
    top: -12,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 12,
  },
  popularBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  planName: {
    marginBottom: 8,
  },
  planPrice: {
    marginBottom: 4,
  },
  savings: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 16,
  },
  featuresContainer: {
    marginTop: 16,
    marginBottom: 24,
    gap: 12,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  checkmark: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
  },
  featureText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 24,
  },
  currentBadge: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  currentBadgeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  upgradeButton: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
  },
  upgradeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  footer: {
    marginTop: 32,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
  },
});
