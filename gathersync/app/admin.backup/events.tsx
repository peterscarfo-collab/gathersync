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
import { useThemeColor } from '@/hooks/use-theme-color';
import { eventsLocalStorage } from '@/lib/local-storage';
import type { Event } from '@/types/models';

type FilterType = 'all' | 'upcoming' | 'past' | 'flexible' | 'fixed';

export default function AdminEventsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tintColor = useThemeColor({}, 'tint');
  const cardBg = useThemeColor({ light: '#f5f5f5', dark: '#2a2a2a' }, 'background');
  const surfaceColor = useThemeColor({ light: '#fff', dark: '#1a1a1a' }, 'background');
  
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
      (event.eventType === 'flexible' && p.availability && Array.isArray(p.availability) && p.availability.length > 0) ||
      (event.eventType === 'fixed' && p.rsvpStatus && p.rsvpStatus !== 'no-response')
    ).length;
    return Math.round((responded / event.participants.length) * 100);
  };

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <IconSymbol name="chevron.left" size={24} color={tintColor} />
        </Pressable>
        <ThemedText type="title">Event Management</ThemedText>
      </View>

      {/* Search and Filters */}
      <View style={styles.controls}>
        <TextInput
          style={[styles.searchInput, { backgroundColor: surfaceColor, color: tintColor }]}
          placeholder="Search events or participants..."
          placeholderTextColor="#999"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters}>
          {(['all', 'upcoming', 'past', 'flexible', 'fixed'] as FilterType[]).map(f => (
            <Pressable
              key={f}
              style={[
                styles.filterChip,
                { backgroundColor: filter === f ? tintColor : cardBg },
              ]}
              onPress={() => setFilter(f)}
            >
              <ThemedText
                style={[
                  styles.filterText,
                  { color: filter === f ? '#fff' : tintColor },
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
        <View style={[styles.bulkActions, { backgroundColor: cardBg }]}>
          <ThemedText>{selectedEvents.size} selected</ThemedText>
          <View style={styles.bulkButtons}>
            <Pressable
              style={[styles.bulkButton, { backgroundColor: tintColor }]}
              onPress={selectAll}
            >
              <ThemedText style={{ color: '#fff' }}>
                {selectedEvents.size === filteredEvents.length ? 'Deselect All' : 'Select All'}
              </ThemedText>
            </Pressable>
            <Pressable
              style={[styles.bulkButton, { backgroundColor: '#ff3b30' }]}
              onPress={handleBulkDelete}
            >
              <IconSymbol name="trash.fill" size={16} color="#fff" />
              <ThemedText style={{ color: '#fff' }}>Delete</ThemedText>
            </Pressable>
          </View>
        </View>
      )}

      {/* Event List */}
      <ScrollView style={styles.eventList}>
        {filteredEvents.length === 0 ? (
          <View style={styles.emptyState}>
            <ThemedText style={{ opacity: 0.5 }}>No events found</ThemedText>
          </View>
        ) : (
          filteredEvents.map(event => {
            const responseRate = getResponseRate(event);
            const isSelected = selectedEvents.has(event.id);
            
            return (
              <Pressable
                key={event.id}
                style={[
                  styles.eventCard,
                  { backgroundColor: isSelected ? tintColor + '20' : cardBg },
                ]}
                onPress={() => router.push(`/event-detail?id=${event.id}` as any)}
                onLongPress={() => toggleEventSelection(event.id)}
              >
                <Pressable
                  style={styles.checkbox}
                  onPress={() => toggleEventSelection(event.id)}
                >
                  <View
                    style={[
                      styles.checkboxInner,
                      {
                        backgroundColor: isSelected ? tintColor : 'transparent',
                        borderColor: tintColor,
                      },
                    ]}
                  >
                    {isSelected && <IconSymbol name="checkmark" size={16} color="#fff" />}
                  </View>
                </Pressable>

                <View style={styles.eventContent}>
                  <ThemedText type="defaultSemiBold">{event.name}</ThemedText>
                  <View style={styles.eventMeta}>
                    <View style={styles.metaItem}>
                      <IconSymbol name="calendar" size={14} color={tintColor} />
                      <ThemedText style={styles.metaText}>{formatDate(event)}</ThemedText>
                    </View>
                    <View style={styles.metaItem}>
                      <IconSymbol name="person.2.fill" size={14} color={tintColor} />
                      <ThemedText style={styles.metaText}>
                        {event.participants.length} participants
                      </ThemedText>
                    </View>
                    <View style={styles.metaItem}>
                      <IconSymbol name="checkmark.circle.fill" size={14} color={tintColor} />
                      <ThemedText style={styles.metaText}>{responseRate}% responded</ThemedText>
                    </View>
                  </View>
                </View>

                <View style={styles.eventBadge}>
                  <ThemedText style={[styles.badgeText, { color: tintColor }]}>
                    {event.eventType}
                  </ThemedText>
                </View>
              </Pressable>
            );
          })
        )}
        <View style={{ height: insets.bottom + 80 }} />
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
    padding: 4,
  },
  controls: {
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 16,
  },
  searchInput: {
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
  },
  filters: {
    flexDirection: 'row',
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  filterText: {
    fontSize: 14,
    fontWeight: '500',
  },
  bulkActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginBottom: 8,
  },
  bulkButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  bulkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
  },
  eventList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  eventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    gap: 12,
  },
  checkbox: {
    padding: 4,
  },
  checkboxInner: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eventContent: {
    flex: 1,
    gap: 8,
  },
  eventMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    opacity: 0.7,
  },
  eventBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
});
