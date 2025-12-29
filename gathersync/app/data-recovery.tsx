import { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, View, Pressable, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';
import { getAutoBackups, restoreFromAutoBackup, deleteAutoBackup, type AutoBackup } from '@/lib/auto-backup';

export default function DataRecoveryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tintColor = useThemeColor({}, 'tint');
  const textColor = useThemeColor({}, 'text');
  const textSecondaryColor = useThemeColor({ light: '#666', dark: '#999' }, 'text');
  
  const [backups, setBackups] = useState<AutoBackup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBackups();
  }, []);

  const loadBackups = async () => {
    try {
      const allBackups = await getAutoBackups();
      setBackups(allBackups);
    } catch (error) {
      console.error('[Recovery] Failed to load backups:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (backup: AutoBackup) => {
    Alert.alert(
      'Restore Backup',
      `Restore from ${new Date(backup.timestamp).toLocaleString()}?\n\nThis will restore:\n• ${backup.data.events.length} events\n• ${backup.data.snapshots.length} snapshots\n• ${backup.data.templates.length} templates\n\nReason: ${backup.reason}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          style: 'destructive',
          onPress: async () => {
            try {
              const success = await restoreFromAutoBackup(backup.id);
              if (success) {
                Alert.alert('Success', 'Data restored successfully!', [
                  { text: 'OK', onPress: () => router.back() }
                ]);
              } else {
                Alert.alert('Error', 'Failed to restore backup');
              }
            } catch (error) {
              Alert.alert('Error', `Restore failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
          },
        },
      ]
    );
  };

  const handleDelete = async (backup: AutoBackup) => {
    Alert.alert(
      'Delete Backup',
      `Delete backup from ${new Date(backup.timestamp).toLocaleString()}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteAutoBackup(backup.id);
            await loadBackups();
          },
        },
      ]
    );
  };

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) + 16 }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <IconSymbol name="chevron.left" size={24} color={tintColor} />
        </Pressable>
        <ThemedText type="title" style={styles.headerTitle}>
          Data Recovery
        </ThemedText>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        <View style={styles.infoCard}>
          <IconSymbol name="info.circle" size={24} color={tintColor} />
          <ThemedText style={[styles.infoText, { color: textSecondaryColor }]}>
            Automatic backups are created before risky operations like cloud migration or data import. You can restore from any backup below.
          </ThemedText>
        </View>

        {loading ? (
          <View style={styles.emptyContainer}>
            <ThemedText style={{ color: textSecondaryColor }}>Loading backups...</ThemedText>
          </View>
        ) : backups.length === 0 ? (
          <View style={styles.emptyContainer}>
            <IconSymbol name="cloud" size={64} color={textSecondaryColor} />
            <ThemedText type="subtitle" style={styles.emptyTitle}>
              No Backups Yet
            </ThemedText>
            <ThemedText style={[styles.emptyDescription, { color: textSecondaryColor }]}>
              Automatic backups will appear here when you perform operations like cloud migration or data import.
            </ThemedText>
          </View>
        ) : (
          <View style={styles.backupsList}>
            {backups.map((backup) => (
              <View key={backup.id} style={[styles.backupCard, { borderColor: tintColor + '20' }]}>
                <View style={styles.backupHeader}>
                  <View style={[styles.backupIcon, { backgroundColor: tintColor + '10' }]}>
                    <IconSymbol name="clock.fill" size={20} color={tintColor} />
                  </View>
                  <View style={styles.backupInfo}>
                    <ThemedText style={styles.backupDate}>
                      {new Date(backup.timestamp).toLocaleString()}
                    </ThemedText>
                    <ThemedText style={[styles.backupReason, { color: textSecondaryColor }]}>
                      {backup.reason}
                    </ThemedText>
                  </View>
                </View>

                <View style={styles.backupStats}>
                  <View style={styles.stat}>
                    <ThemedText style={styles.statValue}>{backup.data.events.length}</ThemedText>
                    <ThemedText style={[styles.statLabel, { color: textSecondaryColor }]}>Events</ThemedText>
                  </View>
                  <View style={styles.stat}>
                    <ThemedText style={styles.statValue}>{backup.data.snapshots.length}</ThemedText>
                    <ThemedText style={[styles.statLabel, { color: textSecondaryColor }]}>Snapshots</ThemedText>
                  </View>
                  <View style={styles.stat}>
                    <ThemedText style={styles.statValue}>{backup.data.templates.length}</ThemedText>
                    <ThemedText style={[styles.statLabel, { color: textSecondaryColor }]}>Templates</ThemedText>
                  </View>
                </View>

                <View style={styles.backupActions}>
                  <Pressable
                    style={[styles.actionButton, { backgroundColor: tintColor }]}
                    onPress={() => handleRestore(backup)}
                  >
                    <IconSymbol name="arrow.triangle.2.circlepath" size={16} color="#fff" />
                    <ThemedText style={styles.actionButtonText}>Restore</ThemedText>
                  </Pressable>
                  <Pressable
                    style={[styles.actionButton, styles.deleteButton]}
                    onPress={() => handleDelete(backup)}
                  >
                    <IconSymbol name="trash.fill" size={16} color="#ef4444" />
                    <ThemedText style={[styles.actionButtonText, { color: '#ef4444' }]}>Delete</ThemedText>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 12,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  infoCard: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    backgroundColor: '#f0f9ff',
    borderRadius: 12,
    marginBottom: 24,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyTitle: {
    marginTop: 16,
  },
  emptyDescription: {
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
    maxWidth: 300,
  },
  backupsList: {
    gap: 16,
  },
  backupCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 16,
  },
  backupHeader: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  backupIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backupInfo: {
    flex: 1,
    gap: 4,
  },
  backupDate: {
    fontSize: 16,
    fontWeight: '600',
  },
  backupReason: {
    fontSize: 14,
  },
  backupStats: {
    flexDirection: 'row',
    gap: 24,
  },
  stat: {
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 12,
  },
  backupActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  deleteButton: {
    backgroundColor: '#fef2f2',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});
