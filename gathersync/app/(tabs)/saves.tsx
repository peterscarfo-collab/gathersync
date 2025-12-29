import { useState, useCallback } from 'react';
import { FlatList, Pressable, StyleSheet, View, Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { DesktopLayout } from '@/components/desktop-layout';
import { useThemeColor } from '@/hooks/use-theme-color';
import { eventsLocalStorage, snapshotsLocalStorage, templatesLocalStorage } from '@/lib/local-storage';
import { recurringTemplatesStorage } from '@/lib/recurring-storage';
import { getMonthName } from '@/lib/calendar-utils';
import type { EventSnapshot, GroupTemplate, RecurringEventTemplate } from '@/types/models';
import { useRouter } from 'expo-router';

type TabType = 'snapshots' | 'templates' | 'recurring' | 'archive';

export default function SavesScreen() {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<TabType>('snapshots');
  const router = useRouter();
  const [snapshots, setSnapshots] = useState<EventSnapshot[]>([]);
  const [templates, setTemplates] = useState<GroupTemplate[]>([]);
  const [recurringTemplates, setRecurringTemplates] = useState<RecurringEventTemplate[]>([]);
  const [archivedEvents, setArchivedEvents] = useState<any[]>([]);

  const tintColor = useThemeColor({}, 'tint');
  const backgroundColor = useThemeColor({}, 'background');
  const surfaceColor = useThemeColor({}, 'surface');
  const textSecondaryColor = useThemeColor({}, 'textSecondary');

  const loadData = async () => {
    try {
      const [loadedSnapshots, loadedTemplates, loadedRecurring, allEvents] = await Promise.all([
        snapshotsLocalStorage.getAll(),
        templatesLocalStorage.getAll(),
        recurringTemplatesStorage.getAll(),
        eventsLocalStorage.getAll(),
      ]);
      
      const archived = allEvents.filter(e => e.archived);
      
      loadedSnapshots.sort((a, b) => 
        new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
      );
      loadedTemplates.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      
      setSnapshots(loadedSnapshots);
      setTemplates(loadedTemplates);
      setRecurringTemplates(loadedRecurring);
      setArchivedEvents(archived);
    } catch (error) {
      console.error('Failed to load saves:', error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const handleRestoreSnapshot = async (snapshot: EventSnapshot) => {
    Alert.alert(
      'Restore Event',
      `Restore "${snapshot.name}" from ${new Date(snapshot.savedAt).toLocaleDateString()}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          onPress: async () => {
            try {
              // Check if event still exists
              const existingEvent = await eventsLocalStorage.getById(snapshot.eventId);
              
              if (existingEvent) {
                // Update existing event
                await eventsLocalStorage.update(snapshot.eventId, {
                  ...snapshot.event,
                  updatedAt: new Date().toISOString(),
                });
              } else {
                // Create new event from snapshot
                // Note: add() will automatically set createdAt and updatedAt
                const { id, createdAt, updatedAt, ...eventData } = snapshot.event;
                await eventsLocalStorage.add(eventData);
              }
              
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('Success', 'Event restored successfully!');
            } catch (error) {
              console.error('Failed to restore snapshot:', error);
              Alert.alert('Error', 'Failed to restore event. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleDeleteSnapshot = (snapshotId: string) => {
    Alert.alert(
      'Delete Snapshot',
      'Are you sure you want to delete this saved event?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await snapshotsLocalStorage.delete(snapshotId);
            loadData();
          },
        },
      ]
    );
  };

  const handleDeleteTemplate = (templateId: string) => {
    Alert.alert(
      'Delete Template',
      'Are you sure you want to delete this group template?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await templatesLocalStorage.delete(templateId);
            loadData();
          },
        },
      ]
    );
  };

  const renderSnapshot = ({ item }: { item: EventSnapshot }) => (
    <Pressable
      style={[styles.card, { backgroundColor: surfaceColor }]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        handleRestoreSnapshot(item);
      }}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleRow}>
          <IconSymbol name="calendar" size={20} color={tintColor} />
          <ThemedText type="defaultSemiBold" style={styles.cardTitle} numberOfLines={1}>
            {item.name}
          </ThemedText>
        </View>
        <Pressable
          onPress={() => handleDeleteSnapshot(item.id)}
          hitSlop={8}
        >
          <IconSymbol name="trash.fill" size={20} color={textSecondaryColor} />
        </Pressable>
      </View>
      
      <View style={styles.cardDetails}>
        <ThemedText style={[styles.detailText, { color: textSecondaryColor }]}>
          {getMonthName(item.event.month)} {item.event.year}
        </ThemedText>
        <ThemedText style={[styles.detailText, { color: textSecondaryColor }]}>
          •
        </ThemedText>
        <ThemedText style={[styles.detailText, { color: textSecondaryColor }]}>
          {item.event.participants.length} {item.event.participants.length === 1 ? 'person' : 'people'}
        </ThemedText>
      </View>

      <ThemedText style={[styles.savedDate, { color: textSecondaryColor }]}>
        Saved {new Date(item.savedAt).toLocaleDateString()}
      </ThemedText>
    </Pressable>
  );

  const renderTemplate = ({ item }: { item: GroupTemplate }) => (
    <Pressable
      style={[styles.card, { backgroundColor: surfaceColor }]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        // TODO: Implement use template functionality
        Alert.alert('Use Template', 'Template usage will be implemented in create event screen');
      }}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleRow}>
          <IconSymbol name="person.2.fill" size={20} color={tintColor} />
          <ThemedText type="defaultSemiBold" style={styles.cardTitle} numberOfLines={1}>
            {item.name}
          </ThemedText>
        </View>
        <Pressable
          onPress={() => handleDeleteTemplate(item.id)}
          hitSlop={8}
        >
          <IconSymbol name="trash.fill" size={20} color={textSecondaryColor} />
        </Pressable>
      </View>
      
      <ThemedText style={[styles.detailText, { color: textSecondaryColor }]}>
        {item.participantNames.length} {item.participantNames.length === 1 ? 'person' : 'people'}
      </ThemedText>

      <ThemedText style={[styles.savedDate, { color: textSecondaryColor }]}>
        Created {new Date(item.createdAt).toLocaleDateString()}
      </ThemedText>
    </Pressable>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <IconSymbol 
        name={activeTab === 'snapshots' ? 'calendar' : 'person.2.fill'} 
        size={64} 
        color={textSecondaryColor} 
      />
      <ThemedText type="subtitle" style={styles.emptyTitle}>
        {activeTab === 'snapshots' ? 'No Saved Events' : 'No Templates'}
      </ThemedText>
      <ThemedText style={[styles.emptyText, { color: textSecondaryColor }]}>
        {activeTab === 'snapshots' 
          ? 'Save event snapshots to restore them later'
          : 'Create group templates to quickly add participants'}
      </ThemedText>
    </View>
  );
  return (
    <DesktopLayout>
    <ThemedView style={styles.container}>
      <View
        style={[
          styles.header,
          {
            paddingTop: Math.max(insets.top, 16),
            paddingBottom: 16,
          },
        ]}
      >
        <ThemedText type="title">Saves</ThemedText>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push('/about' as any);
          }}
          style={styles.aboutButton}
        >
          <IconSymbol name="info.circle" size={24} color={tintColor} />
        </Pressable>
      </View>

      {/* Segmented Control */}
      <View style={[styles.segmentedControl, { backgroundColor: surfaceColor }]}>
        <Pressable
          style={[
            styles.segment,
            activeTab === 'snapshots' && [styles.segmentActive, { backgroundColor: tintColor }],
          ]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setActiveTab('snapshots');
          }}
        >
          <ThemedText
            style={[
              styles.segmentText,
              activeTab === 'snapshots' && styles.segmentTextActive,
            ]}
          >
            Event History
          </ThemedText>
        </Pressable>
        <Pressable
          style={[
            styles.segment,
            activeTab === 'templates' && [styles.segmentActive, { backgroundColor: tintColor }],
          ]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setActiveTab('templates');
          }}
        >
          <ThemedText
            style={[
              styles.segmentText,
              activeTab === 'templates' && styles.segmentTextActive,
            ]}
          >
            Templates
          </ThemedText>
        </Pressable>
        <Pressable
          style={[
            styles.segment,
            activeTab === 'recurring' && [styles.segmentActive, { backgroundColor: tintColor }],
          ]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setActiveTab('recurring');
          }}
        >
          <ThemedText
            style={[
              styles.segmentText,
              activeTab === 'recurring' && styles.segmentTextActive,
            ]}>
            Recurring
          </ThemedText>
        </Pressable>
        <Pressable
          style={[
            styles.segment,
            activeTab === 'archive' && [styles.segmentActive, { backgroundColor: tintColor }],
          ]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setActiveTab('archive');
          }}
        >
          <ThemedText
            style={[
              styles.segmentText,
              activeTab === 'archive' && styles.segmentTextActive,
            ]}
          >
            Archive
          </ThemedText>
        </Pressable>
      </View>

      {activeTab === 'snapshots' ? (
        <View style={{ flex: 1 }}>
          {snapshots.length > 0 && (
            <Pressable
              style={[styles.clearAllButton, { backgroundColor: '#ef4444' }]}
              onPress={() => {
                Alert.alert(
                  'Clear All History',
                  `Are you sure you want to delete all ${snapshots.length} saved events? This cannot be undone.`,
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Delete All',
                      style: 'destructive',
                      onPress: async () => {
                        try {
                          // Delete all snapshots
                          for (const snapshot of snapshots) {
                            await snapshotsLocalStorage.delete(snapshot.id);
                          }
                          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                          loadData();
                        } catch (error) {
                          console.error('Failed to clear history:', error);
                          Alert.alert('Error', 'Failed to clear history. Please try again.');
                        }
                      },
                    },
                  ]
                );
              }}
            >
              <IconSymbol name="trash.fill" size={16} color="#fff" />
              <ThemedText style={styles.clearAllButtonText}>Clear All History ({snapshots.length})</ThemedText>
            </Pressable>
          )}
          <FlatList
            data={snapshots}
            keyExtractor={(item) => item.id}
            renderItem={renderSnapshot}
            ListEmptyComponent={renderEmpty}
            contentContainerStyle={[
              styles.listContent,
              snapshots.length === 0 && styles.listContentEmpty,
            ]}
            showsVerticalScrollIndicator={false}
          />
        </View>
      ) : activeTab === 'templates' ? (
        <FlatList
          data={templates}
          keyExtractor={(item) => item.id}
          renderItem={renderTemplate}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={[
            styles.listContent,
            templates.length === 0 && styles.listContentEmpty,
          ]}
          showsVerticalScrollIndicator={false}
        />
      ) : activeTab === 'recurring' ? (
        <View style={styles.container}>
          <Pressable
            style={[styles.createButton, { backgroundColor: tintColor, margin: 20 }]}
            onPress={() => router.push('/create-recurring-template' as any)}
          >
            <ThemedText style={styles.createButtonText}>+ Create Recurring Template</ThemedText>
          </Pressable>
          <FlatList
            data={recurringTemplates}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={[styles.card, { backgroundColor: surfaceColor, marginHorizontal: 20, marginBottom: 12 }]}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardTitleRow}>
                    <IconSymbol name="arrow.clockwise" size={20} color={tintColor} />
                    <ThemedText type="defaultSemiBold" style={styles.cardTitle} numberOfLines={1}>
                      {item.name}
                    </ThemedText>
                  </View>
                </View>
                <ThemedText style={[styles.detailText, { color: textSecondaryColor }]}>
                  {item.pattern.charAt(0).toUpperCase() + item.pattern.slice(1)} • {item.participantNames.length} participants
                </ThemedText>
                <ThemedText style={[styles.detailText, { color: textSecondaryColor, marginTop: 4 }]}>
                  {item.active ? '✓ Active' : '○ Inactive'}
                </ThemedText>
              </View>
            )}
            ListEmptyComponent={() => (
              <View style={styles.emptyContainer}>
                <ThemedText style={[styles.emptyText, { color: textSecondaryColor }]}>
                  Create recurring templates for regular gatherings
                </ThemedText>
              </View>
            )}
            contentContainerStyle={[
              styles.listContent,
              recurringTemplates.length === 0 && styles.listContentEmpty,
            ]}
            showsVerticalScrollIndicator={false}
          />
        </View>
      ) : (
        <FlatList
          data={archivedEvents}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Pressable
              style={[styles.card, { backgroundColor: surfaceColor }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
            >
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleRow}>
                  <IconSymbol name="calendar" size={20} color={tintColor} />
                  <ThemedText type="defaultSemiBold" style={styles.cardTitle} numberOfLines={1}>
                    {item.name}
                  </ThemedText>
                </View>
              </View>
              <ThemedText style={[styles.detailText, { color: textSecondaryColor }]}>
                {getMonthName(item.month)} {item.year} • {item.participants.length} people
              </ThemedText>
            </Pressable>
          )}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={[
            styles.listContent,
            archivedEvents.length === 0 && styles.listContentEmpty,
          ]}
          showsVerticalScrollIndicator={false}
        />
      )}
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
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  aboutButton: {
    padding: 8,
  },
  segmentedControl: {
    flexDirection: 'row',
    margin: 16,
    padding: 4,
    borderRadius: 12,
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  segmentActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  segmentTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  listContentEmpty: {
    flexGrow: 1,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  cardTitle: {
    flex: 1,
    fontSize: 16,
    lineHeight: 24,
  },
  cardDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  detailText: {
    fontSize: 14,
    lineHeight: 20,
  },
  savedDate: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    marginTop: 24,
    marginBottom: 8,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
  },
  createButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
  },
  clearAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 12,
    borderRadius: 12,
  },
  clearAllButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
});
