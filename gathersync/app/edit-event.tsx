import { useState, useEffect } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, TextInput, View, Switch } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAutoSync } from '@/hooks/use-auto-sync';
import { eventsLocalStorage as eventsLocalStorage } from '@/lib/local-storage';
import { generateId } from '@/lib/calendar-utils';
import type { Event } from '@/types/models';

export default function EditEventScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    eventId: string;
  }>();
  
  // State declarations MUST come first
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [eventName, setEventName] = useState('');
  const [eventType, setEventType] = useState<'flexible' | 'fixed'>('flexible');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [fixedDate, setFixedDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [teamLeader, setTeamLeader] = useState('');
  const [meetingType, setMeetingType] = useState<'in-person' | 'virtual'>('in-person');
  const [venueName, setVenueName] = useState('');
  const [venueContact, setVenueContact] = useState('');
  const [venuePhone, setVenuePhone] = useState('');
  const [meetingLink, setMeetingLink] = useState('');
  const [rsvpDeadline, setRsvpDeadline] = useState('');
  const [meetingNotes, setMeetingNotes] = useState('');
  const [showAttendeeNames, setShowAttendeeNames] = useState(true);
  const [showAttendeeEmails, setShowAttendeeEmails] = useState(false);
  const [showAttendeePhones, setShowAttendeePhones] = useState(false);
  
  // Use auto-sync for proper event updates
  const { updateEvent: autoUpdateEvent } = useAutoSync();
  
  // Load event data after state is initialized
  useEffect(() => {
    loadEvent();
  }, [params.eventId]);
  
  const loadEvent = async () => {
    try {
      const existingEvent = await eventsLocalStorage.getById(params.eventId);
      if (existingEvent) {
        console.log('[EditEvent] Loading event:', existingEvent);
        setEvent(existingEvent);
        setEventName(existingEvent.name);
        setEventType(existingEvent.eventType || 'flexible');
        setSelectedMonth(existingEvent.month);
        setSelectedYear(existingEvent.year);
        if (existingEvent.fixedDate && existingEvent.fixedTime) {
          const dateTime = new Date(existingEvent.fixedDate + 'T' + existingEvent.fixedTime);
          console.log('[EditEvent] Setting fixed date:', dateTime);
          setFixedDate(dateTime);
        }
        setTeamLeader(existingEvent.teamLeader || '');
        setMeetingType(existingEvent.meetingType || 'in-person');
        setVenueName(existingEvent.venueName || '');
        setVenueContact(existingEvent.venueContact || '');
        setVenuePhone(existingEvent.venuePhone || '');
        setMeetingLink(existingEvent.meetingLink || '');
        setRsvpDeadline(existingEvent.rsvpDeadline || '');
        setMeetingNotes(existingEvent.meetingNotes || '');
        setShowAttendeeNames(existingEvent.showAttendeeNames ?? true);
        setShowAttendeeEmails(existingEvent.showAttendeeEmails ?? false);
        setShowAttendeePhones(existingEvent.showAttendeePhones ?? false);
        console.log('[EditEvent] Event loaded successfully');
      }
    } catch (error) {
      console.error('[EditEvent] Failed to load event:', error);
      Alert.alert('Error', 'Failed to load event');
    } finally {
      setLoading(false);
    }
  };

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

  const handleSave = async () => {
    if (!eventName.trim()) {
      Alert.alert('Error', 'Please enter an event name');
      return;
    }

    try {
      if (!event) {
        console.error('[EditEvent] No event loaded');
        Alert.alert('Error', 'Event data not loaded');
        return;
      }
      
      console.log('[EditEvent] Preparing updates...');
      
      // If converting from flexible to fixed, or if the fixed date changes,
      // automatically update RSVP status based on their flexible availability
      let updatedParticipants = event.participants;
      if (eventType === 'fixed') {
        // Need to ensure month and day are 2 digits
        const m = String(fixedDate.getMonth() + 1).padStart(2, '0');
        const d = String(fixedDate.getDate()).padStart(2, '0');
        const selectedDateStr = `${fixedDate.getFullYear()}-${m}-${d}`;
        
        const dateChanged = event.fixedDate !== selectedDateStr;
        const convertingToFixed = event.eventType === 'flexible';
        
        if (convertingToFixed || dateChanged) {
          console.log(`[EditEvent] Updating RSVPs for fixed date: ${selectedDateStr}`);
          updatedParticipants = event.participants.map(p => {
            let isAvailable = false;
            let hasResponded = false;
            
            if (p.availability) {
              // Check if availability is an array or object
              if (Array.isArray(p.availability)) {
                isAvailable = p.availability.includes(selectedDateStr);
                hasResponded = p.availability.length > 0;
              } else {
                isAvailable = p.availability[selectedDateStr] === true;
                hasResponded = Object.keys(p.availability).length > 0;
              }
              console.log(`[EditEvent] Participant ${p.name} availability for ${selectedDateStr}:`, isAvailable);
            }
            
            if (isAvailable) {
              return { ...p, rsvpStatus: 'attending' as const };
            } else if (hasResponded) {
              return { ...p, rsvpStatus: 'not-attending' as const };
            }
            
            return { ...p, rsvpStatus: 'no-response' as const };
          });
        }
      }

      const updates: Partial<Event> = {
        name: eventName.trim(),
        eventType,
        month: eventType === 'fixed' ? new Date(fixedDate).getMonth() + 1 : selectedMonth,
        year: eventType === 'fixed' ? new Date(fixedDate).getFullYear() : selectedYear,
        fixedDate: eventType === 'fixed' ? `${fixedDate.getFullYear()}-${String(fixedDate.getMonth() + 1).padStart(2, '0')}-${String(fixedDate.getDate()).padStart(2, '0')}` : undefined,
        fixedTime: eventType === 'fixed' ? `${String(fixedDate.getHours()).padStart(2, '0')}:${String(fixedDate.getMinutes()).padStart(2, '0')}` : undefined,
        updatedAt: new Date().toISOString(),
        teamLeader: teamLeader.trim() || undefined,
        meetingType,
        venueName: meetingType === 'in-person' ? venueName.trim() || undefined : undefined,
        venueContact: meetingType === 'in-person' ? venueContact.trim() || undefined : undefined,
        venuePhone: meetingType === 'in-person' ? venuePhone.trim() || undefined : undefined,
        meetingLink: meetingType === 'virtual' ? meetingLink.trim() || undefined : undefined,
        rsvpDeadline: rsvpDeadline.trim() || undefined,
        meetingNotes: meetingNotes.trim() || undefined,
        showAttendeeNames,
        showAttendeeEmails,
        showAttendeePhones,
        participants: updatedParticipants,
      };

      console.log('[EditEvent] Saving updates:', updates);
      await autoUpdateEvent(params.eventId, updates);
      console.log('[EditEvent] Save successful');
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      router.back();
    } catch (error) {
      console.error('[EditEvent] Failed to update event:', error);
      Alert.alert('Error', `Failed to update event: ${error}`);
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
          style={{ flexDirection: 'row', alignItems: 'center' }}
        >
          <IconSymbol name="chevron.left" size={28} color={tintColor} />
          <ThemedText style={{ color: tintColor, fontSize: 16, fontWeight: '600', marginLeft: -4 }}>Back to Events</ThemedText>
        </Pressable>
        <ThemedText type="subtitle">Edit Event</ThemedText>
        <View style={{ width: 100 }} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={[
          styles.contentContainer,
          { paddingBottom: Math.max(insets.bottom, 16) + 20 },
        ]}
      >
        <View style={styles.formContainer}>
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

        {/* Flexible Event Details */}
        {eventType === 'flexible' && (
          <>
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
          </>
        )}

        {/* Fixed Event Date & Time */}
        {eventType === 'fixed' && (
          <>
            <View style={styles.section}>
              <ThemedText type="defaultSemiBold" style={styles.label}>
                Date
              </ThemedText>
              {Platform.OS === 'web' ? (
                <input
                  type="date"
                  style={{
                    width: '100%',
                    padding: 12,
                    fontSize: 16,
                    backgroundColor: surfaceColor,
                    color: textColor,
                    border: 'none',
                    borderRadius: 12,
                  }}
                  value={`${fixedDate.getFullYear()}-${String(fixedDate.getMonth() + 1).padStart(2, '0')}-${String(fixedDate.getDate()).padStart(2, '0')}`}
                  onChange={(e) => {
                    if (e.target.value) {
                      const [year, month, day] = e.target.value.split('-').map(Number);
                      setFixedDate(new Date(year, month - 1, day, fixedDate.getHours(), fixedDate.getMinutes()));
                    }
                  }}
                />
              ) : (
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
              )}
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
            </View>

            <View style={styles.section}>
              <ThemedText type="defaultSemiBold" style={styles.label}>
                Time
              </ThemedText>
              {Platform.OS === 'web' ? (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select
                    style={{
                      flex: 1,
                      padding: 12,
                      fontSize: 16,
                      backgroundColor: surfaceColor,
                      color: textColor,
                      border: 'none',
                      borderRadius: 12,
                    }}
                    value={fixedDate.getHours() % 12 || 12}
                    onChange={(e) => {
                      const h = parseInt(e.target.value, 10);
                      const isPM = fixedDate.getHours() >= 12;
                      const newDate = new Date(fixedDate);
                      newDate.setHours(isPM ? (h === 12 ? 12 : h + 12) : (h === 12 ? 0 : h));
                      setFixedDate(newDate);
                    }}
                  >
                    {Array.from({ length: 12 }).map((_, i) => (
                      <option key={i + 1} value={i + 1}>{i + 1}</option>
                    ))}
                  </select>
                  <select
                    style={{
                      flex: 1,
                      padding: 12,
                      fontSize: 16,
                      backgroundColor: surfaceColor,
                      color: textColor,
                      border: 'none',
                      borderRadius: 12,
                    }}
                    value={Math.floor(fixedDate.getMinutes() / 5) * 5}
                    onChange={(e) => {
                      const newDate = new Date(fixedDate);
                      newDate.setMinutes(parseInt(e.target.value, 10));
                      setFixedDate(newDate);
                    }}
                  >
                    {Array.from({ length: 12 }).map((_, i) => {
                      const mins = i * 5;
                      return <option key={mins} value={mins}>{String(mins).padStart(2, '0')}</option>;
                    })}
                  </select>
                  <select
                    style={{
                      flex: 1,
                      padding: 12,
                      fontSize: 16,
                      backgroundColor: surfaceColor,
                      color: textColor,
                      border: 'none',
                      borderRadius: 12,
                    }}
                    value={fixedDate.getHours() >= 12 ? 'PM' : 'AM'}
                    onChange={(e) => {
                      const isPM = e.target.value === 'PM';
                      const h = fixedDate.getHours();
                      const newDate = new Date(fixedDate);
                      if (isPM && h < 12) newDate.setHours(h + 12);
                      if (!isPM && h >= 12) newDate.setHours(h - 12);
                      setFixedDate(newDate);
                    }}
                  >
                    <option value="AM">AM</option>
                    <option value="PM">PM</option>
                  </select>
                </div>
              ) : (
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
                      hour: 'numeric', 
                      minute: '2-digit',
                      hour12: true
                    })}
                  </ThemedText>
                </Pressable>
              )}
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

        {/* Privacy Settings */}
        <View style={styles.section}>
          <ThemedText type="defaultSemiBold" style={styles.label}>
            Public Page Visibility
          </ThemedText>
          <View style={[styles.input, { backgroundColor: surfaceColor, borderColor: surfaceColor, paddingVertical: 16 }]}>
            
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <View style={{ flex: 1, paddingRight: 16 }}>
                <ThemedText type="defaultSemiBold">Show Attendee Names</ThemedText>
                <ThemedText style={{ fontSize: 13, color: textSecondaryColor, marginTop: 4 }}>
                  Display the names of people who have RSVP'd.
                </ThemedText>
              </View>
              <Switch
                value={showAttendeeNames}
                onValueChange={setShowAttendeeNames}
                trackColor={{ false: '#767577', true: tintColor }}
                thumbColor={Platform.OS === 'ios' ? '#FFFFFF' : showAttendeeNames ? '#FFFFFF' : '#f4f3f4'}
              />
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <View style={{ flex: 1, paddingRight: 16 }}>
                <ThemedText type="defaultSemiBold">Show Attendee Emails</ThemedText>
                <ThemedText style={{ fontSize: 13, color: textSecondaryColor, marginTop: 4 }}>
                  Display the email addresses of attendees.
                </ThemedText>
              </View>
              <Switch
                value={showAttendeeEmails}
                onValueChange={setShowAttendeeEmails}
                trackColor={{ false: '#767577', true: tintColor }}
                thumbColor={Platform.OS === 'ios' ? '#FFFFFF' : showAttendeeEmails ? '#FFFFFF' : '#f4f3f4'}
              />
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex: 1, paddingRight: 16 }}>
                <ThemedText type="defaultSemiBold">Show Attendee Phone Numbers</ThemedText>
                <ThemedText style={{ fontSize: 13, color: textSecondaryColor, marginTop: 4 }}>
                  Display the phone numbers of attendees.
                </ThemedText>
              </View>
              <Switch
                value={showAttendeePhones}
                onValueChange={setShowAttendeePhones}
                trackColor={{ false: '#767577', true: tintColor }}
                thumbColor={Platform.OS === 'ios' ? '#FFFFFF' : showAttendeePhones ? '#FFFFFF' : '#f4f3f4'}
              />
            </View>

          </View>
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
          onPress={handleSave}
        >
          <ThemedText style={styles.createButtonText}>
            Save Changes
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
    alignItems: 'center',
  },
  formContainer: {
    width: '100%',
    maxWidth: 600,
  },
  section: {
    marginBottom: 16,
  },
  label: {
    marginBottom: 8,
    fontSize: 14,
    lineHeight: 20,
  },
  input: {
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    lineHeight: 24,
    borderWidth: 1,
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
  helperText: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6,
  },
  footer: {
    padding: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.05)',
  },
  createButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
