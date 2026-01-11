import { useState, useEffect, useRef } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Switch, TextInput, View, KeyboardAvoidingView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { eventsLocalStorage as eventsLocalStorage } from '@/lib/local-storage';
import { eventsCloudStorage } from '@/lib/cloud-storage';
import { useAuth } from '@/hooks/use-auth';
import {
  getDaysInMonth,
  getFirstDayOfMonth,
  formatDate,
  getHeatmapColor,
} from '@/lib/calendar-utils';
import type { Event, Participant } from '@/types/models';
import { useAutoSync } from '@/hooks/use-auto-sync';

export default function EditAvailabilityScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const { eventId, participantId } = useLocalSearchParams<{ eventId: string; participantId: string }>();
  const { updateEvent } = useAutoSync();
  const { isAuthenticated } = useAuth();

  const [event, setEvent] = useState<Event | null>(null);
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [unavailableAllMonth, setUnavailableAllMonth] = useState(false);
  const [notes, setNotes] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const isSavingRef = useRef(false);
  const pendingSaveRef = useRef(false);

  const tintColor = useThemeColor({}, 'tint');
  const backgroundColor = useThemeColor({}, 'background');
  const surfaceColor = useThemeColor({}, 'surface');
  const textColor = useThemeColor({}, 'text');
  const textSecondaryColor = useThemeColor({}, 'textSecondary');
  const successColor = useThemeColor({}, 'success');
  const errorColor = useThemeColor({}, 'error');

  useEffect(() => {
    loadData();
  }, [eventId, participantId]);

  const loadData = async () => {
    if (!eventId || !participantId) return;
    
    const loadedEvent = await eventsLocalStorage.getById(eventId);
    if (!loadedEvent) return;

    const loadedParticipant = loadedEvent.participants.find(p => p.id === participantId);
    if (!loadedParticipant) return;

    setEvent(loadedEvent);
    setParticipant(loadedParticipant);
    setUnavailableAllMonth(loadedParticipant.unavailableAllMonth);
    setNotes(loadedParticipant.notes || '');
    setPhone(loadedParticipant.phone || '');
    setEmail(loadedParticipant.email || '');
  };

  const handleDayPress = (day: number) => {
    if (!event || !participant) return;

    const dateStr = formatDate(event.year, event.month, day);
    const currentStatus = participant.availability[dateStr];
    
    // Simple toggle - tap to mark available/unavailable
    participant.availability[dateStr] = !currentStatus;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    saveChanges();
  };

  const handleSelectWeekends = (available: boolean) => {
    if (!event || !participant) return;

    const daysInMonth = getDaysInMonth(event.year, event.month);
    const firstDay = getFirstDayOfMonth(event.year, event.month);

    for (let day = 1; day <= daysInMonth; day++) {
      // Calculate day of week (0 = Sunday, 6 = Saturday)
      const dayOfWeek = (firstDay + day - 1) % 7;
      
      // Check if it's Saturday (6) or Sunday (0)
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        const dateStr = formatDate(event.year, event.month, day);
        participant.availability[dateStr] = available;
      }
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    saveChanges();
  };

  const toggleDay = (day: number) => {
    if (!event || !participant) return;

    const dateStr = formatDate(event.year, event.month, day);
    const currentStatus = participant.availability[dateStr];
    
    participant.availability[dateStr] = !currentStatus;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    saveChanges();
  };

  const handleUnavailableToggle = (value: boolean) => {
    if (!participant) return;

    setUnavailableAllMonth(value);
    participant.unavailableAllMonth = value;
    
    if (value) {
      // Clear all availability when marking unavailable
      participant.availability = {};
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    saveChanges();
  };

  const handleRsvpChange = (status: 'attending' | 'not-attending') => {
    if (!participant) return;

    participant.rsvpStatus = status;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    saveChanges();
  };

  const handleDeleteParticipant = async () => {
    if (!event || !participantId) return;

    // Web doesn't support Alert.alert well, use confirm instead
    if (Platform.OS === 'web') {
      if (window.confirm(`Are you sure you want to remove ${participant?.name} from this event?`)) {
        // Soft delete: mark participant as deleted instead of removing
        event.participants = event.participants.map(p => 
          p.id === participantId 
            ? { ...p, deletedAt: new Date().toISOString() }
            : p
        );
        await eventsLocalStorage.update(eventId!, {
          ...event,
          updatedAt: new Date().toISOString(),
        });
        router.back();
      }
      return;
    }

    // Native platforms use Alert.alert
    Alert.alert(
      'Remove Participant',
      `Are you sure you want to remove ${participant?.name} from this event?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            // Soft delete: mark participant as deleted instead of removing
            event.participants = event.participants.map(p => 
              p.id === participantId 
                ? { ...p, deletedAt: new Date().toISOString() }
                : p
            );
            await eventsLocalStorage.update(eventId!, {
              ...event,
              updatedAt: new Date().toISOString(),
            });

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            router.back();
          },
        },
      ]
    );
  };

  const handleNotesChange = (text: string) => {
    setNotes(text);
    if (participant) {
      participant.notes = text;
      saveChanges();
    }
  };

  const handlePhoneChange = (text: string) => {
    setPhone(text);
    if (participant) {
      participant.phone = text || undefined;
      saveChanges();
    }
  };

  const handleEmailChange = (text: string) => {
    setEmail(text);
    if (participant) {
      participant.email = text || undefined;
      saveChanges();
    }
  };

  const saveChanges = async () => {
    if (!event || !participant) return;
    
    const updatedEvent = {
      ...event,
      updatedAt: new Date().toISOString(),
    };
    
    // Update local state immediately (optimistic update)
    setEvent(updatedEvent);
    setParticipant({ ...participant });
    
    // Save to local storage immediately
    await eventsLocalStorage.update(eventId!, updatedEvent);
    
    // If already saving, mark that another save is pending
    if (isSavingRef.current) {
      pendingSaveRef.current = true;
      return;
    }
    
    // Push to cloud immediately
    isSavingRef.current = true;
    
    if (isAuthenticated) {
      try {
        console.log('[EditAvailability] Pushing availability update to cloud');
        await eventsCloudStorage.update(eventId!, updatedEvent);
        console.log('[EditAvailability] Cloud update successful');
      } catch (error) {
        console.error('[EditAvailability] Failed to push to cloud:', error);
      }
    }
    
    isSavingRef.current = false;
    
    // If another save was requested while we were saving, do it now
    if (pendingSaveRef.current) {
      pendingSaveRef.current = false;
      saveChanges();
    }
  };
  
  // No cleanup needed - saves happen immediately

  if (!event || !participant) {
    return (
      <ThemedView style={[styles.container, { backgroundColor }]}>
        <ThemedText>Loading...</ThemedText>
      </ThemedView>
    );
  }

  const daysInMonth = getDaysInMonth(event.year, event.month);
  const firstDay = getFirstDayOfMonth(event.year, event.month);
  const weekDays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) {
    calendarDays.push(null);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(day);
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <ThemedView style={[styles.container, { backgroundColor }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: Math.max(insets.top, 16),
            paddingBottom: 16,
          },
        ]}
      >
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
          hitSlop={8}
        >
          <IconSymbol name="chevron.left" size={28} color={tintColor} />
        </Pressable>
        <ThemedText type="subtitle" numberOfLines={1} style={styles.headerTitle}>
          {participant.name}
        </ThemedText>
        <Pressable
          onPress={handleDeleteParticipant}
          hitSlop={8}
        >
          <IconSymbol name="trash.fill" size={24} color={errorColor} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={[
          styles.contentContainer,
          { paddingBottom: Math.max(insets.bottom, 16) },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* RSVP for Fixed Events */}
        {event.eventType === 'fixed' && (
          <View style={[styles.rsvpCard, { backgroundColor: surfaceColor }]}>            <ThemedText type="defaultSemiBold" style={styles.rsvpTitle}>
              RSVP Status
            </ThemedText>
            <ThemedText style={[styles.rsvpSubtitle, { color: textSecondaryColor }]}>
              {event.fixedDate && new Date(event.fixedDate + 'T00:00:00').toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
              {event.fixedTime && ` at ${event.fixedTime}`}
            </ThemedText>
            <View style={styles.rsvpButtons}>
              <Pressable
                style={[
                  styles.rsvpButton,
                  participant.rsvpStatus === 'attending' && { backgroundColor: '#10B981' },
                  participant.rsvpStatus !== 'attending' && { backgroundColor: surfaceColor, borderWidth: 2, borderColor: '#10B981' },
                ]}
                onPress={() => handleRsvpChange('attending')}
              >
                <IconSymbol 
                  name="checkmark.circle.fill" 
                  size={24} 
                  color={participant.rsvpStatus === 'attending' ? '#FFFFFF' : '#10B981'} 
                />
                <ThemedText 
                  style={[
                    styles.rsvpButtonText,
                    { color: participant.rsvpStatus === 'attending' ? '#FFFFFF' : '#10B981' },
                  ]}
                >
                  Attending
                </ThemedText>
              </Pressable>
              <Pressable
                style={[
                  styles.rsvpButton,
                  participant.rsvpStatus === 'not-attending' && { backgroundColor: '#EF4444' },
                  participant.rsvpStatus !== 'not-attending' && { backgroundColor: surfaceColor, borderWidth: 2, borderColor: '#EF4444' },
                ]}
                onPress={() => handleRsvpChange('not-attending')}
              >
                <IconSymbol 
                  name="xmark.circle.fill" 
                  size={24} 
                  color={participant.rsvpStatus === 'not-attending' ? '#FFFFFF' : '#EF4444'} 
                />
                <ThemedText 
                  style={[
                    styles.rsvpButtonText,
                    { color: participant.rsvpStatus === 'not-attending' ? '#FFFFFF' : '#EF4444' },
                  ]}
                >
                  Not Attending
                </ThemedText>
              </Pressable>
            </View>
          </View>
        )}

        {/* Unavailable All Month Toggle (only for flexible events) */}
        {event.eventType === 'flexible' && (
        <View style={[styles.toggleCard, { backgroundColor: surfaceColor }]}>
          <View style={styles.toggleContent}>
            <View style={styles.toggleText}>
              <ThemedText type="defaultSemiBold">Unavailable All Month</ThemedText>
              <ThemedText style={[styles.toggleHint, { color: textSecondaryColor }]}>
                Mark this person as unavailable for the entire month
              </ThemedText>
            </View>
            <Switch
              value={unavailableAllMonth}
              onValueChange={handleUnavailableToggle}
              trackColor={{ false: textSecondaryColor, true: tintColor }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>
        )}

        {/* Contact Information */}
        <View style={[styles.contactCard, { backgroundColor: surfaceColor }]}>
          <ThemedText type="defaultSemiBold" style={styles.contactTitle}>
            Contact Information
          </ThemedText>
          
          <ThemedText style={[styles.fieldLabel, { color: textSecondaryColor }]}>
            Phone Number
          </ThemedText>
          <TextInput
            style={[
              styles.contactInput,
              {
                color: textColor,
                borderColor: textSecondaryColor + '40',
                backgroundColor: backgroundColor,
              },
            ]}
            value={phone}
            onChangeText={handlePhoneChange}
            placeholder="e.g., +1 234 567 8900"
            placeholderTextColor={textSecondaryColor}
            keyboardType="phone-pad"
          />
          
          <ThemedText style={[styles.fieldLabel, { color: textSecondaryColor, marginTop: 12 }]}>
            Email
          </ThemedText>
          <TextInput
            style={[
              styles.contactInput,
              {
                color: textColor,
                borderColor: textSecondaryColor + '40',
                backgroundColor: backgroundColor,
              },
            ]}
            value={email}
            onChangeText={handleEmailChange}
            placeholder="e.g., john@example.com"
            placeholderTextColor={textSecondaryColor}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        {/* Notes Field */}
        <View style={[styles.notesCard, { backgroundColor: surfaceColor }]}>
          <ThemedText type="defaultSemiBold" style={styles.notesTitle}>
            Notes
          </ThemedText>
          <TextInput
            style={[
              styles.notesInput,
              {
                color: textColor,
                borderColor: textSecondaryColor + '40',
              },
            ]}
            value={notes}
            onChangeText={handleNotesChange}
            placeholder="Add notes (e.g., 'Can only come after 6pm')..."
            placeholderTextColor={textSecondaryColor}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        {!unavailableAllMonth && event.eventType === 'flexible' && (
          <>
            {/* Quick Actions */}
            <View style={[styles.quickActionsCard, { backgroundColor: surfaceColor }]}>
              <ThemedText type="defaultSemiBold" style={styles.quickActionsTitle}>
                Quick Selection
              </ThemedText>
              <View style={styles.quickActionsButtons}>
                <Pressable
                  style={[styles.quickActionButton, { backgroundColor: successColor }]}
                  onPress={() => handleSelectWeekends(true)}
                >
                  <ThemedText style={styles.quickActionButtonText}>
                    ✓ All Weekends
                  </ThemedText>
                </Pressable>
                <Pressable
                  style={[styles.quickActionButton, { backgroundColor: errorColor }]}
                  onPress={() => handleSelectWeekends(false)}
                >
                  <ThemedText style={styles.quickActionButtonText}>
                    ✗ All Weekends
                  </ThemedText>
                </Pressable>
              </View>
            </View>

            {/* Instructions */}
            <View style={[styles.instructionsCard, { backgroundColor: surfaceColor }]}>
              <ThemedText type="defaultSemiBold" style={styles.instructionsTitle}>
                How to Mark Availability
              </ThemedText>
              <ThemedText style={[styles.instructionsText, { color: textSecondaryColor }]}>
                • Tap any day to toggle available/unavailable{'\n'}
                • Use quick actions above for all weekends{'\n'}
                • Green = Available, Gray = Unavailable
              </ThemedText>
            </View>

            {/* Calendar */}
            <View style={[styles.calendar, { backgroundColor: surfaceColor }]}>
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
                {calendarDays.map((day, index) => {
                  if (day === null) {
                    return <View key={`empty-${index}`} style={styles.dayCell} />;
                  }

                  const dateStr = formatDate(event.year, event.month, day);
                  const isAvailable = participant.availability[dateStr] === true;

                  return (
                    <Pressable
                      key={`day-${day}`}
                      style={[
                        styles.dayCell,
                        {
                          backgroundColor: isAvailable 
                            ? successColor 
                            : colorScheme === 'light' ? '#F1F5F9' : '#1E293B',
                        },
                      ]}
                      onPress={() => handleDayPress(day)}
                    >
                      <ThemedText
                        style={[
                          styles.dayText,
                          { color: isAvailable ? '#FFFFFF' : textColor },
                        ]}
                      >
                        {day}
                      </ThemedText>
                      {isAvailable && (
                        <IconSymbol name="checkmark" size={12} color="#FFFFFF" />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </ThemedView>
    </KeyboardAvoidingView>
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
  headerTitle: {
    flex: 1,
    marginHorizontal: 8,
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  toggleCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  toggleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleText: {
    flex: 1,
    marginRight: 16,
  },
  toggleHint: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  contactCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  contactTitle: {
    marginBottom: 12,
    fontSize: 16,
    lineHeight: 24,
  },
  fieldLabel: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 6,
    fontWeight: '500',
  },
  contactInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    lineHeight: 22,
  },
  notesCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  notesTitle: {
    marginBottom: 12,
    fontSize: 16,
    lineHeight: 24,
  },
  notesInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    lineHeight: 22,
    minHeight: 80,
  },
  hintCard: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  hintText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  quickActionsCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  quickActionsTitle: {
    marginBottom: 12,
    fontSize: 16,
    lineHeight: 24,
  },
  quickActionsButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  quickActionButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  instructionsCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  instructionsTitle: {
    marginBottom: 8,
    fontSize: 16,
    lineHeight: 24,
  },
  instructionsText: {
    fontSize: 14,
    lineHeight: 22,
  },
  calendar: {
    borderRadius: 16,
    padding: 12,
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
    width: '14.28%',
    aspectRatio: 1,
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    marginBottom: 4,
  },
  dayText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  rsvpCard: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
  },
  rsvpTitle: {
    marginBottom: 8,
  },
  rsvpSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  rsvpButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  rsvpButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
  },
  rsvpButtonText: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
  },
});
