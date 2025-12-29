import { useState, useEffect } from 'react';
import {
  StyleSheet,
  ScrollView,
  View,
  Pressable,
  TextInput,
  Platform,
  Share,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';
import { eventsLocalStorage } from '@/lib/local-storage';
import type { Event, Participant } from '@/types/models';

interface ParticipantWithEvents {
  name: string;
  phone?: string;
  email?: string;
  eventCount: number;
  events: string[]; // Event names
}

export default function AdminParticipantsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tintColor = useThemeColor({}, 'tint');
  const cardBg = useThemeColor({ light: '#f5f5f5', dark: '#2a2a2a' }, 'background');
  const surfaceColor = useThemeColor({ light: '#fff', dark: '#1a1a1a' }, 'background');
  
  const [events, setEvents] = useState<Event[]>([]);
  const [participants, setParticipants] = useState<ParticipantWithEvents[]>([]);
  const [filteredParticipants, setFilteredParticipants] = useState<ParticipantWithEvents[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    applySearch();
  }, [participants, searchQuery]);

  const loadData = async () => {
    try {
      const allEvents = await eventsLocalStorage.getAll();
      setEvents(allEvents);

      // Build participant directory
      const participantMap = new Map<string, ParticipantWithEvents>();
      
      allEvents.forEach(event => {
        event.participants.forEach(participant => {
          const existing = participantMap.get(participant.name);
          if (existing) {
            existing.eventCount += 1;
            existing.events.push(event.name);
            // Update contact info if available
            if (participant.phone && !existing.phone) {
              existing.phone = participant.phone;
            }
            if (participant.email && !existing.email) {
              existing.email = participant.email;
            }
          } else {
            participantMap.set(participant.name, {
              name: participant.name,
              phone: participant.phone,
              email: participant.email,
              eventCount: 1,
              events: [event.name],
            });
          }
        });
      });

      const participantList = Array.from(participantMap.values())
        .sort((a, b) => b.eventCount - a.eventCount);
      
      setParticipants(participantList);
    } catch (error) {
      console.error('Failed to load participant data:', error);
    } finally {
      setLoading(false);
    }
  };

  const applySearch = () => {
    if (!searchQuery.trim()) {
      setFilteredParticipants(participants);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = participants.filter(p =>
      p.name.toLowerCase().includes(query) ||
      p.phone?.toLowerCase().includes(query) ||
      p.email?.toLowerCase().includes(query) ||
      p.events.some(e => e.toLowerCase().includes(query))
    );
    setFilteredParticipants(filtered);
  };

  const exportParticipantList = () => {
    // Generate CSV
    let csv = 'Name,Phone,Email,Event Count,Events\n';
    participants.forEach(p => {
      csv += `${p.name},${p.phone || ''},${p.email || ''},${p.eventCount},"${p.events.join(', ')}"\n`;
    });

    if (Platform.OS === 'web') {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(csv);
        alert('Participant list copied to clipboard! Paste into Excel or Google Sheets.');
      } else {
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `participants-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } else {
      Share.share({
        message: csv,
        title: 'Participant List',
      });
    }
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
        <ThemedText type="title">Participant Management</ThemedText>
      </View>

      {/* Search */}
      <View style={styles.controls}>
        <TextInput
          style={[styles.searchInput, { backgroundColor: surfaceColor, color: tintColor }]}
          placeholder="Search participants..."
          placeholderTextColor="#999"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Summary */}
      <View style={styles.summary}>
        <View style={[styles.summaryCard, { backgroundColor: cardBg }]}>
          <ThemedText style={styles.summaryValue}>{participants.length}</ThemedText>
          <ThemedText style={styles.summaryLabel}>Total Participants</ThemedText>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: cardBg }]}>
          <ThemedText style={styles.summaryValue}>
            {participants.filter(p => p.phone).length}
          </ThemedText>
          <ThemedText style={styles.summaryLabel}>With Phone</ThemedText>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: cardBg }]}>
          <ThemedText style={styles.summaryValue}>
            {participants.filter(p => p.email).length}
          </ThemedText>
          <ThemedText style={styles.summaryLabel}>With Email</ThemedText>
        </View>
      </View>

      {/* Export Button */}
      <Pressable
        style={[styles.exportButton, { backgroundColor: tintColor }]}
        onPress={exportParticipantList}
      >
        <IconSymbol name="square.and.arrow.up" size={20} color="#fff" />
        <ThemedText style={styles.exportButtonText}>Export List</ThemedText>
      </Pressable>

      {/* Participant List */}
      <ScrollView style={styles.participantList}>
        {filteredParticipants.length === 0 ? (
          <View style={styles.emptyState}>
            <ThemedText style={{ opacity: 0.5 }}>
              {searchQuery ? 'No participants found' : 'No participants yet'}
            </ThemedText>
          </View>
        ) : (
          filteredParticipants.map((participant, index) => (
            <View
              key={index}
              style={[styles.participantCard, { backgroundColor: cardBg }]}
            >
              <View style={styles.participantHeader}>
                <View style={styles.participantInfo}>
                  <ThemedText type="defaultSemiBold">{participant.name}</ThemedText>
                  <View style={styles.participantMeta}>
                    {participant.phone && (
                      <View style={styles.metaItem}>
                        <IconSymbol name="phone.fill" size={12} color={tintColor} />
                        <ThemedText style={styles.metaText}>{participant.phone}</ThemedText>
                      </View>
                    )}
                    {participant.email && (
                      <View style={styles.metaItem}>
                        <IconSymbol name="message.fill" size={12} color={tintColor} />
                        <ThemedText style={styles.metaText}>{participant.email}</ThemedText>
                      </View>
                    )}
                  </View>
                </View>
                <View style={[styles.eventBadge, { backgroundColor: tintColor }]}>
                  <ThemedText style={styles.eventBadgeText}>
                    {participant.eventCount} {participant.eventCount === 1 ? 'event' : 'events'}
                  </ThemedText>
                </View>
              </View>

              {participant.events.length > 0 && (
                <View style={styles.eventList}>
                  <ThemedText style={styles.eventListTitle}>Events:</ThemedText>
                  <View style={styles.eventChips}>
                    {participant.events.map((eventName, i) => (
                      <View key={i} style={[styles.eventChip, { backgroundColor: tintColor + '20' }]}>
                        <ThemedText style={[styles.eventChipText, { color: tintColor }]}>
                          {eventName}
                        </ThemedText>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>
          ))
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
    marginBottom: 16,
  },
  searchInput: {
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
  },
  summary: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 16,
  },
  summaryCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  summaryLabel: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 4,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 20,
    padding: 16,
    borderRadius: 12,
    gap: 8,
    marginBottom: 16,
  },
  exportButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  participantList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  participantCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  participantHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  participantInfo: {
    flex: 1,
    gap: 8,
  },
  participantMeta: {
    gap: 6,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 12,
    opacity: 0.7,
  },
  eventBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  eventBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  eventList: {
    gap: 8,
  },
  eventListTitle: {
    fontSize: 12,
    opacity: 0.7,
  },
  eventChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  eventChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  eventChipText: {
    fontSize: 11,
    fontWeight: '500',
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
});
