import React from 'react';
import { Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { IconSymbol } from './ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';
import { getMonthName, getBestDays } from '@/lib/calendar-utils';
import { formatConferenceDateRange, activeSessionCount } from '@/lib/conference-utils';
import { hasRecordedAttendance, getRsvpCounts } from '@/lib/participant-status';
import type { Event } from '@/types/models';

interface EventCardProps {
  event: Event;
  onPress: () => void;
}

export function EventCard({ event, onPress }: EventCardProps) {
  const tintColor = useThemeColor({}, 'tint');
  const surfaceColor = useThemeColor({}, 'surface');
  const textSecondaryColor = useThemeColor({}, 'textSecondary');
  const successColor = useThemeColor({}, 'success');
  const errorColor = useThemeColor({}, 'error');
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 768;
  
  const bestDays = getBestDays(event);
  const hasBestDay = bestDays.length > 0;
  const bestDayCount = hasBestDay ? bestDays[0].availableCount : 0;

  // Calculate RSVP/Attendance counts for fixed events
  const hasAttendance = event.eventType === 'fixed' ? hasRecordedAttendance(event) : false;
  const rsvpCounts = event.eventType === 'fixed' ? getRsvpCounts(event) : null;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        { backgroundColor: surfaceColor },
        isDesktop && styles.containerDesktop,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <IconSymbol name="calendar" size={20} color={tintColor} />
          <ThemedText type="defaultSemiBold" style={styles.title} numberOfLines={1}>
            {event.name}
          </ThemedText>
        </View>
        <IconSymbol name="chevron.right" size={20} color={textSecondaryColor} />
      </View>

      <View style={styles.details}>
        {event.eventType === 'conference' && event.startDate ? (
          <>
            <ThemedText style={[styles.detailText, { color: textSecondaryColor }]}>
              {formatConferenceDateRange(event.startDate, event.endDate)}
            </ThemedText>
            <ThemedText style={[styles.detailText, { color: textSecondaryColor }]}>
              • All day · {activeSessionCount(event)} sessions
            </ThemedText>
          </>
        ) : event.eventType === 'fixed' && event.fixedDate ? (
          <>
            <ThemedText style={[styles.detailText, { color: textSecondaryColor }]}>
              {new Date(event.fixedDate + 'T12:00:00').toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </ThemedText>
            {event.fixedTime && (
              <>
                <ThemedText style={[styles.detailText, { color: textSecondaryColor }]}>
                  •
                </ThemedText>
                <ThemedText style={[styles.detailText, { color: textSecondaryColor }]}>
                  {(() => {
                    const [hours, minutes] = event.fixedTime.split(':').map(Number);
                    const ampm = hours >= 12 ? 'PM' : 'AM';
                    const displayHours = hours % 12 || 12;
                    return `${displayHours}:${String(minutes).padStart(2, '0')} ${ampm}`;
                  })()}
                </ThemedText>
              </>
            )}
          </>
        ) : (
          <ThemedText style={[styles.detailText, { color: textSecondaryColor }]}>
            {getMonthName(event.month)} {event.year}
          </ThemedText>
        )}
        <ThemedText style={[styles.detailText, { color: textSecondaryColor }]}>
          •
        </ThemedText>
        <ThemedText style={[styles.detailText, { color: textSecondaryColor }]}>
          {(() => {
            const activeParticipants = event.participants.filter(p => !p.deletedAt);
            return `${activeParticipants.length} ${activeParticipants.length === 1 ? 'person' : 'people'}`;
          })()}
        </ThemedText>
      </View>

      {event.eventType === 'fixed' && rsvpCounts ? (
        <View style={styles.rsvpSummary}>
          <View style={styles.rsvpItem}>
            <ThemedText style={[styles.rsvpCount, { color: successColor }]}>
              {rsvpCounts.attending.length}
            </ThemedText>
            <ThemedText style={[styles.rsvpLabel, { color: textSecondaryColor }]}>
              {hasAttendance ? 'Attended' : 'Attending'}
            </ThemedText>
          </View>
          <View style={styles.rsvpItem}>
            <ThemedText style={[styles.rsvpCount, { color: errorColor }]}>
              {rsvpCounts.notAttending.length}
            </ThemedText>
            <ThemedText style={[styles.rsvpLabel, { color: textSecondaryColor }]}>
              {hasAttendance ? 'Not Attended' : 'Not Attending'}
            </ThemedText>
          </View>
          <View style={styles.rsvpItem}>
            <ThemedText style={[styles.rsvpCount, { color: textSecondaryColor }]}>
              {rsvpCounts.noResponse.length}
            </ThemedText>
            <ThemedText style={[styles.rsvpLabel, { color: textSecondaryColor }]}>
              {hasAttendance ? 'Unchecked' : 'No Response'}
            </ThemedText>
          </View>
        </View>
      ) : hasBestDay ? (
        <View style={styles.bestDayBadge}>
          <IconSymbol name="star.fill" size={14} color={successColor} />
          <ThemedText style={[styles.bestDayText, { color: successColor }]}>
            Best day: {bestDayCount} available
          </ThemedText>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  containerDesktop: {
    marginHorizontal: 0,
    marginBottom: 0,
  },
  pressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  title: {
    flex: 1,
    fontSize: 18,
    lineHeight: 24,
  },
  details: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  detailText: {
    fontSize: 14,
    lineHeight: 20,
  },
  bestDayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  bestDayText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  rsvpSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 8,
  },
  rsvpItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rsvpCount: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
  },
  rsvpLabel: {
    fontSize: 12,
    lineHeight: 16,
  },
});
