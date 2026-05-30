import { useState, useEffect } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View, Switch } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ContactPickerModal } from '@/components/contact-picker-modal';
import { VenueAddressInput } from '@/components/venue-address-input';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAutoSync } from '@/hooks/use-auto-sync';
import { eventsLocalStorage } from '@/lib/local-storage';
import type { Event } from '@/types/models';

export default function EditMeetingDetailsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { eventId } = useLocalSearchParams<{ eventId: string }>();

  const [event, setEvent] = useState<Event | null>(null);
  const [teamLeader, setTeamLeader] = useState('');
  const [teamLeaderPhone, setTeamLeaderPhone] = useState('');
  const [meetingType, setMeetingType] = useState<'in-person' | 'virtual'>('in-person');
  const [venueName, setVenueName] = useState('');
  const [venueAddress, setVenueAddress] = useState('');
  const [venueContact, setVenueContact] = useState('');
  const [venuePhone, setVenuePhone] = useState('');
  const [meetingLink, setMeetingLink] = useState('');
  const [rsvpDeadline, setRsvpDeadline] = useState('');
  const [meetingNotes, setMeetingNotes] = useState('');
  const [digitalTwinUrl, setDigitalTwinUrl] = useState('');
  const [quorumType, setQuorumType] = useState<'none' | 'number' | 'percentage'>('none');
  const [quorumValue, setQuorumValue] = useState('');
  const [showAttendeeNames, setShowAttendeeNames] = useState(true);
  const [showAttendeeEmails, setShowAttendeeEmails] = useState(false);
  const [showAttendeePhones, setShowAttendeePhones] = useState(false);
  const [fixedDate, setFixedDate] = useState<Date>(new Date());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showTeamLeaderPicker, setShowTeamLeaderPicker] = useState(false);
  const [showVenueContactPicker, setShowVenueContactPicker] = useState(false);

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
  
  // Use auto-sync for proper event updates
  const { updateEvent: autoUpdateEvent } = useAutoSync();

  useEffect(() => {
    loadEvent();
  }, [eventId]);

  const loadEvent = async () => {
    if (!eventId) return;
    const loadedEvent = await eventsLocalStorage.getById(eventId);
    if (loadedEvent) {
      setEvent(loadedEvent);
      setTeamLeader(loadedEvent.teamLeader || '');
      setTeamLeaderPhone(loadedEvent.teamLeaderPhone || '');
      setMeetingType(loadedEvent.meetingType || 'in-person');
      setVenueName(loadedEvent.venueName || '');
      setVenueAddress(loadedEvent.venueAddress || '');
      setVenueContact(loadedEvent.venueContact || '');
      setVenuePhone(loadedEvent.venuePhone || '');
      setMeetingLink(loadedEvent.meetingLink || '');
      setRsvpDeadline(loadedEvent.rsvpDeadline || '');
      setMeetingNotes(loadedEvent.meetingNotes || '');
      setDigitalTwinUrl(loadedEvent.digitalTwinUrl || '');
      setQuorumType(loadedEvent.quorumType || 'none');
      setQuorumValue(loadedEvent.quorumValue ? loadedEvent.quorumValue.toString() : '');
      setShowAttendeeNames(loadedEvent.showAttendeeNames ?? true);
      setShowAttendeeEmails(loadedEvent.showAttendeeEmails ?? false);
      setShowAttendeePhones(loadedEvent.showAttendeePhones ?? false);
      
      // Initialize fixed date/time if it's a fixed event
      if (loadedEvent.eventType === 'fixed' && loadedEvent.fixedDate && loadedEvent.fixedTime) {
        const [hours, minutes] = loadedEvent.fixedTime.split(':').map(Number);
        const dateTime = new Date(loadedEvent.fixedDate + 'T00:00:00');
        dateTime.setHours(hours, minutes);
        setFixedDate(dateTime);
      } else if (loadedEvent.eventType === 'flexible') {
        if (loadedEvent.month) setSelectedMonth(loadedEvent.month);
        if (loadedEvent.year) setSelectedYear(loadedEvent.year);
      }
    }
  };

  const handlePickContactForTeamLeader = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowTeamLeaderPicker(true);
  };

  const handlePickContactForVenue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowVenueContactPicker(true);
  };

  const handleSave = async () => {
    if (!event) return;

    try {
      const updatedEvent: Event = {
        ...event,
        teamLeader: teamLeader.trim() || undefined,
        teamLeaderPhone: teamLeaderPhone.trim() || undefined,
        meetingType,
        venueName: meetingType === 'in-person' ? venueName.trim() || undefined : undefined,
        venueAddress: meetingType === 'in-person' ? venueAddress.trim() || undefined : undefined,
        venueContact: meetingType === 'in-person' ? venueContact.trim() || undefined : undefined,
        venuePhone: meetingType === 'in-person' ? venuePhone.trim() || undefined : undefined,
        meetingLink: meetingType === 'virtual' ? meetingLink.trim() || undefined : undefined,
        rsvpDeadline: rsvpDeadline.trim() || undefined,
        meetingNotes: meetingNotes.trim() || undefined,
        digitalTwinUrl: digitalTwinUrl.trim() || undefined,
        quorumType: quorumType !== 'none' ? quorumType : undefined,
        quorumValue: quorumType !== 'none' && quorumValue ? parseInt(quorumValue, 10) : undefined,
        showAttendeeNames,
        showAttendeeEmails,
        showAttendeePhones,
        // Update fixed date/time if it's a fixed event
        fixedDate: event.eventType === 'fixed' ? `${fixedDate.getFullYear()}-${String(fixedDate.getMonth() + 1).padStart(2, '0')}-${String(fixedDate.getDate()).padStart(2, '0')}` : event.fixedDate,
        fixedTime: event.eventType === 'fixed' ? `${String(fixedDate.getHours()).padStart(2, '0')}:${String(fixedDate.getMinutes()).padStart(2, '0')}` : event.fixedTime,
        month: event.eventType === 'fixed' ? fixedDate.getMonth() + 1 : selectedMonth,
        year: event.eventType === 'fixed' ? fixedDate.getFullYear() : selectedYear,
        updatedAt: new Date().toISOString(),
      };

      // Use autoUpdateEvent to ensure proper persistence and sync
      await autoUpdateEvent(eventId!, updatedEvent);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (error) {
      console.error('Failed to update meeting details:', error);
      Alert.alert('Error', 'Failed to update meeting details. Please try again.');
    }
  };

  if (!event) {
    return (
      <ThemedView style={[styles.container, { backgroundColor }]}>
        <ThemedText>Loading...</ThemedText>
      </ThemedView>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
      keyboardVerticalOffset={0}
    >
      <ThemedView style={[styles.container, { backgroundColor }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: Math.max(insets.top, 16),
            paddingBottom: 16,
            borderBottomColor: surfaceColor,
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
        <ThemedText type="subtitle">Edit Meeting Details</ThemedText>
        <View style={{ width: 100 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 16) + 16 },
        ]}
      >
        <View style={styles.formContainer}>
        {/* Month & Year (Flexible Events Only) */}
        {event.eventType === 'flexible' && (
          <View style={styles.section}>
            <ThemedText type="subtitle" style={styles.sectionTitle}>Event Month</ThemedText>
            <View style={styles.yearRow}>
              {Platform.OS === 'web' ? (
                <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                  <select
                    style={{
                      flex: 2,
                      padding: 16,
                      fontSize: 16,
                      backgroundColor: surfaceColor,
                      color: textColor,
                      border: 'none',
                      borderRadius: 12,
                    }}
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  >
                    {months.map((m, i) => (
                      <option key={i} value={i + 1}>{m}</option>
                    ))}
                  </select>
                  <select
                    style={{
                      flex: 1,
                      padding: 16,
                      fontSize: 16,
                      backgroundColor: surfaceColor,
                      color: textColor,
                      border: 'none',
                      borderRadius: 12,
                    }}
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                  >
                    {years.map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <View style={{ flexDirection: 'row', gap: 8, width: '100%' }}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 2 }}>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {months.map((month, index) => {
                        const isSelected = selectedMonth === index + 1;
                        return (
                          <Pressable
                            key={month}
                            style={[
                              styles.yearItem,
                              { backgroundColor: surfaceColor },
                              isSelected && { backgroundColor: tintColor },
                            ]}
                            onPress={() => {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                              setSelectedMonth(index + 1);
                            }}
                          >
                            <ThemedText style={[styles.yearText, isSelected && { color: '#fff' }]}>
                              {month}
                            </ThemedText>
                          </Pressable>
                        );
                      })}
                    </View>
                  </ScrollView>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
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
                            <ThemedText style={[styles.yearText, isSelected && { color: '#fff' }]}>
                              {year}
                            </ThemedText>
                          </Pressable>
                        );
                      })}
                    </View>
                  </ScrollView>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Date & Time (Fixed Events Only) */}
        {event.eventType === 'fixed' && (
          <>
            <View style={styles.section}>
              <ThemedText type="subtitle" style={styles.sectionTitle}>Date</ThemedText>
              {Platform.OS === 'web' ? (
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
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setShowDatePicker(true);
                  }}
                  style={[styles.input, { backgroundColor: surfaceColor, justifyContent: 'center' }]}
                >
                  <ThemedText style={{ color: textColor }}>
                    {fixedDate.toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </ThemedText>
                </Pressable>
              )}
            </View>

            <View style={styles.section}>
              <ThemedText type="subtitle" style={styles.sectionTitle}>Time</ThemedText>
              {Platform.OS === 'web' ? (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select
                    style={{
                      flex: 1,
                      padding: 16,
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
                      padding: 16,
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
                      padding: 16,
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
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setShowTimePicker(true);
                  }}
                  style={[styles.input, { backgroundColor: surfaceColor, justifyContent: 'center' }]}
                >
                  <ThemedText style={{ color: textColor }}>
                    {fixedDate.toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true,
                    })}
                  </ThemedText>
                </Pressable>
              )}
            </View>
          </>
        )}

        {/* Team Leader */}
        <View style={styles.section}>
          <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
            Team Leader (Optional)
          </ThemedText>
          <View style={styles.inputRow}>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: surfaceColor, color: textColor, borderColor: surfaceColor },
              ]}
              placeholder="Who's organizing this?"
              placeholderTextColor={textSecondaryColor}
              value={teamLeader}
              onChangeText={(text) => {
                setTeamLeader(text);
                if (text !== event?.teamLeader) {
                  setTeamLeaderPhone('');
                }
              }}
            />
            <Pressable
              style={[styles.contactButton, { backgroundColor: tintColor }]}
              onPress={handlePickContactForTeamLeader}
            >
              <IconSymbol name="person.text.rectangle" size={20} color="#fff" />
            </Pressable>
          </View>
        </View>

        {/* Meeting Type */}
        <View style={styles.section}>
          <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
            Meeting Type
          </ThemedText>
          <View style={[styles.segmentedControl, { backgroundColor: surfaceColor }]}>
            <Pressable
              style={[
                styles.segment,
                meetingType === 'in-person' && [styles.segmentActive, { backgroundColor: tintColor }],
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setMeetingType('in-person');
              }}
            >
              <ThemedText
                style={[
                  styles.segmentText,
                  meetingType === 'in-person' && styles.segmentTextActive,
                ]}
              >
                In-Person
              </ThemedText>
            </Pressable>
            <Pressable
              style={[
                styles.segment,
                meetingType === 'virtual' && [styles.segmentActive, { backgroundColor: tintColor }],
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setMeetingType('virtual');
              }}
            >
              <ThemedText
                style={[
                  styles.segmentText,
                  meetingType === 'virtual' && styles.segmentTextActive,
                ]}
              >
                Virtual
              </ThemedText>
            </Pressable>
          </View>
        </View>

        {/* In-Person Details */}
        {meetingType === 'in-person' && (
          <>
            <View style={styles.section}>
              <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
                Venue Name
              </ThemedText>
              <VenueAddressInput
                value={venueName}
                onPlaceSelect={(name, address) => {
                  setVenueName(name);
                  setVenueAddress(address);
                }}
                placeholder="Search for venue (e.g., Kiss the Barista)"
              />
            </View>

            <View style={styles.section}>
              <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
                Venue Address
              </ThemedText>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: surfaceColor, color: textColor, borderColor: surfaceColor },
                ]}
                placeholder="Address (auto-filled or enter manually)"
                placeholderTextColor={textSecondaryColor}
                value={venueAddress}
                onChangeText={setVenueAddress}
                multiline
              />
            </View>

            <View style={styles.section}>
              <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
                Venue Contact
              </ThemedText>
              <View style={styles.inputRow}>
                <TextInput
                  style={[
                    styles.input,
                    { backgroundColor: surfaceColor, color: textColor, borderColor: surfaceColor },
                  ]}
                  placeholder="Contact person"
                  placeholderTextColor={textSecondaryColor}
                  value={venueContact}
                  onChangeText={setVenueContact}
                />
                <Pressable
                  style={[styles.contactButton, { backgroundColor: tintColor }]}
                  onPress={handlePickContactForVenue}
                >
                  <IconSymbol name="person.text.rectangle" size={20} color="#fff" />
                </Pressable>
              </View>
            </View>

            <View style={styles.section}>
              <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
                Venue Phone
              </ThemedText>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: surfaceColor, color: textColor, borderColor: surfaceColor },
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

        {/* Virtual Meeting Link */}
        {meetingType === 'virtual' && (
          <View style={styles.section}>
            <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
              Meeting Link
            </ThemedText>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: surfaceColor, color: textColor, borderColor: surfaceColor },
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
          <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
            RSVP Deadline
          </ThemedText>
          <TextInput
            style={[
              styles.input,
              { backgroundColor: surfaceColor, color: textColor, borderColor: surfaceColor },
            ]}
            placeholder="e.g., Monday before"
            placeholderTextColor={textSecondaryColor}
            value={rsvpDeadline}
            onChangeText={setRsvpDeadline}
          />
        </View>

        {/* Meeting Notes */}
        <View style={styles.section}>
          <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
            Notes
          </ThemedText>
          <TextInput
            style={[
              styles.input,
              styles.textArea,
              { backgroundColor: surfaceColor, color: textColor, borderColor: surfaceColor },
            ]}
            placeholder="Additional details..."
            placeholderTextColor={textSecondaryColor}
            value={meetingNotes}
            onChangeText={setMeetingNotes}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Minimum Attendance (Quorum) */}
        <View style={styles.section}>
          <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
            Minimum Attendance / Quorum (Optional)
          </ThemedText>
          <View style={styles.yearRow}>
            <Pressable
              style={[
                styles.yearItem,
                { backgroundColor: surfaceColor },
                quorumType === 'none' && { backgroundColor: tintColor },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setQuorumType('none');
              }}
            >
              <ThemedText style={[styles.yearText, quorumType === 'none' && { color: '#fff' }]}>
                None
              </ThemedText>
            </Pressable>
            <Pressable
              style={[
                styles.yearItem,
                { backgroundColor: surfaceColor },
                quorumType === 'number' && { backgroundColor: tintColor },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setQuorumType('number');
              }}
            >
              <ThemedText style={[styles.yearText, quorumType === 'number' && { color: '#fff' }]}>
                Fixed Number
              </ThemedText>
            </Pressable>
            <Pressable
              style={[
                styles.yearItem,
                { backgroundColor: surfaceColor },
                quorumType === 'percentage' && { backgroundColor: tintColor },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setQuorumType('percentage');
              }}
            >
              <ThemedText style={[styles.yearText, quorumType === 'percentage' && { color: '#fff' }]}>
                Percentage
              </ThemedText>
            </Pressable>
          </View>

          {quorumType !== 'none' && (
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: surfaceColor,
                  color: textColor,
                  borderColor: surfaceColor,
                  marginTop: 12,
                },
              ]}
              placeholder={quorumType === 'number' ? "e.g., 30" : "e.g., 75"}
              placeholderTextColor={textSecondaryColor}
              value={quorumValue}
              onChangeText={setQuorumValue}
              keyboardType="number-pad"
            />
          )}
          <ThemedText style={{ fontSize: 13, color: textSecondaryColor, marginTop: 8 }}>
            {quorumType === 'none' ? 'No minimum attendance required for this event to proceed.' :
             quorumType === 'number' ? 'Enter the exact number of attendees required.' :
             'Enter the percentage of invited participants required (will round up to nearest person).'}
          </ThemedText>
        </View>

        {/* Digital Twin URL */}
        <View style={styles.section}>
          <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
            GetBizCard Digital Twin URL (Optional)
          </ThemedText>
          <TextInput
            style={[
              styles.input,
              { backgroundColor: surfaceColor, color: textColor, borderColor: surfaceColor },
            ]}
            placeholder="e.g., https://getbizcard.com/your-name"
            placeholderTextColor={textSecondaryColor}
            value={digitalTwinUrl}
            onChangeText={setDigitalTwinUrl}
            keyboardType="url"
            autoCapitalize="none"
          />
        </View>

        {/* Public Page Visibility */}
        <View style={styles.section}>
          <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
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
            backgroundColor: surfaceColor,
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

      {/* Contact Picker Modals */}
      <ContactPickerModal
        visible={showTeamLeaderPicker}
        onClose={() => setShowTeamLeaderPicker(false)}
        onSelect={(contact) => {
          setTeamLeader(contact.name);
          if (contact.phone) {
            setTeamLeaderPhone(contact.phone);
          }
        }}
        title="Select Team Leader"
      />

      <ContactPickerModal
        visible={showVenueContactPicker}
        onClose={() => setShowVenueContactPicker(false)}
        onSelect={(contact) => {
          setVenueContact(contact.name);
          if (contact.phone) {
            setVenuePhone(contact.phone);
          }
        }}
        title="Select Venue Contact"
      />

      {/* Date & Time Pickers */}
      {showDatePicker && Platform.OS !== 'web' && (
        <DateTimePicker
          value={fixedDate}
          mode="date"
          display="default"
          onChange={(event: any, selectedDate?: Date) => {
            if (Platform.OS === 'android') {
              setShowDatePicker(false);
            }
            if (selectedDate) {
              setFixedDate(selectedDate);
              if (Platform.OS === 'ios') {
                setShowDatePicker(false);
              }
            }
          }}
        />
      )}

      {showTimePicker && Platform.OS !== 'web' && (
        <DateTimePicker
          value={fixedDate}
          mode="time"
          display="default"
          onChange={(event: any, selectedTime?: Date) => {
            if (Platform.OS === 'android') {
              setShowTimePicker(false);
            }
            if (selectedTime) {
              setFixedDate(selectedTime);
              if (Platform.OS === 'ios') {
              setShowTimePicker(false);
              }
            }
          }}
        />
      )}
      </ThemedView>
    </KeyboardAvoidingView>
    </>
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
  },
  saveButton: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  yearRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  yearItem: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  yearText: {
    fontSize: 14,
    fontWeight: '500',
  },
  formContainer: {
    width: '100%',
    maxWidth: 600,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    marginBottom: 8,
    fontSize: 14,
    lineHeight: 20,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    fontSize: 16,
    lineHeight: 24,
    borderWidth: 1,
  },
  textArea: {
    minHeight: 100,
    paddingTop: 12,
  },
  contactButton: {
    width: 50,
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  segmentedControl: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  segmentActive: {
    // backgroundColor set dynamically
  },
  segmentText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  segmentTextActive: {
    color: '#FFFFFF',
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
