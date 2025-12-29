import { useState, useEffect } from 'react';
import {
  StyleSheet,
  ScrollView,
  View,
  Pressable,
  TextInput,
  Platform,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { eventsLocalStorage } from '@/lib/local-storage';
import type { Event } from '@/types/models';
import { AdminColors, AdminTypography, AdminSpacing, AdminBorderRadius, AdminShadows } from '@/constants/admin-theme';

type FilterType = 'all' | 'upcoming' | 'past' | 'flexible' | 'fixed';

export default function AdminEventsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const [events, setEvents] = useState<Event[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadEvents();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [events, searchQuery, filter]);

  const loadEvents = async () => {
    try {
      const allEvents = await eventsLocalStorage.getAll();
      setEvents(allEvents);
    } catch (error) {
      console.error('Failed to load events:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...events];
    const now = new Date();

    // Apply type filter
    if (filter === 'flexible') {
      filtered = filtered.filter(e => e.eventType === 'flexible');
    } else if (filter === 'fixed') {
      filtered = filtered.filter(e => e.eventType === 'fixed');
    } else if (filter === 'upcoming') {
      filtered = filtered.filter(e => {
        if (e.eventType === 'fixed' && e.fixedDate) {
          return new Date(e.fixedDate).getTime() > now.getTime();
        }
        return true;
      });
    } else if (filter === 'past') {
      filtered = filtered.filter(e => {
        if (e.eventType === 'fixed' && e.fixedDate) {
          return new Date(e.fixedDate).getTime() < now.getTime();
        }
        return false;
      });
    }

    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(e =>
        e.name.toLowerCase().includes(query) ||
        e.participants.some(p => p.name.toLowerCase().includes(query))
      );
    }

    setFilteredEvents(filtered);
  };

  const toggleEventSelection = (eventId: string) => {
    const newSelected = new Set(selectedEvents);
    if (newSelected.has(eventId)) {
      newSelected.delete(eventId);
    } else {
      newSelected.add(eventId);
    }
    setSelectedEvents(newSelected);
  };

  const selectAll = () => {
    if (selectedEvents.size === filteredEvents.length) {
      setSelectedEvents(new Set());
    } else {
      setSelectedEvents(new Set(filteredEvents.map(e => e.id)));
    }
  };

  const handleBulkDelete = () => {
    if (selectedEvents.size === 0) return;

    const message = `Delete ${selectedEvents.size} event(s)? This cannot be undone.`;
    
    if (Platform.OS === 'web') {
      if (confirm(message)) {
        performBulkDelete();
      }
    } else {
      Alert.alert(
        'Confirm Delete',
        message,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: performBulkDelete },
        ]
      );
    }
  };

  const performBulkDelete = async () => {
    try {
      for (const eventId of selectedEvents) {
        await eventsLocalStorage.delete(eventId);
      }
      setSelectedEvents(new Set());
      await loadEvents();
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('Failed to delete events:', error);
      Alert.alert('Error', 'Failed to delete events');
    }
  };

  const formatDate = (event: Event) => {
    if (event.eventType === 'fixed' && event.fixedDate) {
      return new Date(event.fixedDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    }
    return `${event.month}/${event.year}`;
  };

  const getResponseRate = (event: Event) => {
    if (event.participants.length === 0) return 0;
    const responded = event.participants.filter(p =>
      (event.eventType === 'flexible' && p.availability && Object.keys(p.availability).length > 0) ||
      (event.eventType === 'fixed' && p.rsvpStatus && p.rsvpStatus !== 'no-response')
    ).length;
    return Math.round((responded / event.participants.length) * 100);
  };

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + AdminSpacing.xl }]}>
        <View style={styles.headerTop}>
          <Pressable
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <IconSymbol name="chevron.left" size={20} color={AdminColors.gray600} />
            <ThemedText style={styles.backText}>Back</ThemedText>
          </Pressable>
        </View>
        <ThemedText style={styles.pageTitle}>Event Management</ThemedText>
        <ThemedText style={styles.pageSubtitle}>
          {filteredEvents.length} {filteredEvents.length === 1 ? 'event' : 'events'}
        </ThemedText>
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <View style={styles.searchContainer}>
          <IconSymbol name="magnifyingglass" size={20} color={AdminColors.gray400} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search events or participants..."
            placeholderTextColor={AdminColors.gray400}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters}>
          {(['all', 'upcoming', 'past', 'flexible', 'fixed'] as FilterType[]).map(f => (
            <Pressable
              key={f}
              style={[
                styles.filterChip,
                filter === f && styles.filterChipActive,
              ]}
              onPress={() => setFilter(f)}
            >
              <ThemedText
                style={[
                  styles.filterText,
                  filter === f && styles.filterTextActive,
                ]}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </ThemedText>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Bulk Actions */}
      {selectedEvents.size > 0 && (
        <View style={styles.bulkActions}>
          <ThemedText style={styles.bulkText}>{selectedEvents.size} selected</ThemedText>
          <View style={styles.bulkButtons}>
            <Pressable
              style={styles.bulkButtonSecondary}
              onPress={selectAll}
            >
              <ThemedText style={styles.bulkButtonSecondaryText}>
                {selectedEvents.size === filteredEvents.length ? 'Deselect All' : 'Select All'}
              </ThemedText>
            </Pressable>
            <Pressable
              style={styles.bulkButtonDanger}
              onPress={handleBulkDelete}
            >
              <IconSymbol name="trash.fill" size={16} color="#fff" />
              <ThemedText style={styles.bulkButtonDangerText}>Delete</ThemedText>
            </Pressable>
          </View>
        </View>
      )}

      {/* Event List */}
      <ScrollView style={styles.eventList} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        {filteredEvents.length === 0 ? (
          <View style={styles.emptyState}>
            <IconSymbol name="calendar" size={48} color={AdminColors.gray300} />
            <ThemedText style={styles.emptyText}>No events found</ThemedText>
            <ThemedText style={styles.emptySubtext}>
              {searchQuery ? 'Try adjusting your search' : 'Create your first event to get started'}
            </ThemedText>
          </View>
        ) : (
          <View style={styles.eventGrid}>
            {filteredEvents.map(event => {
              const responseRate = getResponseRate(event);
              const isSelected = selectedEvents.has(event.id);
              
              return (
                <Pressable
                  key={event.id}
                  style={[
                    styles.eventCard,
                    isSelected && styles.eventCardSelected,
                  ]}
                  onPress={() => router.push(`/event-detail?id=${event.id}` as any)}
                  onLongPress={() => toggleEventSelection(event.id)}
                >
                  <View style={styles.eventCardHeader}>
                    <Pressable
                      style={styles.checkbox}
                      onPress={() => toggleEventSelection(event.id)}
                    >
                      <View
                        style={[
                          styles.checkboxInner,
                          isSelected && styles.checkboxInnerSelected,
                        ]}
                      >
                        {isSelected && <IconSymbol name="checkmark" size={14} color="#fff" />}
                      </View>
                    </Pressable>

                    <View style={[
                      styles.eventTypeBadge,
                      event.eventType === 'fixed' ? styles.eventTypeBadgeFixed : styles.eventTypeBadgeFlexible,
                    ]}>
                      <ThemedText style={styles.eventTypeBadgeText}>
                        {event.eventType}
                      </ThemedText>
                    </View>
                  </View>

                  <View style={styles.eventCardContent}>
                    <ThemedText style={styles.eventName}>{event.name}</ThemedText>
                    
                    <View style={styles.eventMeta}>
                      <View style={styles.metaItem}>
                        <IconSymbol name="calendar" size={14} color={AdminColors.gray500} />
                        <ThemedText style={styles.metaText}>{formatDate(event)}</ThemedText>
                      </View>
                      <View style={styles.metaItem}>
                        <IconSymbol name="person.2.fill" size={14} color={AdminColors.gray500} />
                        <ThemedText style={styles.metaText}>
                          {event.participants.length} participants
                        </ThemedText>
                      </View>
                    </View>

                    <View style={styles.responseRateContainer}>
                      <View style={styles.responseRateBar}>
                        <View
                          style={[
                            styles.responseRateFill,
                            {
                              width: `${responseRate}%`,
                              backgroundColor:
                                responseRate >= 80
                                  ? AdminColors.success
                                  : responseRate >= 50
                                  ? AdminColors.warning
                                  : AdminColors.error,
                            },
                          ]}
                        />
                      </View>
                      <ThemedText style={styles.responseRateText}>{responseRate}% responded</ThemedText>
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AdminColors.gray50,
  },
  
  // Header
  header: {
    paddingHorizontal: AdminSpacing['4xl'],
    paddingBottom: AdminSpacing.xl,
    backgroundColor: AdminColors.surface,
    borderBottomWidth: 1,
    borderBottomColor: AdminColors.border,
  },
  headerTop: {
    marginBottom: AdminSpacing.base,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: AdminSpacing.xs,
    alignSelf: 'flex-start',
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
  backText: {
    fontSize: AdminTypography.sm,
    color: AdminColors.gray600,
    fontWeight: '500' as any,
  },
  pageTitle: {
    fontSize: AdminTypography['4xl'],
    fontWeight: '700' as any,
    color: AdminColors.gray900,
    marginBottom: AdminSpacing.xs,
  },
  pageSubtitle: {
    fontSize: AdminTypography.base,
    color: AdminColors.gray600,
  },
  
  // Controls
  controls: {
    paddingHorizontal: AdminSpacing['4xl'],
    paddingVertical: AdminSpacing.xl,
    gap: AdminSpacing.base,
    backgroundColor: AdminColors.surface,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: AdminSpacing.sm,
    paddingHorizontal: AdminSpacing.base,
    paddingVertical: AdminSpacing.sm,
    backgroundColor: AdminColors.gray50,
    borderRadius: AdminBorderRadius.base,
    borderWidth: 1,
    borderColor: AdminColors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: AdminTypography.base,
    color: AdminColors.gray900,
    ...Platform.select({
      web: {
        outlineStyle: 'none' as any,
      },
    }),
  },
  filters: {
    flexDirection: 'row',
  },
  filterChip: {
    paddingHorizontal: AdminSpacing.base,
    paddingVertical: AdminSpacing.sm,
    borderRadius: AdminBorderRadius.full,
    marginRight: AdminSpacing.sm,
    backgroundColor: AdminColors.gray100,
    borderWidth: 1,
    borderColor: 'transparent',
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
  filterChipActive: {
    backgroundColor: AdminColors.primaryLight,
    borderColor: AdminColors.primary,
  },
  filterText: {
    fontSize: AdminTypography.sm,
    fontWeight: '500' as any,
    color: AdminColors.gray700,
  },
  filterTextActive: {
    color: AdminColors.primary,
  },
  
  // Bulk Actions
  bulkActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: AdminSpacing['4xl'],
    paddingVertical: AdminSpacing.base,
    backgroundColor: AdminColors.primaryLight,
    borderBottomWidth: 1,
    borderBottomColor: AdminColors.primary + '20',
  },
  bulkText: {
    fontSize: AdminTypography.sm,
    fontWeight: '600' as any,
    color: AdminColors.primary,
  },
  bulkButtons: {
    flexDirection: 'row',
    gap: AdminSpacing.sm,
  },
  bulkButtonSecondary: {
    paddingHorizontal: AdminSpacing.base,
    paddingVertical: AdminSpacing.sm,
    borderRadius: AdminBorderRadius.base,
    backgroundColor: AdminColors.surface,
    borderWidth: 1,
    borderColor: AdminColors.border,
  },
  bulkButtonSecondaryText: {
    fontSize: AdminTypography.sm,
    fontWeight: '500' as any,
    color: AdminColors.gray700,
  },
  bulkButtonDanger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: AdminSpacing.xs,
    paddingHorizontal: AdminSpacing.base,
    paddingVertical: AdminSpacing.sm,
    borderRadius: AdminBorderRadius.base,
    backgroundColor: AdminColors.error,
  },
  bulkButtonDangerText: {
    fontSize: AdminTypography.sm,
    fontWeight: '500' as any,
    color: '#fff',
  },
  
  // Event List
  eventList: {
    flex: 1,
    paddingHorizontal: AdminSpacing['4xl'],
    paddingTop: AdminSpacing.xl,
  },
  eventGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: AdminSpacing.xl,
  },
  eventCard: {
    flex: 1,
    minWidth: 320,
    maxWidth: 400,
    backgroundColor: AdminColors.surface,
    borderRadius: AdminBorderRadius.lg,
    padding: AdminSpacing.xl,
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
  eventCardSelected: {
    borderColor: AdminColors.primary,
    backgroundColor: AdminColors.primaryLight,
  },
  eventCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: AdminSpacing.base,
  },
  checkbox: {
    padding: AdminSpacing.xs,
  },
  checkboxInner: {
    width: 20,
    height: 20,
    borderRadius: AdminBorderRadius.sm,
    borderWidth: 2,
    borderColor: AdminColors.gray300,
    backgroundColor: AdminColors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxInnerSelected: {
    backgroundColor: AdminColors.primary,
    borderColor: AdminColors.primary,
  },
  eventTypeBadge: {
    paddingHorizontal: AdminSpacing.sm,
    paddingVertical: 4,
    borderRadius: AdminBorderRadius.sm,
  },
  eventTypeBadgeFlexible: {
    backgroundColor: AdminColors.infoLight,
  },
  eventTypeBadgeFixed: {
    backgroundColor: AdminColors.successLight,
  },
  eventTypeBadgeText: {
    fontSize: 11,
    fontWeight: '600' as any,
    textTransform: 'uppercase',
    color: AdminColors.gray700,
  },
  eventCardContent: {
    gap: AdminSpacing.base,
  },
  eventName: {
    fontSize: AdminTypography.lg,
    fontWeight: '600' as any,
    color: AdminColors.gray900,
  },
  eventMeta: {
    gap: AdminSpacing.sm,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: AdminSpacing.xs,
  },
  metaText: {
    fontSize: AdminTypography.sm,
    color: AdminColors.gray600,
  },
  responseRateContainer: {
    gap: AdminSpacing.xs,
  },
  responseRateBar: {
    height: 6,
    backgroundColor: AdminColors.gray200,
    borderRadius: AdminBorderRadius.full,
    overflow: 'hidden',
  },
  responseRateFill: {
    height: '100%',
    borderRadius: AdminBorderRadius.full,
  },
  responseRateText: {
    fontSize: AdminTypography.xs,
    color: AdminColors.gray600,
    fontWeight: '500' as any,
  },
  
  // Empty State
  emptyState: {
    paddingVertical: AdminSpacing['6xl'],
    alignItems: 'center',
    gap: AdminSpacing.base,
  },
  emptyText: {
    fontSize: AdminTypography.xl,
    fontWeight: '600' as any,
    color: AdminColors.gray900,
  },
  emptySubtext: {
    fontSize: AdminTypography.base,
    color: AdminColors.gray600,
    textAlign: 'center',
  },
});
