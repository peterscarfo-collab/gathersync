import { useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';
import { eventsLocalStorage as eventsLocalStorage } from '@/lib/local-storage';
import { eventsCloudStorage } from '@/lib/cloud-storage';
import { syncService } from '@/lib/sync-service';
import { generateId } from '@/lib/calendar-utils';
import { useAuth } from '@/hooks/use-auth';
import type { Event } from '@/types/models';
import { canCreateEvent, getSubscriptionLimits } from '@/lib/subscription';

export default function CreateEventScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    copyFrom?: string;
    name?: string;
    teamLeader?: string;
    meetingType?: 'in-person' | 'virtual';
    venueName?: string;
    venueContact?: string;
    venuePhone?: string;
    meetingLink?: string;
    rsvpDeadline?: string;
    meetingNotes?: string;
    participants?: string;
  }>();
  
  const [eventName, setEventName] = useState(params.name || '');
  const [eventType, setEventType] = useState<'flexible' | 'fixed'>('flexible');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [fixedDate, setFixedDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [teamLeader, setTeamLeader] = useState(params.teamLeader || '');
  const [meetingType, setMeetingType] = useState<'in-person' | 'virtual'>(params.meetingType || 'in-person');
  const [venueName, setVenueName] = useState(params.venueName || '');
  const [venueContact, setVenueContact] = useState(params.venueContact || '');
  const [venuePhone, setVenuePhone] = useState(params.venuePhone || '');
  const [meetingLink, setMeetingLink] = useState(params.meetingLink || '');
  const [rsvpDeadline, setRsvpDeadline] = useState(params.rsvpDeadline || '');
  const [meetingNotes, setMeetingNotes] = useState(params.meetingNotes || '');

  const { user, isAuthenticated } = useAuth();
  const tintColor = useThemeColor({}, 'tint');
  const backgroundColor = useThemeColor({}, 'background');
  const surfaceColor = useThemeColor({}, 'surface');
  const textColor = useThemeColor({}, 'text');
  const textSecondaryColor = useThemeColor({}, 'textSecondary');

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear + i);

  const handleCreate = async () => {
    if (!eventName.trim()) {
      Alert.alert('Error', 'Please enter an event name');
      return;
    }

    // Check subscription limits
    if (user && isAuthenticated) {
      const tier = (user as any).subscriptionTier || 'free';
      
      // Count actual events created this month (not relying on database counter)
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();
      
      const allEvents = await eventsLocalStorage.getAll();
      const eventsThisMonth = allEvents.filter(event => {
        const eventDate = new Date(event.createdAt);
        return eventDate.getMonth() + 1 === currentMonth && eventDate.getFullYear() === currentYear;
      }).length;
      
      const limitCheck = canCreateEvent(tier, eventsThisMonth);
      
      if (!limitCheck.allowed) {
        Alert.alert(
          'Upgrade Required',
          limitCheck.reason || 'You\'ve reached your event limit.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Upgrade to Pro',
              onPress: () => router.push('/upgrade'),
            },
          ]
        );
        return;
      }
    }

    try {
      const now = new Date().toISOString();
      
      // If copying from another event, parse participants
      let participants = [];
      if (params.copyFrom && params.participants) {
        try {
          const parsedParticipants = JSON.parse(params.participants);
          participants = parsedParticipants.map((p: any) => ({
            id: generateId(),
            name: p.name || p,
            phone: p.phone,
            email: p.email,
            availability: {}, // Empty availability for new event
            rsvpStatus: 'no-response' as const,
          }));
        } catch (e) {
          console.error('Failed to parse participants:', e);
        }
      }
      
      const newEvent: Event = {
        id: generateId(),
        name: eventName.trim(),
        eventType,
        month: eventType === 'fixed' ? new Date(fixedDate).getMonth() + 1 : selectedMonth,
        year: eventType === 'fixed' ? new Date(fixedDate).getFullYear() : selectedYear,
        fixedDate: eventType === 'fixed' ? `${fixedDate.getFullYear()}-${String(fixedDate.getMonth() + 1).padStart(2, '0')}-${String(fixedDate.getDate()).padStart(2, '0')}` : undefined,
        fixedTime: eventType === 'fixed' ? `${String(fixedDate.getHours()).padStart(2, '0')}:${String(fixedDate.getMinutes()).padStart(2, '0')}` : undefined,
        participants,
        createdAt: now,
        updatedAt: now,
        teamLeader: teamLeader.trim() || undefined,
        meetingType,
        venueName: meetingType === 'in-person' ? venueName.trim() || undefined : undefined,
        venueContact: meetingType === 'in-person' ? venueContact.trim() || undefined : undefined,
        venuePhone: meetingType === 'in-person' ? venuePhone.trim() || undefined : undefined,
        meetingLink: meetingType === 'virtual' ? meetingLink.trim() || undefined : undefined,
        rsvpDeadline: rsvpDeadline.trim() || undefined,
        meetingNotes: meetingNotes.trim() || undefined,
      };

      // Save locally first (use addWithId to preserve our generated ID)
      await eventsLocalStorage.addWithId(newEvent);
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // Navigate immediately - don't wait for cloud sync
      router.replace({
        pathname: '/event-detail' as any,
        params: { eventId: newEvent.id },
      });
      
      // Push to cloud in background (fire-and-forget)
      if (isAuthenticated) {
        eventsCloudStorage.add(newEvent)
          .then(() => {
            console.log('[CreateEvent] Event pushed to cloud successfully:', newEvent.id);
          })
          .catch((syncError) => {
            console.error('[CreateEvent] Failed to push to cloud:', syncError);
            // Don't block user - local save succeeded, will sync later
          });
      }
    } catch (error) {
      console.error('Failed to create event:', error);
      Alert.alert('Error', 'Failed to create event. Please try again.');
    }
  };

  return (
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
        <ThemedText type="subtitle">Create Event</ThemedText>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={[
          styles.contentContainer,
          { paddingBottom: Math.max(insets.bottom, 16) + 80 },
        ]}
      >
        <View style={styles.section}>
          <ThemedText type="defaultSemiBold" style={styles.label}>
            Event Name
          </ThemedText>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: surfaceColor,
                color: textColor,
                borderColor: surfaceColor,
              },
            ]}
            placeholder="e.g., Team Dinner, Weekend Hike"
            placeholderTextColor={textSecondaryColor}
            value={eventName}
            onChangeText={setEventName}
            autoFocus
          />
        </View>

        {/* Event Type */}
        <View style={styles.section}>
          <ThemedText type="defaultSemiBold" style={styles.label}>
            Event Type
          </ThemedText>
          <View style={styles.yearRow}>
            <Pressable
              style={[
                styles.yearItem,
                { backgroundColor: surfaceColor },
                eventType === 'flexible' && { backgroundColor: tintColor },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setEventType('flexible');
              }}
            >
              <ThemedText
                style={[
                  styles.yearText,
                  eventType === 'flexible' && styles.pickerTextSelected,
                ]}
              >
                Flexible
              </ThemedText>
            </Pressable>
            <Pressable
              style={[
                styles.yearItem,
                { backgroundColor: surfaceColor },
                eventType === 'fixed' && { backgroundColor: tintColor },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setEventType('fixed');
              }}
            >
              <ThemedText
                style={[
                  styles.yearText,
                  eventType === 'fixed' && styles.pickerTextSelected,
                ]}
              >
                Fixed
              </ThemedText>
            </Pressable>
          </View>
          <ThemedText style={[styles.helperText, { color: textSecondaryColor }]}>
            {eventType === 'flexible' 
              ? 'Participants mark multiple days they\'re available'
              : 'Set a specific date and time for the event'}
          </ThemedText>
        </View>

        {eventType === 'flexible' && (
          <View style={styles.section}>
            <ThemedText type="defaultSemiBold" style={styles.label}>
              Month
            </ThemedText>
          <View style={styles.pickerGrid}>
            {months.map((month, index) => {
              const monthValue = index + 1;
              const isSelected = selectedMonth === monthValue;
              return (
                <Pressable
                  key={month}
                  style={[
                    styles.pickerItem,
                    { backgroundColor: surfaceColor },
                    isSelected && { backgroundColor: tintColor },
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelectedMonth(monthValue);
                  }}
                >
                  <ThemedText
                    style={[
                      styles.pickerText,
                      isSelected && styles.pickerTextSelected,
                    ]}
                  >
                    {month}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </View>
        )}

        {/* Fixed Event Date & Time */}
        {eventType === 'fixed' && (
          <>
            <View style={styles.section}>
              <ThemedText type="defaultSemiBold" style={styles.label}>
                Date
              </ThemedText>
              <Pressable
                style={[
                  styles.input,
                  {
                    backgroundColor: surfaceColor,
                    borderColor: surfaceColor,
                    justifyContent: 'center',
                  },
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowDatePicker(true);
                }}
              >
                <ThemedText style={{ color: textColor }}>
                  {fixedDate.toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </ThemedText>
              </Pressable>
              {showDatePicker && Platform.OS !== 'web' && (
                <DateTimePicker
                  value={fixedDate}
                  mode="date"
                  display="spinner"
                  onChange={(event: any, selectedDate?: Date) => {
                    setShowDatePicker(Platform.OS === 'ios');
                    if (selectedDate) {
                      setFixedDate(selectedDate);
                    }
                  }}
                />
              )}
              {Platform.OS === 'web' && (
                <input
                  type="date"
                  style={{
                    width: '100%',
                    padding: 16,
                    fontSize: 16,
                    backgroundColor: surfaceColor,
                    color: textColor,
                    border: 'none',
                    borderRadius: 12,
                  }}
                  value={fixedDate.toISOString().split('T')[0]}
                  onChange={(e) => {
                    const date = new Date(e.target.value);
                    if (!isNaN(date.getTime())) {
                      setFixedDate(new Date(date.getFullYear(), date.getMonth(), date.getDate(), fixedDate.getHours(), fixedDate.getMinutes()));
                    }
                  }}
                />
              )}
            </View>

            <View style={styles.section}>
              <ThemedText type="defaultSemiBold" style={styles.label}>
                Time
              </ThemedText>
              <Pressable
                style={[
                  styles.input,
                  {
                    backgroundColor: surfaceColor,
                    borderColor: surfaceColor,
                    justifyContent: 'center',
                  },
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowTimePicker(true);
                }}
              >
                <ThemedText style={{ color: textColor }}>
                  {fixedDate.toLocaleTimeString('en-US', { 
                    hour: '2-digit', 
                    minute: '2-digit'
                  })}
                </ThemedText>
              </Pressable>
              {showTimePicker && Platform.OS !== 'web' && (
                <DateTimePicker
                  value={fixedDate}
                  mode="time"
                  display="spinner"
                  onChange={(event: any, selectedTime?: Date) => {
                    setShowTimePicker(Platform.OS === 'ios');
                    if (selectedTime) {
                      setFixedDate(selectedTime);
                    }
                  }}
                />
              )}
              {Platform.OS === 'web' && (
                <input
                  type="time"
                  style={{
                    width: '100%',
                    padding: 16,
                    fontSize: 16,
                    backgroundColor: surfaceColor,
                    color: textColor,
                    border: 'none',
                    borderRadius: 12,
                  }}
                  value={`${String(fixedDate.getHours()).padStart(2, '0')}:${String(fixedDate.getMinutes()).padStart(2, '0')}`}
                  onChange={(e) => {
                    const [hours, minutes] = e.target.value.split(':').map(Number);
                    if (!isNaN(hours) && !isNaN(minutes)) {
                      const newDate = new Date(fixedDate);
                      newDate.setHours(hours, minutes);
                      setFixedDate(newDate);
                    }
                  }}
                />
              )}
            </View>
          </>
        )}

        {/* Team Leader */}
        <View style={styles.section}>
          <ThemedText type="defaultSemiBold" style={styles.label}>
            Team Leader (Optional)
          </ThemedText>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: surfaceColor,
                color: textColor,
                borderColor: surfaceColor,
              },
            ]}
            placeholder="Person responsible for organizing"
            placeholderTextColor={textSecondaryColor}
            value={teamLeader}
            onChangeText={setTeamLeader}
          />
        </View>

        {/* Meeting Type */}
        <View style={styles.section}>
          <ThemedText type="defaultSemiBold" style={styles.label}>
            Meeting Type
          </ThemedText>
          <View style={styles.yearRow}>
            <Pressable
              style={[
                styles.yearItem,
                { backgroundColor: surfaceColor },
                meetingType === 'in-person' && { backgroundColor: tintColor },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setMeetingType('in-person');
              }}
            >
              <ThemedText
                style={[
                  styles.yearText,
                  meetingType === 'in-person' && styles.pickerTextSelected,
                ]}
              >
                In-Person
              </ThemedText>
            </Pressable>
            <Pressable
              style={[
                styles.yearItem,
                { backgroundColor: surfaceColor },
                meetingType === 'virtual' && { backgroundColor: tintColor },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setMeetingType('virtual');
              }}
            >
              <ThemedText
                style={[
                  styles.yearText,
                  meetingType === 'virtual' && styles.pickerTextSelected,
                ]}
              >
                Virtual
              </ThemedText>
            </Pressable>
          </View>
        </View>

        {/* In-Person Meeting Details */}
        {meetingType === 'in-person' && (
          <>
            <View style={styles.section}>
              <ThemedText type="defaultSemiBold" style={styles.label}>
                Venue Name
              </ThemedText>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: surfaceColor,
                    color: textColor,
                    borderColor: surfaceColor,
                  },
                ]}
                placeholder="e.g., Coffee Shop, Restaurant"
                placeholderTextColor={textSecondaryColor}
                value={venueName}
                onChangeText={setVenueName}
              />
            </View>
            <View style={styles.section}>
              <ThemedText type="defaultSemiBold" style={styles.label}>
                Venue Contact Person
              </ThemedText>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: surfaceColor,
                    color: textColor,
                    borderColor: surfaceColor,
                  },
                ]}
                placeholder="Contact name"
                placeholderTextColor={textSecondaryColor}
                value={venueContact}
                onChangeText={setVenueContact}
              />
            </View>
            <View style={styles.section}>
              <ThemedText type="defaultSemiBold" style={styles.label}>
                Venue Phone
              </ThemedText>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: surfaceColor,
                    color: textColor,
                    borderColor: surfaceColor,
                  },
                ]}
                placeholder="Phone number"
                placeholderTextColor={textSecondaryColor}
                value={venuePhone}
                onChangeText={setVenuePhone}
                keyboardType="phone-pad"
              />
            </View>
          </>
        )}

        {/* Virtual Meeting Details */}
        {meetingType === 'virtual' && (
          <View style={styles.section}>
            <ThemedText type="defaultSemiBold" style={styles.label}>
              Meeting Link
            </ThemedText>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: surfaceColor,
                  color: textColor,
                  borderColor: surfaceColor,
                },
              ]}
              placeholder="Zoom, Google Meet, etc."
              placeholderTextColor={textSecondaryColor}
              value={meetingLink}
              onChangeText={setMeetingLink}
              keyboardType="url"
              autoCapitalize="none"
            />
          </View>
        )}

        {/* RSVP Deadline */}
        <View style={styles.section}>
          <ThemedText type="defaultSemiBold" style={styles.label}>
            RSVP Deadline (Optional)
          </ThemedText>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: surfaceColor,
                color: textColor,
                borderColor: surfaceColor,
              },
            ]}
            placeholder="e.g., Monday before, 2 days prior"
            placeholderTextColor={textSecondaryColor}
            value={rsvpDeadline}
            onChangeText={setRsvpDeadline}
          />
        </View>

        {/* Meeting Notes */}
        <View style={styles.section}>
          <ThemedText type="defaultSemiBold" style={styles.label}>
            Meeting Notes (Optional)
          </ThemedText>
          <TextInput
            style={[
              styles.input,
              styles.textArea,
              {
                backgroundColor: surfaceColor,
                color: textColor,
                borderColor: surfaceColor,
              },
            ]}
            placeholder="Additional details, agenda, etc."
            placeholderTextColor={textSecondaryColor}
            value={meetingNotes}
            onChangeText={setMeetingNotes}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        <View style={styles.section}>
          <ThemedText type="defaultSemiBold" style={styles.label}>
            Year
          </ThemedText>
          <View style={styles.yearRow}>
            {years.map((year) => {
              const isSelected = selectedYear === year;
              return (
                <Pressable
                  key={year}
                  style={[
                    styles.yearItem,
                    { backgroundColor: surfaceColor },
                    isSelected && { backgroundColor: tintColor },
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelectedYear(year);
                  }}
                >
                  <ThemedText
                    style={[
                      styles.yearText,
                      isSelected && styles.pickerTextSelected,
                    ]}
                  >
                    {year}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            paddingBottom: Math.max(insets.bottom, 16),
          },
        ]}
      >
        <Pressable
          style={[styles.createButton, { backgroundColor: tintColor }]}
          onPress={handleCreate}
        >
          <ThemedText style={styles.createButtonText}>
            Create Event
          </ThemedText>
        </Pressable>
      </View>
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  section: {
    marginBottom: 32,
  },
  label: {
    marginBottom: 12,
    fontSize: 16,
    lineHeight: 24,
  },
  input: {
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    lineHeight: 24,
    borderWidth: 2,
  },
  textArea: {
    minHeight: 100,
  },
  pickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pickerItem: {
    width: '31%',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  pickerText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  pickerTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  yearRow: {
    flexDirection: 'row',
    gap: 8,
  },
  yearItem: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  yearText: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.05)',
  },
  createButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    minHeight: 48,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
  },
  helperText: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6,
  },
});
