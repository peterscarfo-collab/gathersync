import { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';
import { recurringTemplatesStorage } from '@/lib/recurring-storage';
import { generateId } from '@/lib/calendar-utils';
import type { RecurrencePattern, RecurringEventTemplate } from '@/types/models';

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEKS_OF_MONTH = ['First', 'Second', 'Third', 'Fourth', 'Last'];

export default function CreateRecurringTemplateScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [name, setName] = useState('');
  const [pattern, setPattern] = useState<RecurrencePattern>('weekly');
  const [dayOfWeek, setDayOfWeek] = useState(1); // Monday
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [weekOfMonth, setWeekOfMonth] = useState(1); // First
  const [participants, setParticipants] = useState('');

  const tintColor = useThemeColor({}, 'tint');
  const backgroundColor = useThemeColor({}, 'background');
  const surfaceColor = useThemeColor({}, 'surface');
  const textColor = useThemeColor({}, 'text');
  const textSecondaryColor = useThemeColor({}, 'textSecondary');

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a template name');
      return;
    }

    const participantNames = participants
      .split(',')
      .map(p => p.trim())
      .filter(p => p);

    if (participantNames.length === 0) {
      Alert.alert('Error', 'Please add at least one participant');
      return;
    }

    const template: RecurringEventTemplate = {
      id: generateId(),
      name: name.trim(),
      pattern,
      dayOfWeek: pattern === 'weekly' || pattern === 'biweekly' ? dayOfWeek : undefined,
      dayOfMonth: pattern === 'monthly' ? dayOfMonth : undefined,
      weekOfMonth: pattern === 'monthly' ? weekOfMonth : undefined,
      participantNames,
      active: true,
      createdAt: new Date().toISOString(),
    };

    await recurringTemplatesStorage.save(template);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Success', 'Recurring template created!', [
      {
        text: 'OK',
        onPress: () => router.back(),
      },
    ]);
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Math.max(insets.top, 20),
            paddingBottom: Math.max(insets.bottom, 20) + 80,
          },
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <IconSymbol name="chevron.left" size={24} color={tintColor} />
          </Pressable>
          <ThemedText type="title">New Recurring Event</ThemedText>
          <View style={{ width: 24 }} />
        </View>

        {/* Template Name */}
        <View style={[styles.card, { backgroundColor: surfaceColor }]}>
          <ThemedText style={styles.label}>Template Name</ThemedText>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor,
                color: textColor,
                borderColor: textSecondaryColor + '40',
              },
            ]}
            value={name}
            onChangeText={setName}
            placeholder="e.g., Book Club, Team Meeting"
            placeholderTextColor={textSecondaryColor}
          />
        </View>

        {/* Recurrence Pattern */}
        <View style={[styles.card, { backgroundColor: surfaceColor }]}>
          <ThemedText style={styles.label}>Recurrence Pattern</ThemedText>
          <View style={styles.patternGrid}>
            {(['weekly', 'biweekly', 'monthly'] as RecurrencePattern[]).map(p => (
              <Pressable
                key={p}
                style={[
                  styles.patternButton,
                  {
                    backgroundColor: pattern === p ? tintColor : backgroundColor,
                    borderColor: pattern === p ? tintColor : textSecondaryColor + '40',
                  },
                ]}
                onPress={() => setPattern(p)}
              >
                <ThemedText
                  style={[
                    styles.patternButtonText,
                    { color: pattern === p ? '#FFFFFF' : textColor },
                  ]}
                >
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Day Selection */}
        {(pattern === 'weekly' || pattern === 'biweekly') && (
          <View style={[styles.card, { backgroundColor: surfaceColor }]}>
            <ThemedText style={styles.label}>Day of Week</ThemedText>
            <View style={styles.dayGrid}>
              {DAYS_OF_WEEK.map((day, index) => (
                <Pressable
                  key={day}
                  style={[
                    styles.dayButton,
                    {
                      backgroundColor: dayOfWeek === index ? tintColor : backgroundColor,
                      borderColor: dayOfWeek === index ? tintColor : textSecondaryColor + '40',
                    },
                  ]}
                  onPress={() => setDayOfWeek(index)}
                >
                  <ThemedText
                    style={[
                      styles.dayButtonText,
                      { color: dayOfWeek === index ? '#FFFFFF' : textColor },
                    ]}
                  >
                    {day.substring(0, 3)}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {pattern === 'monthly' && (
          <View style={[styles.card, { backgroundColor: surfaceColor }]}>
            <ThemedText style={styles.label}>Monthly Schedule</ThemedText>
            
            {/* Week of Month */}
            <ThemedText style={[styles.sublabel, { color: textSecondaryColor }]}>
              Week
            </ThemedText>
            <View style={styles.weekGrid}>
              {WEEKS_OF_MONTH.map((week, index) => (
                <Pressable
                  key={week}
                  style={[
                    styles.weekButton,
                    {
                      backgroundColor: weekOfMonth === index + 1 ? tintColor : backgroundColor,
                      borderColor: weekOfMonth === index + 1 ? tintColor : textSecondaryColor + '40',
                    },
                  ]}
                  onPress={() => setWeekOfMonth(index + 1)}
                >
                  <ThemedText
                    style={[
                      styles.weekButtonText,
                      { color: weekOfMonth === index + 1 ? '#FFFFFF' : textColor },
                    ]}
                  >
                    {week}
                  </ThemedText>
                </Pressable>
              ))}
            </View>

            {/* Day of Week */}
            <ThemedText style={[styles.sublabel, { color: textSecondaryColor, marginTop: 16 }]}>
              Day
            </ThemedText>
            <View style={styles.dayGrid}>
              {DAYS_OF_WEEK.map((day, index) => (
                <Pressable
                  key={day}
                  style={[
                    styles.dayButton,
                    {
                      backgroundColor: dayOfWeek === index ? tintColor : backgroundColor,
                      borderColor: dayOfWeek === index ? tintColor : textSecondaryColor + '40',
                    },
                  ]}
                  onPress={() => setDayOfWeek(index)}
                >
                  <ThemedText
                    style={[
                      styles.dayButtonText,
                      { color: dayOfWeek === index ? '#FFFFFF' : textColor },
                    ]}
                  >
                    {day.substring(0, 3)}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* Participants */}
        <View style={[styles.card, { backgroundColor: surfaceColor }]}>
          <ThemedText style={styles.label}>Participants</ThemedText>
          <ThemedText style={[styles.hint, { color: textSecondaryColor }]}>
            Enter names separated by commas
          </ThemedText>
          <TextInput
            style={[
              styles.input,
              styles.textArea,
              {
                backgroundColor,
                color: textColor,
                borderColor: textSecondaryColor + '40',
              },
            ]}
            value={participants}
            onChangeText={setParticipants}
            placeholder="John, Sarah, Mike, ..."
            placeholderTextColor={textSecondaryColor}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>
      </ScrollView>

      {/* Create Button */}
      <View
        style={[
          styles.footer,
          {
            paddingBottom: Math.max(insets.bottom, 20),
            backgroundColor,
          },
        ]}
      >
        <Pressable
          style={[styles.createButton, { backgroundColor: tintColor }]}
          onPress={handleCreate}
        >
          <ThemedText style={styles.createButtonText}>Create Template</ThemedText>
        </Pressable>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  card: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
    marginBottom: 12,
  },
  sublabel: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    marginBottom: 8,
  },
  hint: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    lineHeight: 24,
  },
  textArea: {
    minHeight: 100,
  },
  patternGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  patternButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
  },
  patternButtonText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  dayGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dayButton: {
    width: '13%',
    aspectRatio: 1,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayButtonText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  weekGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  weekButton: {
    flex: 1,
    minWidth: '30%',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  weekButtonText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.05)',
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
});
