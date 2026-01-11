import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { DesktopLayout } from '@/components/desktop-layout';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuth } from '@/hooks/use-auth';
import { useAutoSync } from '@/hooks/use-auto-sync';
import { getTierDisplayName, formatPricing, getSubscriptionLimits } from '@/lib/subscription';
import { getSubscriptionInfo, getSubscriptionDisplayText, isEligibleForTrial } from '@/lib/trial';
import { trpc } from '@/lib/trpc';
import { getLoginUrl } from '@/constants/oauth';
import { Platform } from 'react-native';

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, isAuthenticated, logout, loading, refresh } = useAuth();
  const { syncStatus } = useAutoSync();
  const startTrialMutation = trpc.trial.startTrial.useMutation();
  
  const backgroundColor = useThemeColor({}, 'background');
  const surfaceColor = useThemeColor({}, 'surface');
  const tintColor = useThemeColor({}, 'tint');
  const textColor = useThemeColor({}, 'text');
  const textSecondaryColor = useThemeColor({}, 'textSecondary');

  const handleLogout = async () => {
    if (Platform.OS === 'web') {
      const confirmed = window.confirm(
        'Are you sure you want to log out? Your local data will remain on this device.'
      );
      if (!confirmed) return;
      await logout();
      // Redirect to app home page after logout
      window.location.href = '/';
    } else {
      Alert.alert(
        'Log Out',
        'Are you sure you want to log out? Your local data will remain on this device.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Log Out',
            style: 'destructive',
            onPress: async () => {
              await logout();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              router.back();
            },
          },
        ]
      );
    }
  };

  const getSyncStatusText = () => {
    if (!isAuthenticated) return 'Not syncing (local only)';
    if (syncStatus === 'syncing') return 'Syncing...';
    if (syncStatus === 'error') return 'Sync error';
    if (syncStatus === 'synced') return 'All changes synced';
    if (syncStatus === 'offline') return 'Offline';
    return 'Ready to sync';
  };

  const getSyncStatusColor = () => {
    if (!isAuthenticated) return textSecondaryColor;
    if (syncStatus === 'syncing') return tintColor;
    if (syncStatus === 'error') return '#FF3B30';
    if (syncStatus === 'synced') return '#34C759';
    return textSecondaryColor;
  };
  return (
    <DesktopLayout>
    <ThemedView style={styles.container}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: Math.max(insets.top, 20),
            paddingLeft: Math.max(insets.left, 16),
            paddingRight: Math.max(insets.right, 16),
            backgroundColor: surfaceColor,
          },
        ]}
      >
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
          style={styles.backButton}
        >
          <IconSymbol name="chevron.left" size={24} color={tintColor} />
        </Pressable>
        <ThemedText type="title" style={styles.headerTitle}>
          Profile
        </ThemedText>
        <Pressable
          onPress={async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            await refresh();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }}
          style={styles.refreshButton}
        >
          <IconSymbol name="arrow.clockwise" size={24} color={tintColor} />
        </Pressable>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
        {/* Login Status */}
        <View style={[styles.section, { backgroundColor: surfaceColor }]}>
          <View style={styles.sectionHeader}>
            <ThemedText type="subtitle">Account</ThemedText>
          </View>
          
          {isAuthenticated && user ? (
            <>
              <View style={styles.infoRow}>
                <ThemedText style={{ color: textSecondaryColor }}>Name</ThemedText>
                <ThemedText>{user.name || 'Not set'}</ThemedText>
              </View>
              <View style={styles.infoRow}>
                <ThemedText style={{ color: textSecondaryColor }}>Email</ThemedText>
                <ThemedText>{user.email || 'Not set'}</ThemedText>
              </View>
              <View style={styles.infoRow}>
                <ThemedText style={{ color: textSecondaryColor }}>Status</ThemedText>
                <ThemedText style={{ color: '#34C759' }}>Logged In</ThemedText>
              </View>
            </>
          ) : (
            <View style={styles.infoRow}>
              <ThemedText style={{ color: textSecondaryColor }}>Status</ThemedText>
              <ThemedText style={{ color: textSecondaryColor }}>Not Logged In</ThemedText>
            </View>
          )}
        </View>

        {/* Sync Status */}
        <View style={[styles.section, { backgroundColor: surfaceColor }]}>
          <View style={styles.sectionHeader}>
            <ThemedText type="subtitle">Sync</ThemedText>
          </View>
          
          <View style={styles.infoRow}>
            <ThemedText style={{ color: textSecondaryColor }}>Cloud Sync</ThemedText>
            <ThemedText style={{ color: getSyncStatusColor() }}>
              {getSyncStatusText()}
            </ThemedText>
          </View>
          

        </View>

        {/* Subscription */}
        {isAuthenticated && user && (
          <View style={[styles.section, { backgroundColor: surfaceColor }]}>
            <View style={styles.sectionHeader}>
              <ThemedText type="subtitle">Subscription</ThemedText>
            </View>
            
            <View style={styles.infoRow}>
              <ThemedText style={{ color: textSecondaryColor }}>Current Plan</ThemedText>
              <ThemedText style={{ fontWeight: '600' }}>
                {getSubscriptionDisplayText(getSubscriptionInfo(user))}
              </ThemedText>
            </View>
            
            <View style={styles.infoRow}>
              <ThemedText style={{ color: textSecondaryColor }}>Price</ThemedText>
              <ThemedText>{formatPricing((user as any).subscriptionTier || 'free')}</ThemedText>
            </View>
            
            {/* Show event limits for Free and Lite tiers */}
            {(((user as any).subscriptionTier === 'free' || !(user as any).subscriptionTier) || (user as any).subscriptionTier === 'lite') && (
              <View style={styles.infoRow}>
                <ThemedText style={{ color: textSecondaryColor }}>Events This Month</ThemedText>
                <ThemedText>
                  {(user as any).eventsCreatedThisMonth || 0} / {getSubscriptionLimits((user as any).subscriptionTier || 'free').eventsPerMonth}
                </ThemedText>
              </View>
            )}
            
            {/* Show trial info if user is trialing */}
            {(user as any).subscriptionStatus === 'trialing' && (user as any).trialEndDate && (
              <View style={[styles.trialBanner, { backgroundColor: tintColor + '20', borderColor: tintColor }]}>
                <ThemedText style={[styles.trialText, { color: tintColor }]}>
                  🎉 Trial ends in {getSubscriptionInfo(user).trialInfo?.daysRemaining || 0} days
                </ThemedText>
              </View>
            )}
            
            {/* Manage Subscription for Lite and Pro users */}
            {(((user as any).subscriptionTier === 'lite' || (user as any).subscriptionTier === 'pro') || (user as any).isLifetimePro) && (
              <Pressable
                style={[styles.manageButton, { borderColor: tintColor, marginTop: 12 }]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  router.push('/pricing' as any);
                }}
              >
                <ThemedText style={[styles.manageButtonText, { color: tintColor }]}>
                  View Subscription
                </ThemedText>
              </Pressable>
            )}
            
            {((user as any).subscriptionTier === 'free' || !(user as any).subscriptionTier) && (
              <Pressable
                style={[styles.upgradeButton, { backgroundColor: tintColor, marginTop: 12 }]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  // Temporarily disabled trial for testing paid upgrade
                  if (false && isEligibleForTrial(user)) {
                    Alert.alert(
                      'Start Free Trial',
                      'Get 14 days of Pro features free! No credit card required.',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Start Trial',
                          onPress: () => {
                            startTrialMutation.mutate(undefined, {
                              onSuccess: (result) => {
                                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                                Alert.alert(
                                  'Trial Started! 🎉',
                                  `You now have ${result.daysRemaining} days of Pro features. Enjoy unlimited events!`,
                                  [
                                    {
                                      text: 'Got it',
                                      onPress: () => {
                                        // Refresh the page to show updated status
                                        router.replace('/profile');
                                      },
                                    },
                                  ]
                                );
                              },
                              onError: (error) => {
                                Alert.alert('Error', error.message || 'Failed to start trial');
                              },
                            });
                          },
                        },
                      ]
                    );
                  } else {
                    router.push('/pricing' as any);
                  }
                }}
              >
                <ThemedText style={styles.upgradeButtonText}>
                  {isEligibleForTrial(user) ? 'Start Free Trial' : 'Upgrade'}
                </ThemedText>
              </Pressable>
            )}
          </View>
        )}

        {/* Actions */}
        {isAuthenticated ? (
          <Pressable
            style={[styles.logoutButton, { backgroundColor: '#FF3B30' }]}
            onPress={handleLogout}
          >
            <ThemedText style={styles.logoutButtonText}>Log Out</ThemedText>
          </Pressable>
        ) : (
          <Pressable
            style={[styles.loginButton, { backgroundColor: tintColor }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              const loginUrl = getLoginUrl();
              if (Platform.OS === 'web') {
                window.location.href = loginUrl;
              } else {
                Alert.alert('Login', 'Please use the Events screen to log in on mobile');
              }
            }}
          >
            <ThemedText style={styles.loginButtonText}>Log In</ThemedText>
          </Pressable>
        )}
      </ScrollView>
    </ThemedView>
    </DesktopLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  refreshButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionHeader: {
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  upgradeButton: {
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  upgradeButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  manageButton: {
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 2,
  },
  manageButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  logoutButton: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  loginButton: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  trialBanner: {
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  trialText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
