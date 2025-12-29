import { Pressable, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { ThemedText } from './themed-text';
import { IconSymbol } from './ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  getDaysInMonth,
  getFirstDayOfMonth,
  formatDate,
  getDayAvailability,
  getBestDays,
  getHeatmapColor,
} from '@/lib/calendar-utils';
import type { Event } from '@/types/models';

interface CalendarGridProps {
  event: Event;
  onDayPress: (day: number) => void;
}

export function CalendarGrid({ event, onDayPress }: CalendarGridProps) {
  const colorScheme = useColorScheme();
  const textColor = useThemeColor({}, 'text');
  const textSecondaryColor = useThemeColor({}, 'textSecondary');
  const successColor = useThemeColor({}, 'success');
  const surfaceColor = useThemeColor({}, 'surface');

  const daysInMonth = getDaysInMonth(event.year, event.month);
  const firstDay = getFirstDayOfMonth(event.year, event.month);
  const bestDays = getBestDays(event);
  const bestDayDates = new Set(bestDays.map(d => d.date));

  const weekDays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  // Create calendar grid
  const calendarDays: (number | null)[] = [];
  
  // Add empty cells for days before the first day of the month
  for (let i = 0; i < firstDay; i++) {
    calendarDays.push(null);
  }
  
  // Add all days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(day);
  }

  const handleDayPress = (day: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onDayPress(day);
  };

  const renderDay = (day: number | null, index: number) => {
    if (day === null) {
      return <View key={`empty-${index}`} style={styles.dayCell} />;
    }

    const dateStr = formatDate(event.year, event.month, day);
    const isBestDay = bestDayDates.has(dateStr);
    const availability = getDayAvailability(event, event.year, event.month, day);
    const totalParticipants = event.participants.length;
    const percentage = totalParticipants > 0 
      ? (availability.availableCount / totalParticipants) * 100 
      : 0;
    
    const heatmapColor = getHeatmapColor(percentage, colorScheme ?? 'light');

    return (
      <Pressable
        key={`day-${day}`}
        style={({ pressed }) => [
          styles.dayCell,
          { backgroundColor: heatmapColor },
          isBestDay && { borderColor: successColor, borderWidth: 2 },
          pressed && styles.dayCellPressed,
        ]}
        onPress={() => handleDayPress(day)}
      >
        {isBestDay && (
          <View style={styles.starBadge}>
            <IconSymbol name="star.fill" size={12} color={successColor} />
          </View>
        )}
        <ThemedText
          style={[
            styles.dayText,
            { color: percentage > 50 ? '#FFFFFF' : textColor },
          ]}
        >
          {day}
        </ThemedText>
        {totalParticipants > 0 && (
          <ThemedText
            style={[
              styles.countText,
              { color: percentage > 50 ? '#FFFFFF' : textSecondaryColor },
            ]}
          >
            {availability.availableCount}
          </ThemedText>
        )}
      </Pressable>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: surfaceColor }]}>
      {/* Week day headers */}
      <View style={styles.weekDaysRow}>
        {weekDays.map((day, index) => (
          <View key={index} style={styles.weekDayCell}>
            <ThemedText style={[styles.weekDayText, { color: textSecondaryColor }]}>
              {day}
            </ThemedText>
          </View>
        ))}
      </View>

      {/* Calendar grid */}
      <View style={styles.grid}>
        {calendarDays.map((day, index) => renderDay(day, index))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 12,
    marginHorizontal: 16,
  },
  weekDaysRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekDayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  weekDayText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%', // 100% / 7 days
    aspectRatio: 1,
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    marginBottom: 4,
    position: 'relative',
  },
  dayCellPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.95 }],
  },
  dayText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
  },
  countText: {
    fontSize: 10,
    lineHeight: 14,
    marginTop: 2,
  },
  starBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
  },
});
