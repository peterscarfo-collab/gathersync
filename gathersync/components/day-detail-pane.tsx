import { useState, useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';
import { eventsLocalStorage } from '@/lib/local-storage';
import { getDayAvailability, parseDate } from '@/lib/calendar-utils';
import type { Event, DayAvailability } from '@/types/models';

interface DayDetailPaneProps {
  eventId: string;
  day: number;
  onClose?: () => void;
  onUpdate?: () => void;
  onParticipantPress?: (participantId: string) => void;
}

export function DayDetailPane({ eventId, day, onClose, onUpdate, onParticipantPress }: DayDetailPaneProps) {
  const [event, setEvent] = useState<Event | null>(null);
  const [dayAvailability, setDayAvailability] = useState<DayAvailability | null>(null);
  const [filter, setFilter] = useState<'all' | 'available' | 'unavailable' | 'no-response'>('all');

  const tintColor = useThemeColor({}, 'tint');
  const backgroundColor = useThemeColor({}, 'background');
  const surfaceColor = useThemeColor({}, 'surface');
  const textSecondaryColor = useThemeColor({}, 'textSecondary');
  const successColor = useThemeColor({}, 'success');
  const errorColor = useThemeColor({}, 'error');

  useEffect(() => {
    loadData();
  }, [eventId, day]);

  const loadData = async () => {
    if (!eventId || !day) return;
    
    const loadedEvent = await eventsLocalStorage.getById(eventId);
    if (!loadedEvent) return;

    const availability = getDayAvailability(loadedEvent, loadedEvent.year, loadedEvent.month, day);
    
    setEvent(loadedEvent);
    setDayAvailability(availability);
  };

  if (!event || !dayAvailability) {
    return (
      <View style={[styles.container, { backgroundColor }]}>
        <ThemedText>Loading...</ThemedText>
      </View>
    );
  }

  const date = parseDate(dayAvailability.date);
  const dateDisplay = new Date(date.year, date.month - 1, date.day).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const totalParticipants = event.participants.filter(p => !p.deletedAt).length;
  const availabilityPercentage = totalParticipants > 0
    ? Math.round((dayAvailability.availableCount / totalParticipants) * 100)
    : 0;

  return (
    <View style={[styles.container, { backgroundColor }]}>
      {onClose && (
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={8}>
            <IconSymbol name="xmark" size={24} color={tintColor} />
          </Pressable>
          <ThemedText type="subtitle">Day Details</ThemedText>
          <View style={{ width: 24 }} />
        </View>
      )}

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={[styles.dateCard, { backgroundColor: surfaceColor }]}>
          <ThemedText type="title" style={styles.dateText}>
            {dateDisplay}
          </ThemedText>
          <View style={styles.statsRow}>
            <Pressable 
              style={[
                styles.statItem, 
                filter === 'available' && { backgroundColor: successColor + '10', borderRadius: 8, paddingVertical: 4 }
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setFilter(filter === 'available' ? 'all' : 'available');
              }}
            >
              <ThemedText style={[styles.statValue, { color: successColor }]}>
                {dayAvailability.availableCount}
              </ThemedText>
              <ThemedText style={[styles.statLabel, { color: textSecondaryColor }]}>
                Available
              </ThemedText>
            </Pressable>
            <Pressable 
              style={[
                styles.statItem, 
                filter === 'unavailable' && { backgroundColor: errorColor + '10', borderRadius: 8, paddingVertical: 4 }
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setFilter(filter === 'unavailable' ? 'all' : 'unavailable');
              }}
            >
              <ThemedText style={[styles.statValue, { color: errorColor }]}>
                {dayAvailability.unavailableCount}
              </ThemedText>
              <ThemedText style={[styles.statLabel, { color: textSecondaryColor }]}>
                Unavailable
              </ThemedText>
            </Pressable>
            <Pressable 
              style={[
                styles.statItem, 
                filter === 'no-response' && { backgroundColor: textSecondaryColor + '10', borderRadius: 8, paddingVertical: 4 }
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setFilter(filter === 'no-response' ? 'all' : 'no-response');
              }}
            >
              <ThemedText style={[styles.statValue, { color: textSecondaryColor }]}>
                {dayAvailability.noResponseCount}
              </ThemedText>
              <ThemedText style={[styles.statLabel, { color: textSecondaryColor }]}>
                No Response
              </ThemedText>
            </Pressable>
          </View>
          <View style={styles.percentageRow}>
            <ThemedText type="subtitle" style={{ color: tintColor }}>
              {availabilityPercentage}% Available
            </ThemedText>
          </View>
        </View>

        <View style={styles.participantsList}>
          {dayAvailability.participants
            .filter((p) => filter === 'all' || p.status === filter)
            .map((participant) => {
            let statusIcon: any;
            let statusColor: string;
            
            if (participant.status === 'available') {
              statusIcon = 'checkmark';
              statusColor = successColor;
            } else if (participant.status === 'unavailable') {
              statusIcon = 'xmark';
              statusColor = errorColor;
            } else {
              statusIcon = 'ellipsis.circle';
              statusColor = textSecondaryColor;
            }

            return (
              <Pressable
                key={participant.id}
                style={[styles.participantCard, { backgroundColor: surfaceColor }]}
                onPress={() => {
                  if (onParticipantPress) {
                    onParticipantPress(participant.id);
                  }
                }}
              >
                <View style={styles.participantInfo}>
                  <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
                    <IconSymbol name={statusIcon} size={20} color={statusColor} />
                  </View>
                  <ThemedText type="defaultSemiBold" style={styles.participantName}>
                    {participant.name}
                  </ThemedText>
                </View>
                <ThemedText style={[styles.statusText, { color: statusColor }]}>
                  {participant.status === 'available' && 'Available'}
                  {participant.status === 'unavailable' && 'Unavailable'}
                  {participant.status === 'no-response' && 'No Response'}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  dateCard: {
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    alignItems: 'center',
  },
  dateText: {
    textAlign: 'center',
    marginBottom: 24,
    fontSize: 24,
    lineHeight: 32,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 4,
  },
  percentageRow: {
    marginTop: 8,
  },
  participantsList: {
    gap: 8,
  },
  participantCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
  },
  participantInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  statusBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  participantName: {
    flex: 1,
    fontSize: 16,
    lineHeight: 24,
  },
  statusText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
});