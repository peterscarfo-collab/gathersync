import { useState, useEffect } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter, useLocalSearchParams } from 'expo-router';
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
  const [fixedDate, setFixedDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showTeamLeaderPicker, setShowTeamLeaderPicker] = useState(false);
  const [showVenueContactPicker, setShowVenueContactPicker] = useState(false);

  const tintColor = useThemeColor({}, 'tint');
  const backgroundColor = useThemeColor({}, 'background');
  const surfaceColor = useThemeColor({}, 'surface');
  const textColor = useThemeColor({}, 'text');
  const textSecondaryColor = useThemeColor({}, 'textSecondary');
  
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
      
      // Initialize fixed date/time if it's a fixed event
      if (loadedEvent.eventType === 'fixed' && loadedEvent.fixedDate && loadedEvent.fixedTime) {
        const [hours, minutes] = loadedEvent.fixedTime.split(':').map(Number);
        const dateTime = new Date(loadedEvent.fixedDate + 'T00:00:00');
        dateTime.setHours(hours, minutes);
        setFixedDate(dateTime);
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
        // Update fixed date/time if it's a fixed event
        fixedDate: event.eventType === 'fixed' ? `${fixedDate.getFullYear()}-${String(fixedDate.getMonth() + 1).padStart(2, '0')}-${String(fixedDate.getDate()).padStart(2, '0')}` : event.fixedDate,
        fixedTime: event.eventType === 'fixed' ? `${String(fixedDate.getHours()).padStart(2, '0')}:${String(fixedDate.getMinutes()).padStart(2, '0')}` : event.fixedTime,
        month: event.eventType === 'fixed' ? fixedDate.getMonth() + 1 : event.month,
        year: event.eventType === 'fixed' ? fixedDate.getFullYear() : event.year,
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
        >
          <IconSymbol name="chevron.left" size={28} color={tintColor} />
        </Pressable>
        <ThemedText type="subtitle">Edit Meeting Details</ThemedText>
        <Pressable
          onPress={handleSave}
          hitSlop={8}
        >
          <ThemedText style={[styles.saveButton, { color: tintColor }]}>Save</ThemedText>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 16) + 16 },
        ]}
      >
        {/* Date & Time (Fixed Events Only) */}
        {event.eventType === 'fixed' && (
          <>
            <View style={styles.section}>
              <ThemedText type="subtitle" style={styles.sectionTitle}>Date</ThemedText>
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
                    marginTop: 8,
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
              <ThemedText type="subtitle" style={styles.sectionTitle}>Time</ThemedText>
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
                    marginTop: 8,
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
          <ThemedText type="subtitle" style={styles.sectionTitle}>Team Leader</ThemedText>
          <View style={styles.inputRow}>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: surfaceColor, color: textColor },
              ]}
              placeholder="Who's organizing this?"
              placeholderTextColor={textSecondaryColor}
              value={teamLeader}
              onChangeText={setTeamLeader}
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
          <ThemedText type="subtitle" style={styles.sectionTitle}>Meeting Type</ThemedText>
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
              <ThemedText type="subtitle" style={styles.sectionTitle}>Venue Name</ThemedText>
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
              <ThemedText type="subtitle" style={styles.sectionTitle}>Venue Address</ThemedText>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: surfaceColor, color: textColor },
                ]}
                placeholder="Address (auto-filled or enter manually)"
                placeholderTextColor={textSecondaryColor}
                value={venueAddress}
                onChangeText={setVenueAddress}
                multiline
              />
            </View>

            <View style={styles.section}>
              <ThemedText type="subtitle" style={styles.sectionTitle}>Venue Contact</ThemedText>
              <View style={styles.inputRow}>
                <TextInput
                  style={[
                    styles.input,
                    { backgroundColor: surfaceColor, color: textColor },
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
              <ThemedText type="subtitle" style={styles.sectionTitle}>Venue Phone</ThemedText>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: surfaceColor, color: textColor },
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
            <ThemedText type="subtitle" style={styles.sectionTitle}>Meeting Link</ThemedText>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: surfaceColor, color: textColor },
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
          <ThemedText type="subtitle" style={styles.sectionTitle}>RSVP Deadline</ThemedText>
          <TextInput
            style={[
              styles.input,
              { backgroundColor: surfaceColor, color: textColor },
            ]}
            placeholder="e.g., Monday before"
            placeholderTextColor={textSecondaryColor}
            value={rsvpDeadline}
            onChangeText={setRsvpDeadline}
          />
        </View>

        {/* Meeting Notes */}
        <View style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>Notes</ThemedText>
          <TextInput
            style={[
              styles.input,
              styles.textArea,
              { backgroundColor: surfaceColor, color: textColor },
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
      </ScrollView>

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
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    marginBottom: 12,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    fontSize: 16,
    lineHeight: 24,
  },
  textArea: {
    minHeight: 100,
    paddingTop: 12,
  },
  contactButton: {
    width: 48,
    height: 48,
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
});
