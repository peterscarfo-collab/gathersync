import { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, View, Pressable, Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { DesktopLayout } from '@/components/desktop-layout';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuth } from '@/hooks/use-auth';
import { eventsLocalStorage } from '@/lib/local-storage';
import type { Event } from '@/types/models';
import { AdminColors, AdminTypography, AdminSpacing, AdminBorderRadius, AdminShadows } from '@/constants/admin-theme';

export default function AdminScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, isAuthenticated } = useAuth();
  
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalEvents: 0,
    upcomingEvents: 0,
    totalParticipants: 0,
    avgResponseRate: 0,
  });

  useEffect(() => {
    loadData();
  }, []);

  const handleResetAllData = async () => {
    if (Platform.OS === 'web') {
      const confirmed = window.confirm(
        'Are you sure you want to reset all data? This will:\n\n' +
        '• Delete all local events, snapshots, and templates\n' +
        '• Delete all your cloud data\n' +
        '\nThis action cannot be undone.'
      );
      if (!confirmed) return;
    } else {
      Alert.alert(
        'Reset All Data',
        'Are you sure you want to reset all data? This will:\n\n' +
        '• Delete all local events, snapshots, and templates\n' +
        '• Delete all your cloud data\n' +
        '\nThis action cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Reset All Data',
            style: 'destructive',
            onPress: async () => {
              await performReset();
            },
          },
        ]
      );
      return;
    }
    await performReset();
  };

  const performReset = async () => {
    try {
      setLoading(true);
      
      // Clear all local storage
      await AsyncStorage.multiRemove([
        '@gathersync_events',
        '@gathersync_snapshots',
        '@gathersync_templates',
        '@gathersync_last_sync',
      ]);
      
      // Delete all cloud data if authenticated
      if (isAuthenticated) {
        const { eventsCloudStorage } = await import('@/lib/cloud-storage');
        const cloudEvents = await eventsCloudStorage.getAll();
        await Promise.all(cloudEvents.map(e => eventsCloudStorage.delete(e.id)));
      }
      
      // Reload data
      await loadData();
      
      // Haptic feedback
      if (Platform.OS !== 'web') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      
      if (Platform.OS === 'web') {
        alert('All data has been reset successfully!');
      } else {
        Alert.alert('Success', 'All data has been reset successfully!');
      }
    } catch (error) {
      console.error('[Admin] Reset failed:', error);
      if (Platform.OS === 'web') {
        alert('Failed to reset data. Please try again.');
      } else {
        Alert.alert('Error', 'Failed to reset data. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const loadData = async () => {
    try {
      const allEvents = await eventsLocalStorage.getAll();
      setEvents(allEvents);
      
      // Calculate statistics
      const now = new Date();
      const upcoming = allEvents.filter(e => {
        if (e.eventType === 'fixed' && e.fixedDate) {
          return new Date(e.fixedDate).getTime() > now.getTime();
        }
        return true; // Flexible events are always "upcoming" until finalized
      });
      
      const totalParticipants = allEvents.reduce((sum, e) => sum + e.participants.length, 0);
      
      // Calculate average response rate
      const responseCounts = allEvents.map(e => {
        const responded = e.participants.filter(p => 
          (e.eventType === 'flexible' && p.availability && Object.keys(p.availability).length > 0) ||
          (e.eventType === 'fixed' && p.rsvpStatus && p.rsvpStatus !== 'no-response')
        ).length;
        return e.participants.length > 0 ? (responded / e.participants.length) * 100 : 0;
      });
      const avgResponseRate = responseCounts.length > 0
        ? responseCounts.reduce((sum, rate) => sum + rate, 0) / responseCounts.length
        : 0;
      
      setStats({
        totalEvents: allEvents.length,
        upcomingEvents: upcoming.length,
        totalParticipants,
        avgResponseRate: Math.round(avgResponseRate),
      });
    } catch (error) {
      console.error('Failed to load admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNavigation = (screen: string) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.push(screen as any);
  };

  if (!isAuthenticated) {
    return (
      <DesktopLayout>
      <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.loginContainer}>
          <View style={styles.loginCard}>
            <View style={styles.lockIconContainer}>
              <IconSymbol name="lock.fill" size={48} color={AdminColors.primary} />
            </View>
            <ThemedText style={styles.loginTitle}>Admin Dashboard</ThemedText>
            <ThemedText style={styles.loginSubtitle}>
              Please log in to access the admin dashboard
            </ThemedText>
          </View>
        </View>
      </ThemedView>
      </DesktopLayout>
    );
  }

  return (
    <DesktopLayout>
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top + 40, 80) }]}>
        <View>
          <ThemedText style={styles.headerTitle}>Admin Dashboard</ThemedText>
          <ThemedText style={styles.headerSubtitle}>
            Welcome back, {user?.name || user?.email || 'Admin'}
          </ThemedText>
        </View>
      </View>

      {/* Statistics Cards */}
      <View style={styles.statsSection}>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <View style={[styles.statIconContainer, { backgroundColor: AdminColors.primaryLight }]}>
              <IconSymbol name="calendar" size={24} color={AdminColors.primary} />
            </View>
            <View style={styles.statContent}>
              <ThemedText style={styles.statValue}>{stats.totalEvents}</ThemedText>
              <ThemedText style={styles.statLabel}>Total Events</ThemedText>
            </View>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIconContainer, { backgroundColor: AdminColors.successLight }]}>
              <IconSymbol name="clock.fill" size={24} color={AdminColors.success} />
            </View>
            <View style={styles.statContent}>
              <ThemedText style={styles.statValue}>{stats.upcomingEvents}</ThemedText>
              <ThemedText style={styles.statLabel}>Upcoming</ThemedText>
            </View>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIconContainer, { backgroundColor: AdminColors.infoLight }]}>
              <IconSymbol name="person.2.fill" size={24} color={AdminColors.info} />
            </View>
            <View style={styles.statContent}>
              <ThemedText style={styles.statValue}>{stats.totalParticipants}</ThemedText>
              <ThemedText style={styles.statLabel}>Participants</ThemedText>
            </View>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIconContainer, { backgroundColor: AdminColors.warningLight }]}>
              <IconSymbol name="checkmark.circle.fill" size={24} color={AdminColors.warning} />
            </View>
            <View style={styles.statContent}>
              <ThemedText style={styles.statValue}>{stats.avgResponseRate}%</ThemedText>
              <ThemedText style={styles.statLabel}>Response Rate</ThemedText>
            </View>
          </View>
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.actionsSection}>
        <ThemedText style={styles.sectionTitle}>Quick Actions</ThemedText>
        
        <View style={styles.actionsGrid}>
          <Pressable
            style={({ pressed }) => [
              styles.actionCard,
              pressed && styles.actionCardPressed,
            ]}
            onPress={() => handleNavigation('/admin/events')}
          >
            <View style={[styles.actionIconContainer, { backgroundColor: AdminColors.primaryLight }]}>
              <IconSymbol name="calendar" size={28} color={AdminColors.primary} />
            </View>
            <View style={styles.actionContent}>
              <ThemedText style={styles.actionTitle}>Event Management</ThemedText>
              <ThemedText style={styles.actionDescription}>
                View, search, and manage all events
              </ThemedText>
            </View>
            <IconSymbol name="chevron.right" size={20} color={AdminColors.gray400} />
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.actionCard,
              pressed && styles.actionCardPressed,
            ]}
            onPress={() => handleNavigation('/admin/attendance')}
          >
            <View style={[styles.actionIconContainer, { backgroundColor: AdminColors.successLight }]}>
              <IconSymbol name="checkmark.circle.fill" size={28} color={AdminColors.success} />
            </View>
            <View style={styles.actionContent}>
              <ThemedText style={styles.actionTitle}>Attendance Records</ThemedText>
              <ThemedText style={styles.actionDescription}>
                Track attendance and export reports
              </ThemedText>
            </View>
            <IconSymbol name="chevron.right" size={20} color={AdminColors.gray400} />
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.actionCard,
              pressed && styles.actionCardPressed,
            ]}
            onPress={() => handleNavigation('/admin/participants')}
          >
            <View style={[styles.actionIconContainer, { backgroundColor: AdminColors.infoLight }]}>
              <IconSymbol name="person.2.fill" size={28} color={AdminColors.info} />
            </View>
            <View style={styles.actionContent}>
              <ThemedText style={styles.actionTitle}>Participant Directory</ThemedText>
              <ThemedText style={styles.actionDescription}>
                Manage contacts and view participation
              </ThemedText>
            </View>
            <IconSymbol name="chevron.right" size={20} color={AdminColors.gray400} />
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.actionCard,
              pressed && styles.actionCardPressed,
            ]}
            onPress={() => handleNavigation('/admin/analytics')}
          >
            <View style={[styles.actionIconContainer, { backgroundColor: AdminColors.warningLight }]}>
              <IconSymbol name="chart.bar.fill" size={28} color={AdminColors.warning} />
            </View>
            <View style={styles.actionContent}>
              <ThemedText style={styles.actionTitle}>Analytics & Insights</ThemedText>
              <ThemedText style={styles.actionDescription}>
                View statistics and generate reports
              </ThemedText>
            </View>
            <IconSymbol name="chevron.right" size={20} color={AdminColors.gray400} />
          </Pressable>
        </View>
      </View>

      {/* Danger Zone */}
      <View style={styles.dangerSection}>
        <ThemedText style={styles.sectionTitle}>Danger Zone</ThemedText>
        <ThemedText style={styles.dangerDescription}>
          Reset all data to start fresh. This will delete all local events and cloud data.
        </ThemedText>
        
        <Pressable
          style={({ pressed }) => [
            styles.resetButton,
            pressed && styles.resetButtonPressed,
          ]}
          onPress={handleResetAllData}
        >
          <IconSymbol name="trash.fill" size={20} color="#fff" />
          <ThemedText style={styles.resetButtonText}>Reset All Data</ThemedText>
        </Pressable>
      </View>
    </ScrollView>
    </DesktopLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AdminColors.gray50,
  },
  
  // Login State
  loginContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: AdminSpacing['4xl'],
  },
  loginCard: {
    backgroundColor: AdminColors.surface,
    borderRadius: AdminBorderRadius.xl,
    padding: AdminSpacing['4xl'],
    alignItems: 'center',
    maxWidth: 400,
    ...Platform.select({
      web: {
        boxShadow: AdminShadows.xl,
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 10,
      },
    }),
  },
  lockIconContainer: {
    marginBottom: AdminSpacing.xl,
  },
  loginTitle: {
    fontSize: AdminTypography['3xl'],
    fontWeight: '700' as any,
    marginBottom: AdminSpacing.sm,
    textAlign: 'center',
  },
  loginSubtitle: {
    fontSize: AdminTypography.base,
    color: AdminColors.gray600,
    textAlign: 'center',
    lineHeight: AdminTypography.relaxed * AdminTypography.base,
  },
  
  // Header
  header: {
    paddingHorizontal: AdminSpacing['4xl'],
    paddingBottom: AdminSpacing['4xl'],
    backgroundColor: AdminColors.surface,
    borderBottomWidth: 1,
    borderBottomColor: AdminColors.border,
  },
  headerTitle: {
    fontSize: AdminTypography['3xl'],
    fontWeight: '700' as any,
    marginBottom: AdminSpacing.xs,
    color: AdminColors.gray900,
    flexShrink: 1,
    lineHeight: AdminTypography['3xl'] * 1.3,
  },
  headerSubtitle: {
    fontSize: AdminTypography.lg,
    fontWeight: '400' as any,
    color: AdminColors.gray600,
    lineHeight: AdminTypography.normal * AdminTypography.lg,
  },
  
  // Statistics Section
  statsSection: {
    padding: AdminSpacing['4xl'],
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: AdminSpacing.xl,
  },
  statCard: {
    flex: 1,
    minWidth: 240,
    backgroundColor: AdminColors.surface,
    borderRadius: AdminBorderRadius.lg,
    padding: AdminSpacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: AdminSpacing.base,
    borderWidth: 1,
    borderColor: AdminColors.border,
    ...Platform.select({
      web: {
        boxShadow: AdminShadows.sm,
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
      },
    }),
  },
  statIconContainer: {
    width: 56,
    height: 56,
    borderRadius: AdminBorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statContent: {
    flex: 1,
  },
  statValue: {
    fontSize: AdminTypography.xl,
    fontWeight: '700' as any,
    color: AdminColors.gray900,
    marginBottom: AdminSpacing.xs,
  },
  statLabel: {
    fontSize: AdminTypography.sm,
    color: AdminColors.gray600,
    fontWeight: '500' as any,
  },
  
  // Actions Section
  actionsSection: {
    paddingHorizontal: AdminSpacing['4xl'],
    paddingBottom: AdminSpacing['4xl'],
  },
  sectionTitle: {
    fontSize: AdminTypography['2xl'],
    fontWeight: '700' as any,
    color: AdminColors.gray900,
    marginBottom: AdminSpacing.xl,
  },
  actionsGrid: {
    gap: AdminSpacing.base,
  },
  actionCard: {
    backgroundColor: AdminColors.surface,
    borderRadius: AdminBorderRadius.lg,
    padding: AdminSpacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: AdminSpacing.base,
    borderWidth: 1,
    borderColor: AdminColors.border,
    ...Platform.select({
      web: {
        boxShadow: AdminShadows.sm,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
      },
    }),
  },
  actionCardPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },
  actionIconContainer: {
    width: 56,
    height: 56,
    borderRadius: AdminBorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionContent: {
    flex: 1,
    gap: AdminSpacing.xs,
  },
  actionTitle: {
    fontSize: AdminTypography.lg,
    fontWeight: '600' as any,
    color: AdminColors.gray900,
  },
  actionDescription: {
    fontSize: AdminTypography.sm,
    color: AdminColors.gray600,
    lineHeight: AdminTypography.normal * AdminTypography.sm,
  },
  
  // Danger Zone
  dangerSection: {
    paddingHorizontal: AdminSpacing['4xl'],
    paddingTop: AdminSpacing['4xl'],
    paddingBottom: AdminSpacing['4xl'],
    borderTopWidth: 2,
    borderTopColor: '#FEE2E2',
    backgroundColor: '#FFF5F5',
    marginTop: AdminSpacing['2xl'],
  },
  dangerDescription: {
    fontSize: AdminTypography.sm,
    color: AdminColors.gray600,
    lineHeight: AdminTypography.relaxed * AdminTypography.sm,
    marginBottom: AdminSpacing.xl,
  },
  resetButton: {
    backgroundColor: '#DC2626',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: AdminSpacing.sm,
    paddingVertical: AdminSpacing.lg,
    paddingHorizontal: AdminSpacing['2xl'],
    borderRadius: AdminBorderRadius.md,
    ...Platform.select({
      web: {
        boxShadow: AdminShadows.md,
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
      },
    }),
  },
  resetButtonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  resetButtonText: {
    color: '#fff',
    fontSize: AdminTypography.base,
    fontWeight: '600' as any,
  },
});
