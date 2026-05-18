import { useState } from 'react';
import { StyleSheet, ScrollView, View, Pressable, Platform, Alert, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as DocumentPicker from 'expo-document-picker';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ProfileIcon } from '@/components/profile-icon';
import { DesktopLayout } from '@/components/desktop-layout';
import { useAuth } from '@/hooks/use-auth';
import { exportBackup, downloadBackup, readBackupFile, importBackup, getBackupStats } from '@/lib/backup';
import { AdminColors, AdminTypography, AdminSpacing, AdminBorderRadius, AdminShadows } from '@/constants/admin-theme';

export default function BackupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, isAuthenticated } = useAuth();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 768;
  
  const [loading, setLoading] = useState(false);

  const handleExportBackup = async () => {
    try {
      setLoading(true);
      const backupData = await exportBackup();
      await downloadBackup(backupData);
      
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('[Backup] Export failed:', error);
      if (Platform.OS === 'web') {
        alert('Failed to export backup. Please try again.');
      } else {
        Alert.alert('Error', 'Failed to export backup. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreBackup = async () => {
    try {
      setLoading(true);
      
      let fileUri: string | null = null;

      if (Platform.OS === 'web') {
        // Web: use a hidden file input
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json';
        
        const fileSelected = new Promise<string | null>((resolve) => {
          input.onchange = (e: any) => {
            const file = e.target.files?.[0];
            if (!file) {
              resolve(null);
              return;
            }
            const reader = new FileReader();
            reader.onload = (event) => {
              resolve(event.target?.result as string);
            };
            reader.readAsDataURL(file);
          };
          input.oncancel = () => resolve(null);
        });
        
        input.click();
        fileUri = await fileSelected;
        
        if (!fileUri) {
          setLoading(false);
          return; // User cancelled
        }
      } else {
        // Mobile: use expo-document-picker
        const result = await DocumentPicker.getDocumentAsync({
          type: 'application/json',
          copyToCacheDirectory: true,
        });
        
        if (result.canceled) {
          setLoading(false);
          return;
        }
        
        fileUri = result.assets[0].uri;
      }

      // Read and validate backup
      const backupData = await readBackupFile(fileUri);
      const stats = getBackupStats(backupData);

      const confirmMessage = `Are you sure you want to restore this backup?\n\n` +
        `This backup contains:\n` +
        `• ${stats.eventsCount} Events\n` +
        `• ${stats.snapshotsCount} Snapshots\n` +
        `• ${stats.templatesCount} Templates\n\n` +
        `Restoring will merge these records into your current data.`;

      if (Platform.OS === 'web') {
        const confirmed = window.confirm(confirmMessage);
        if (!confirmed) {
          setLoading(false);
          return;
        }
        await performRestore(backupData);
      } else {
        Alert.alert(
          'Restore Backup',
          confirmMessage,
          [
            { text: 'Cancel', style: 'cancel', onPress: () => setLoading(false) },
            {
              text: 'Restore',
              style: 'destructive',
              onPress: async () => {
                await performRestore(backupData);
              },
            },
          ]
        );
      }
    } catch (error) {
      console.error('[Backup] Restore failed:', error);
      if (Platform.OS === 'web') {
        alert('Failed to read or restore backup. Please ensure it is a valid GatherSync backup file.');
      } else {
        Alert.alert('Error', 'Failed to read or restore backup. Please ensure it is a valid GatherSync backup file.');
      }
      setLoading(false);
    }
  };

  const performRestore = async (backupData: any) => {
    try {
      await importBackup(backupData);
      
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      
      if (Platform.OS === 'web') {
        alert('Backup restored successfully!');
      } else {
        Alert.alert('Success', 'Backup restored successfully!');
      }
    } catch (error) {
      console.error('[Backup] Import failed:', error);
      if (Platform.OS === 'web') {
        alert('Failed to restore backup. Please try again.');
      } else {
        Alert.alert('Error', 'Failed to restore backup. Please try again.');
      }
    } finally {
      setLoading(false);
    }
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
            <ThemedText style={styles.loginTitle}>Backup & Restore</ThemedText>
            <ThemedText style={styles.loginSubtitle}>
              Please log in to access your backups
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
      <View style={[styles.header, { paddingTop: Math.max(insets.top + 40, 80), flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
        <View>
          <ThemedText style={styles.headerTitle}>Backup & Restore</ThemedText>
          <ThemedText style={styles.headerSubtitle}>
            Secure your data and restore when needed
          </ThemedText>
        </View>
        {isDesktop && <ProfileIcon />}
      </View>

      {/* Actions Section */}
      <View style={styles.actionsSection}>
        <ThemedText style={styles.sectionTitle}>Site Security</ThemedText>
        
        <View style={styles.actionsGrid}>
          {/* Export Backup */}
          <Pressable
            style={({ pressed }) => [
              styles.actionCard,
              pressed && styles.actionCardPressed,
              loading && { opacity: 0.5 }
            ]}
            onPress={handleExportBackup}
            disabled={loading}
          >
            <View style={[styles.actionIconContainer, { backgroundColor: AdminColors.successLight }]}>
              <IconSymbol name="arrow.down.doc.fill" size={28} color={AdminColors.success} />
            </View>
            <View style={styles.actionContent}>
              <ThemedText style={styles.actionTitle}>Download Full Backup</ThemedText>
              <ThemedText style={styles.actionDescription}>
                Export all your events, participants, and settings to a secure JSON file.
              </ThemedText>
            </View>
            <IconSymbol name="chevron.right" size={20} color={AdminColors.gray400} />
          </Pressable>

          {/* Restore Backup */}
          <Pressable
            style={({ pressed }) => [
              styles.actionCard,
              pressed && styles.actionCardPressed,
              loading && { opacity: 0.5 }
            ]}
            onPress={handleRestoreBackup}
            disabled={loading}
          >
            <View style={[styles.actionIconContainer, { backgroundColor: AdminColors.warningLight }]}>
              <IconSymbol name="arrow.up.doc.fill" size={28} color={AdminColors.warning} />
            </View>
            <View style={styles.actionContent}>
              <ThemedText style={styles.actionTitle}>Restore from Backup</ThemedText>
              <ThemedText style={styles.actionDescription}>
                Upload a previously downloaded backup file to restore your site data.
              </ThemedText>
            </View>
            <IconSymbol name="chevron.right" size={20} color={AdminColors.gray400} />
          </Pressable>
        </View>
      </View>

      {/* Information Section */}
      <View style={styles.infoSection}>
        <View style={styles.infoCard}>
          <IconSymbol name="info.circle.fill" size={24} color={AdminColors.info} />
          <View style={styles.infoContent}>
            <ThemedText style={styles.infoTitle}>About Backups</ThemedText>
            <ThemedText style={styles.infoText}>
              Backups contain all your events, participant lists, and availability data. Restoring a backup will merge the data with your current site. If an event already exists, it will be updated with the data from the backup.
            </ThemedText>
          </View>
        </View>
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
  
  // Actions Section
  actionsSection: {
    paddingHorizontal: AdminSpacing['4xl'],
    paddingTop: AdminSpacing['4xl'],
    paddingBottom: AdminSpacing['2xl'],
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
  
  // Info Section
  infoSection: {
    paddingHorizontal: AdminSpacing['4xl'],
    paddingBottom: AdminSpacing['4xl'],
  },
  infoCard: {
    backgroundColor: AdminColors.infoLight,
    borderRadius: AdminBorderRadius.lg,
    padding: AdminSpacing.xl,
    flexDirection: 'row',
    gap: AdminSpacing.base,
    borderWidth: 1,
    borderColor: AdminColors.info + '40',
  },
  infoContent: {
    flex: 1,
    gap: AdminSpacing.xs,
  },
  infoTitle: {
    fontSize: AdminTypography.base,
    fontWeight: '600' as any,
    color: AdminColors.info,
  },
  infoText: {
    fontSize: AdminTypography.sm,
    color: AdminColors.gray700,
    lineHeight: AdminTypography.relaxed * AdminTypography.sm,
  },
});
