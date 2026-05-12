import React, { useState, useCallback } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, TextInput, View, Share, Linking, Modal, useWindowDimensions } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Stack, useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { DesktopLayout } from '@/components/desktop-layout';
import { CalendarGrid } from '@/components/calendar-grid';
import { DayDetailPane } from '@/components/day-detail-pane';
import { ParticipantDetailPane } from '@/components/participant-detail-pane';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAutoSync } from '@/hooks/use-auto-sync';
import { eventsLocalStorage as eventsLocalStorage, snapshotsLocalStorage as snapshotsLocalStorage } from '@/lib/local-storage';
import { getMonthName, generateId, getBestDays } from '@/lib/calendar-utils';
import { exportToCalendar } from '@/lib/calendar-export';
import { exportSingleEventBackup, downloadBackup } from '@/lib/backup';
import { getEffectiveAttendanceStatus, getParticipantStatus, getRsvpCounts, getStatusBadge, hasRecordedAttendance, ParticipantStatus } from '@/lib/participant-status';
import type { Event, Participant } from '@/types/models';

export default function EventDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const params = useLocalSearchParams<{ eventId?: string; id?: string }>();
  const eventId = params.eventId || params.id;
  const { updateEvent: autoUpdateEvent, deleteEvent: autoDeleteEvent } = useAutoSync();

  const [event, setEvent] = useState<Event | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [selectedParticipantId, setSelectedParticipantId] = useState<string | null>(null);
  const [rsvpFilter, setRsvpFilter] = useState<'attending' | 'not-attending' | 'no-response' | null>(null);
  const [isEditingReminder, setIsEditingReminder] = useState(false);
  const [editedReminder, setEditedReminder] = useState('');

  const tintColor = useThemeColor({}, 'tint');
  const backgroundColor = useThemeColor({}, 'background');
  const surfaceColor = useThemeColor({}, 'surface');
  const textColor = useThemeColor({}, 'text');
  const textSecondaryColor = useThemeColor({}, 'textSecondary');
  const successColor = useThemeColor({}, 'success');
  const errorColor = useThemeColor({}, 'error');

  const loadEvent = async (retryCount = 0) => {
    if (!eventId) return;
    const loadedEvent = await eventsLocalStorage.getById(eventId);
    if (loadedEvent) {
      // Enrich participants with global contact info across all events
      try {
        const allEvents = await eventsLocalStorage.getAll();
        const globalInfo = new Map<string, {phone?: string, email?: string}>();
        allEvents.forEach(e => e.participants.forEach(p => {
          if (!globalInfo.has(p.name)) {
            globalInfo.set(p.name, { phone: p.phone, email: p.email });
          } else {
            const current = globalInfo.get(p.name)!;
            if (p.phone && !current.phone) current.phone = p.phone;
            if (p.email && !current.email) current.email = p.email;
          }
        }));

        loadedEvent.participants.forEach(p => {
          const info = globalInfo.get(p.name);
          if (info) {
            if (!p.phone && info.phone) p.phone = info.phone;
            if (!p.email && info.email) p.email = info.email;
          }
        });
      } catch (err) {
        console.error('Failed to enrich participants:', err);
      }

      setEvent(loadedEvent);
      setEditedName(loadedEvent.name);
      setEditedReminder(loadedEvent.reminderMessage || '');
    } else if (retryCount < 10) {
      // Event not found - might be AsyncStorage write delay
      // Retry up to 10 times with 300ms delay (total 3 seconds)
      console.log(`[EventDetail] Event not found, retrying (${retryCount + 1}/10)...`);
      setTimeout(() => loadEvent(retryCount + 1), 300);
    } else {
      // All retries failed - event truly doesn't exist
      console.error('[EventDetail] Event not found after 10 retries:', eventId);
      Alert.alert(
        'Event Not Found',
        'Could not load event. It may have been deleted or failed to save.',
        [
          { text: 'OK', onPress: () => router.back() }
        ]
      );
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadEvent();
    }, [eventId])
  );

  const updateEvent = async (updatedEvent: Event) => {
    const updated = {
      ...updatedEvent,
      updatedAt: new Date().toISOString(),
    };
    // Use auto-sync to save and sync to cloud
    await autoUpdateEvent(eventId!, updated);
    setEvent(updated);
    
    // Check if attendance needs to be recalculated in event detail view
    // (This ensures RSVP Summary on the event-detail screen matches)
  };

  const handleSaveName = async () => {
    if (!event || !editedName.trim()) return;
    await updateEvent({ ...event, name: editedName.trim() });
    setIsEditingName(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleSaveReminder = async () => {
    if (!event) return;
    await updateEvent({ ...event, reminderMessage: editedReminder.trim() });
    setIsEditingReminder(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleDayPress = (day: number) => {
    if (!event) return;
    if (isDesktop) {
      setSelectedDay(day);
      setSelectedParticipantId(null);
    } else {
      router.push({
        pathname: '/day-detail' as any,
        params: { eventId: event.id, day: day.toString() },
      });
    }
  };

  const handleAddParticipant = () => {
    if (!event) return;
    router.push({
      pathname: '/admin/participants' as any,
      params: { eventId: event.id },
    });
  };

  const handleParticipantPress = (participant: Participant) => {
    if (!event) return;
    if (isDesktop) {
      setSelectedParticipantId(participant.id);
      setSelectedDay(null);
    } else {
      router.push({
        pathname: '/edit-availability' as any,
        params: { eventId: event.id, participantId: participant.id },
      });
    }
  };

  const handleShareEvent = async () => {
    if (!event) return;

    const bestDays = getBestDays(event);
    const bestDayText = bestDays.length > 0
      ? `Best day: ${bestDays[0].date} (${bestDays[0].availableCount} available)`
      : 'No availability data yet';

    // Create web link for event viewing and RSVP
    const baseUrl = Platform.OS === 'web' 
      ? window.location.origin
      : 'https://app.gathersync.com'; // TODO: Update with actual production domain
    const webUrl = `${baseUrl}/public-event?eventId=${event.id}`;

    const baseMessage = `📅 ${event.name}\n${getMonthName(event.month)} ${event.year}\n\n${bestDayText}\n\nView and RSVP:\n${webUrl}`;
    const message = event.reminderMessage 
      ? `${event.reminderMessage}\n\n${baseMessage}`
      : baseMessage;

    try {
      await Share.share({
        message,
        title: event.name,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleForwardEvent = async () => {
    if (!event) return;

    // Create a shareable message with event details
    const eventType = event.eventType === 'fixed' 
      ? `Fixed Event: ${event.fixedDate}${event.fixedTime ? ' at ' + event.fixedTime : ''}`
      : `Flexible Event: ${getMonthName(event.month)} ${event.year}`;
    
    const bestDays = getBestDays(event);
    const bestDayText = bestDays.length > 0
      ? `\nBest day: ${bestDays[0].date} (${bestDays[0].availableCount} available)`
      : '';
    
    const meetingDetails = [];
    if (event.meetingType === 'in-person' && event.venueName) {
      meetingDetails.push(`Venue: ${event.venueName}`);
      if (event.venueAddress) meetingDetails.push(`Address: ${event.venueAddress}`);
    } else if (event.meetingType === 'virtual' && event.meetingLink) {
      meetingDetails.push(`Meeting Link: ${event.meetingLink}`);
    }

    // Create web link for event viewing and RSVP
    const baseUrl = Platform.OS === 'web' 
      ? window.location.origin
      : 'https://app.gathersync.com'; // TODO: Update with actual production domain
    const webUrl = `${baseUrl}/public-event?eventId=${event.id}`;

    const baseMessage = `📅 ${event.name}\n\n${eventType}${bestDayText}${meetingDetails.length > 0 ? '\n\n' + meetingDetails.join('\n') : ''}\n\nView and RSVP:\n${webUrl}`;
    const message = event.reminderMessage
      ? `${event.reminderMessage}\n\n${baseMessage}`
      : baseMessage;

    try {
      await Share.share({
        message,
        title: `Forward: ${event.name}`,
      });
    } catch (error) {
      console.error('Error forwarding event:', error);
    }
  };

  const handleShareWithParticipants = async () => {
    if (!event) return;

    if (event.participants.length === 0) {
      Alert.alert('No Participants', 'Add participants to this event before sharing.');
      return;
    }

    // Create personalized messages for each participant
    const messages = event.participants.map(participant => {
      const baseUrl = Platform.OS === 'web' 
        ? window.location.origin
        : 'https://app.gathersync.com'; // TODO: Update with actual production domain
      const webUrl = `${baseUrl}/public-event?eventId=${event.id}&name=${encodeURIComponent(participant.name)}`;
      
      const eventInfo = event.eventType === 'fixed'
        ? `${event.fixedDate}${event.fixedTime ? ' at ' + event.fixedTime : ''}`
        : `${getMonthName(event.month)} ${event.year}`;

      return `Hi ${participant.name},\n\n📅 ${event.name}\n${eventInfo}${event.venueName ? `\n📍 ${event.venueName}` : ''}\n\nView and update your availability:\n${webUrl}`;
    });

    // Combine all messages
    const combinedMessage = messages.join('\n\n---\n\n');

    try {
      await Share.share({
        message: combinedMessage,
        title: `${event.name} - Share with Participants`,
      });
    } catch (error) {
      console.error('Error sharing with participants:', error);
    }
  };

  const handleCopyEventDetails = async () => {
    if (!event) return;
    router.push({
      pathname: '/export-report' as any,
      params: { eventId: event.id, mode: 'text' },
    });
    setShowMenu(false);
  };

  const handleEmailParticipants = () => {
    if (!event) return;

    router.push({
      pathname: '/email-participants' as any,
      params: { eventId: event.id },
    });
  };

  const handleExportEventCSV = () => {
    if (!event) return;
    router.push({
      pathname: '/export-report' as any,
      params: { eventId: event.id },
    });
    setShowMenu(false);
  };

  const handleExportEventBackup = async () => {
    if (!event) return;
    
    try {
      console.log('[Backup] Starting single event export...');
      setShowMenu(false);
      
      const backup = await exportSingleEventBackup(event.id);
      
      // Clean up event name to be file-system safe
      const safeName = event.name.replace(/[^a-z0-9]/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').toLowerCase();
      const filename = `gathersync-event-${safeName}-${new Date().toISOString().split('T')[0]}.json`;
      
      await downloadBackup(backup, filename);
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Success', 'Event backup exported successfully!');
    } catch (error) {
      console.error('[Backup] Export failed:', error);
      Alert.alert('Export Failed', 'Failed to export event backup. Please try again.');
    }
  };

  const handleExportToCalendar = async () => {
    if (!event) return;

    try {
      await exportToCalendar(event);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      Alert.alert('Export Failed', error.message || 'Could not export to calendar');
    }
  };

  const handleCopyEvent = async () => {
    if (!event) return;

    // Navigate to create screen with pre-filled data
    router.push({
      pathname: '/create-event' as any,
      params: {
        copyFrom: event.id,
        name: event.name,
        teamLeader: event.teamLeader || '',
        meetingType: event.meetingType || 'in-person',
        venueName: event.venueName || '',
        venueContact: event.venueContact || '',
        venuePhone: event.venuePhone || '',
        meetingLink: event.meetingLink || '',
        rsvpDeadline: event.rsvpDeadline || '',
        meetingNotes: event.meetingNotes || '',
        participants: JSON.stringify(event.participants.map(p => p.name)),
      },
    });
  };

  const handleSaveSnapshot = async () => {
    if (!event) return;

    const snapshot = {
      id: generateId(),
      eventId: event.id,
      name: event.name,
      savedAt: new Date().toISOString(),
      event,
    };

    await snapshotsLocalStorage.add(snapshot);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Success', 'Event snapshot saved!');
  };

  const handleFinalizeDate = async () => {
    if (!event) return;

    const bestDays = getBestDays(event);
    if (bestDays.length === 0) {
      Alert.alert('No Available Days', 'No participants have marked their availability yet.');
      return;
    }

    const bestDay = bestDays[0];
    const [year, month, day] = bestDay.date.split('-').map(Number);
    const dateStr = new Date(year, month - 1, day).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    Alert.alert(
      'Finalize Event Date',
      `Lock in ${dateStr}?\n\n${bestDay.availableCount} out of ${event.participants.length} participants available.\n\nThis will archive the event and mark it as complete.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Finalize',
          onPress: async () => {
            await autoUpdateEvent(eventId!, {
              ...event,
              finalized: true,
              finalizedDate: bestDay.date,
              archived: true,
              updatedAt: new Date().toISOString(),
            });

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert(
              'Event Finalized!',
              `Date locked in: ${dateStr}`,
              [
                {
                  text: 'OK',
                  onPress: () => router.back(),
                },
              ]
            );
          },
        },
      ]
    );
  };

  const handleArchiveEvent = async () => {
    if (!event) return;
    
    const isArchiving = !event.archived;
    await autoUpdateEvent(eventId!, {
      ...event,
      archived: isArchiving,
      updatedAt: new Date().toISOString(),
    });
    
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert(
      'Success',
      isArchiving ? 'Event archived' : 'Event unarchived',
      [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]
    );
  };

  const handleDeleteEvent = () => {
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    setShowDeleteConfirm(false);
    try {
      await autoDeleteEvent(eventId!);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (error) {
      console.error('[EventDetail] Failed to delete event from cloud:', error);
      Alert.alert('Notice', 'Event deleted locally but failed to sync to cloud. It will sync automatically later.');
      router.back();
    }
  };

  if (!event) {
    return (
      <ThemedView style={[styles.container, { backgroundColor }]}>
        <ThemedText>Loading...</ThemedText>
      </ThemedView>
    );
  }

  const fixedEventRsvpCounts =
    event.eventType === 'fixed' && event.fixedDate ? getRsvpCounts(event) : null;
  const fixedEventHasAttendance =
    event.eventType === 'fixed' && event.fixedDate ? hasRecordedAttendance(event) : false;

  const renderMeetingAndReminderSections = () => (
    <>
      {/* Reminder Section */}
        <View style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>Reminder</ThemedText>
          <View style={[styles.reminderCard, { backgroundColor: surfaceColor }]}>
            {isEditingReminder ? (
              <View>
                <TextInput
                  style={[
                    styles.nameInput,
                    { 
                      color: textColor, 
                      backgroundColor: backgroundColor,
                      padding: 12,
                      borderRadius: 8,
                      minHeight: 80,
                      marginBottom: 12
                    },
                  ]}
                  value={editedReminder}
                  onChangeText={setEditedReminder}
                  placeholder="Draft your reminder message here..."
                  placeholderTextColor={textSecondaryColor}
                  multiline
                  textAlignVertical="top"
                />
                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
                  <Pressable
                    style={{ padding: 8, paddingHorizontal: 16 }}
                    onPress={() => {
                      setIsEditingReminder(false);
                      setEditedReminder(event.reminderMessage || '');
                    }}
                  >
                    <ThemedText style={{ color: textSecondaryColor }}>Cancel</ThemedText>
                  </Pressable>
                  <Pressable
                    style={[styles.reminderButton, { backgroundColor: tintColor }]}
                    onPress={handleSaveReminder}
                  >
                    <IconSymbol name="checkmark" size={16} color="#FFFFFF" />
                    <ThemedText style={styles.reminderButtonText}>Save</ThemedText>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View>
                {event.reminderMessage ? (
                  <ThemedText style={{ color: textColor, marginBottom: 12, lineHeight: 20 }}>
                    {event.reminderMessage}
                  </ThemedText>
                ) : (
                  <ThemedText style={{ color: textSecondaryColor, marginBottom: 12 }}>
                    No reminder message set.
                  </ThemedText>
                )}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <ThemedText type="defaultSemiBold">Reminder Message</ThemedText>
                  <Pressable
                    style={[styles.reminderButton, { backgroundColor: tintColor }]}
                    onPress={() => {
                      setEditedReminder(event.reminderMessage || '');
                      setIsEditingReminder(true);
                    }}
                  >
                    <IconSymbol name="pencil" size={16} color="#FFFFFF" />
                    <ThemedText style={styles.reminderButtonText}>
                      {event.reminderMessage ? 'Edit Reminder' : 'Set Reminder'}
                    </ThemedText>
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Meeting Details Section */}
        {true && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <ThemedText type="subtitle">Meeting Details</ThemedText>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push({
                    pathname: '/edit-meeting-details' as any,
                    params: { eventId: event.id },
                  });
                }}
                hitSlop={8}
              >
                <IconSymbol name="pencil" size={20} color={tintColor} />
              </Pressable>
            </View>
            
            {event.teamLeader && (
              <View style={[styles.detailRow, { backgroundColor: surfaceColor }]}>
                <IconSymbol name="person.fill" size={20} color={tintColor} />
                <View style={styles.detailContent}>
                  <ThemedText style={[styles.detailLabel, { color: textSecondaryColor }]}>Team Leader</ThemedText>
                  <ThemedText type="defaultSemiBold">{event.teamLeader}</ThemedText>
                  {event.teamLeaderPhone && (
                    <ThemedText style={{ color: textSecondaryColor, marginTop: 2 }}>{event.teamLeaderPhone}</ThemedText>
                  )}
                </View>
                {event.teamLeaderPhone && (
                  <View style={styles.participantActions}>
                    <Pressable
                      style={[styles.quickActionButton, { backgroundColor: tintColor }]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        Linking.openURL(`tel:${event.teamLeaderPhone}`);
                      }}
                      hitSlop={4}
                    >
                      <IconSymbol name="phone.fill" size={14} color="#fff" />
                    </Pressable>
                    <Pressable
                      style={[styles.quickActionButton, { backgroundColor: tintColor }]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        Linking.openURL(`sms:${event.teamLeaderPhone}`);
                      }}
                      hitSlop={4}
                    >
                      <IconSymbol name="message.fill" size={14} color="#fff" />
                    </Pressable>
                  </View>
                )}
              </View>
            )}

            {event.meetingType === 'in-person' && event.venueName && (
              <>
                <View style={[styles.detailRow, { backgroundColor: surfaceColor }]}>
                  <IconSymbol name="mappin" size={20} color={tintColor} />
                  <View style={styles.detailContent}>
                    <ThemedText style={[styles.detailLabel, { color: textSecondaryColor }]}>Venue</ThemedText>
                    <ThemedText type="defaultSemiBold">{event.venueName}</ThemedText>
                    {event.venueAddress && (
                      <ThemedText style={{ color: textSecondaryColor, marginTop: 4, fontSize: 14 }}>{event.venueAddress}</ThemedText>
                    )}
                    {event.venueContact && (
                      <ThemedText style={{ color: textSecondaryColor, marginTop: 4 }}>Contact: {event.venueContact}</ThemedText>
                    )}
                    {event.venuePhone && (
                      <ThemedText style={{ color: textSecondaryColor, marginTop: 2 }}>{event.venuePhone}</ThemedText>
                    )}
                    {event.venueAddress && (
                      <Pressable
                        style={[styles.directionsButton, { backgroundColor: tintColor, marginTop: 12 }]}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          const encodedAddress = encodeURIComponent(event.venueAddress!);
                          const url = Platform.select({
                            ios: `maps://maps.apple.com/?address=${encodedAddress}`,
                            android: `geo:0,0?q=${encodedAddress}`,
                            default: `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`,
                          });
                          Linking.openURL(url!);
                        }}
                      >
                        <IconSymbol name="map.fill" size={16} color="#fff" />
                        <ThemedText style={{ color: '#fff', fontSize: 14, fontWeight: '600', marginLeft: 8 }}>Get Directions</ThemedText>
                      </Pressable>
                    )}
                  </View>
                  {event.venuePhone && (
                    <View style={styles.participantActions}>
                      <Pressable
                        style={[styles.quickActionButton, { backgroundColor: tintColor }]}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          Linking.openURL(`tel:${event.venuePhone}`);
                        }}
                        hitSlop={4}
                      >
                        <IconSymbol name="phone.fill" size={14} color="#fff" />
                      </Pressable>
                      <Pressable
                        style={[styles.quickActionButton, { backgroundColor: tintColor }]}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          Linking.openURL(`sms:${event.venuePhone}`);
                        }}
                        hitSlop={4}
                      >
                        <IconSymbol name="message.fill" size={14} color="#fff" />
                      </Pressable>
                    </View>
                  )}
                </View>
              </>
            )}

            {event.meetingType === 'virtual' && event.meetingLink && (
              <View style={[styles.detailRow, { backgroundColor: surfaceColor }]}>
                <IconSymbol name="video.fill" size={20} color={tintColor} />
                <View style={styles.detailContent}>
                  <ThemedText style={[styles.detailLabel, { color: textSecondaryColor }]}>Meeting Link</ThemedText>
                  <ThemedText type="defaultSemiBold" numberOfLines={1}>{event.meetingLink}</ThemedText>
                </View>
                <Pressable
                  style={[styles.actionButton, { backgroundColor: tintColor }]}
                  onPress={async () => {
                    await Clipboard.setStringAsync(event.meetingLink!);
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    Alert.alert('Copied', 'Meeting link copied to clipboard');
                  }}
                >
                  <IconSymbol name="doc.on.doc" size={16} color="#fff" />
                </Pressable>
              </View>
            )}

            {event.rsvpDeadline && (
              <View style={[styles.detailRow, { backgroundColor: surfaceColor }]}>
                <IconSymbol name="clock.fill" size={20} color={tintColor} />
                <View style={styles.detailContent}>
                  <ThemedText style={[styles.detailLabel, { color: textSecondaryColor }]}>RSVP Deadline</ThemedText>
                  <ThemedText type="defaultSemiBold">{event.rsvpDeadline}</ThemedText>
                </View>
              </View>
            )}

            {event.meetingNotes && (
              <View style={[styles.detailRow, { backgroundColor: surfaceColor }]}>
                <IconSymbol name="note.text" size={20} color={tintColor} />
                <View style={styles.detailContent}>
                  <ThemedText style={[styles.detailLabel, { color: textSecondaryColor }]}>Notes</ThemedText>
                  <ThemedText>{event.meetingNotes}</ThemedText>
                </View>
              </View>
            )}
            
            {/* Empty state when no meeting details */}
            {!event.teamLeader && !event.meetingType && !event.rsvpDeadline && !event.meetingNotes && (
              <View style={[styles.emptyMeetingDetails, { backgroundColor: surfaceColor }]}>
                <IconSymbol name="pencil" size={32} color={textSecondaryColor} />
                <ThemedText style={[styles.emptyText, { color: textSecondaryColor, marginTop: 12 }]}>
                  No meeting details yet
                </ThemedText>
                <ThemedText style={[styles.emptySubtext, { color: textSecondaryColor }]}>
                  Tap the pencil above to add venue, team leader, and more
                </ThemedText>
              </View>
            )}
          </View>
        )}
    </>
  );

  const renderParticipantsSection = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <ThemedText type="subtitle">Participants</ThemedText>
            <ThemedText style={[styles.participantCount, { color: textSecondaryColor }]}>
              {(() => {
                const count = event.participants.filter(p => !p.deletedAt && (!rsvpFilter || (
                  fixedEventHasAttendance 
                    ? getEffectiveAttendanceStatus(p, event) === rsvpFilter
                    : rsvpFilter === 'no-response' ? (!p.rsvpStatus || p.rsvpStatus === 'no-response') : p.rsvpStatus === rsvpFilter
                ))).length;
                return `${count}${rsvpFilter ? ' (Filtered)' : ''}`;
              })()}
            </ThemedText>
            {rsvpFilter && (
              <Pressable
                onPress={() => setRsvpFilter(null)}
                style={{ marginLeft: 8 }}
                hitSlop={8}
              >
                <IconSymbol name="xmark.circle.fill" size={20} color={textSecondaryColor} />
              </Pressable>
            )}
          </View>

          {event.participants.length === 0 ? (
            <View style={[styles.emptyParticipants, { backgroundColor: surfaceColor }]}>
              <IconSymbol name="person.2.fill" size={48} color={textSecondaryColor} />
              <ThemedText style={[styles.emptyText, { color: textSecondaryColor }]}>
                No participants yet
              </ThemedText>
              <ThemedText style={[styles.emptySubtext, { color: textSecondaryColor }]}>
                Add people to start tracking availability
              </ThemedText>
            </View>
          ) : (
            <View style={styles.participantsList}>
              {event.participants
                .filter(p => !p.deletedAt && (!rsvpFilter || (
                  fixedEventHasAttendance 
                    ? getEffectiveAttendanceStatus(p, event) === rsvpFilter
                    : rsvpFilter === 'no-response' ? (!p.rsvpStatus || p.rsvpStatus === 'no-response') : p.rsvpStatus === rsvpFilter
                )))
                .map((participant) => (
                <Pressable
                  key={participant.id}
                  style={[styles.participantCard, { backgroundColor: surfaceColor }]}
                  onPress={() => handleParticipantPress(participant)}
                >
                  <View style={styles.participantInfo}>
                    <IconSymbol name="person.2.fill" size={20} color={tintColor} />
                    <View style={styles.participantNameContainer}>
                      <View style={styles.participantNameRow}>
                        <ThemedText type="defaultSemiBold" style={styles.participantName}>
                          {participant.name}
                        </ThemedText>
                        {participant.source === 'contacts' && (
                          <View style={[styles.sourceBadge, { backgroundColor: tintColor + '20' }]}>
                            <IconSymbol name="person.text.rectangle" size={12} color={tintColor} />
                          </View>
                        )}
                      </View>
                      {participant.notes && (
                        <ThemedText style={[styles.participantNotes, { color: textSecondaryColor }]} numberOfLines={1}>
                          {participant.notes}
                        </ThemedText>
                      )}
                      {participant.designation && (
                        <ThemedText style={[styles.participantNotes, { color: textSecondaryColor }]} numberOfLines={1}>
                          {participant.designation}
                        </ThemedText>
                      )}
                      {participant.organization && (
                        <ThemedText style={[styles.participantNotes, { color: textSecondaryColor }]} numberOfLines={1}>
                          {participant.organization}
                        </ThemedText>
                      )}
                      {participant.phone && (
                        <ThemedText style={[styles.participantPhone, { color: textSecondaryColor }]}>
                          {participant.phone}
                        </ThemedText>
                      )}
                      {participant.email && (
                        <ThemedText style={[styles.participantEmail, { color: textSecondaryColor }]}>
                          {participant.email}
                        </ThemedText>
                      )}
                    </View>
                    <View style={styles.participantActions}>
                      <View style={[styles.statusBadge, { backgroundColor: getStatusBadge(getEffectiveAttendanceStatus(participant, event) as ParticipantStatus).color + '20' }]}>
                        <ThemedText style={[styles.statusBadgeText, { color: getStatusBadge(getEffectiveAttendanceStatus(participant, event) as ParticipantStatus).color }]}>
                          {getStatusBadge(getEffectiveAttendanceStatus(participant, event) as ParticipantStatus).icon}
                        </ThemedText>
                      </View>
                    </View>
                  </View>
                  <IconSymbol name="chevron.right" size={20} color={textSecondaryColor} />
                </Pressable>
              ))}
            </View>
          )}

          <Pressable
            style={[styles.addButton, { backgroundColor: tintColor }]}
            onPress={handleAddParticipant}
          >
            <IconSymbol name="person.badge.plus" size={20} color="#FFFFFF" />
            <ThemedText style={styles.addButtonText}>
              Add Participant
            </ThemedText>
          </Pressable>
        </View>
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <DesktopLayout>
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
        
        {isEditingName ? (
          <TextInput
            style={[
              styles.nameInput,
              { color: textColor },
            ]}
            value={editedName}
            onChangeText={setEditedName}
            onBlur={handleSaveName}
            onSubmitEditing={handleSaveName}
            autoFocus
          />
        ) : (
          <Pressable
            onPress={() => setIsEditingName(true)}
            style={styles.nameButton}
          >
            <ThemedText type="subtitle" numberOfLines={1}>
              {event.name}
            </ThemedText>
          </Pressable>
        )}

        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          {/* Menu Button */}
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowMenu(true);
            }}
            hitSlop={8}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: tintColor + '15', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 }}
          >
            <ThemedText style={{ color: tintColor, fontWeight: '600', fontSize: 15 }}>Actions</ThemedText>
            <IconSymbol name="chevron.down" size={14} color={tintColor} />
          </Pressable>
        </View>
        
        {/* Web-compatible menu modal */}
        <Modal
          visible={showMenu}
          transparent
          animationType="fade"
          onRequestClose={() => setShowMenu(false)}
        >
          <Pressable 
            style={styles.modalOverlay}
            onPress={() => setShowMenu(false)}
          >
            <View style={[styles.menuContainer, { backgroundColor: surfaceColor, maxHeight: '80%' }]}>
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Event Management */}
                <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 }}>
                  <ThemedText style={{ fontSize: 12, fontWeight: '700', color: textSecondaryColor, textTransform: 'uppercase', letterSpacing: 0.5 }}>Event Management</ThemedText>
                </View>
                <Pressable
                  style={[styles.menuItem, { borderBottomColor: textSecondaryColor + '20' }]}
                  onPress={() => {
                    setShowMenu(false);
                    router.push({ pathname: '/edit-event' as any, params: { eventId: event.id } });
                  }}
                >
                  <ThemedText style={styles.menuItemText}>Edit Event</ThemedText>
                </Pressable>
                
                <Pressable
                  style={[styles.menuItem, { borderBottomColor: textSecondaryColor + '20' }]}
                  onPress={() => {
                    setShowMenu(false);
                    handleCopyEvent();
                  }}
                >
                  <ThemedText style={styles.menuItemText}>Copy Event</ThemedText>
                </Pressable>
                
                <Pressable
                  style={[styles.menuItem, { borderBottomColor: textSecondaryColor + '20' }]}
                  onPress={() => {
                    setShowMenu(false);
                    handleCopyEventDetails();
                  }}
                >
                  <ThemedText style={styles.menuItemText}>Copy Event Details</ThemedText>
                </Pressable>

                {/* Participants & Communication */}
                <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8, borderTopWidth: 1, borderTopColor: textSecondaryColor + '20' }}>
                  <ThemedText style={{ fontSize: 12, fontWeight: '700', color: textSecondaryColor, textTransform: 'uppercase', letterSpacing: 0.5 }}>Participants & Communication</ThemedText>
                </View>
                <Pressable
                  style={[styles.menuItem, { borderBottomColor: textSecondaryColor + '20' }]}
                  onPress={() => {
                    setShowMenu(false);
                    router.push({ pathname: '/admin/attendance-event' as any, params: { eventId: event.id } });
                  }}
                >
                  <ThemedText style={styles.menuItemText}>Take / View Attendance</ThemedText>
                </Pressable>
                
                <Pressable
                  style={[styles.menuItem, { borderBottomColor: textSecondaryColor + '20' }]}
                  onPress={() => {
                    setShowMenu(false);
                    router.push({ pathname: '/invite-participants' as any, params: { eventId: event.id } });
                  }}
                >
                  <ThemedText style={styles.menuItemText}>Invite Participants</ThemedText>
                </Pressable>
                
                <Pressable
                  style={[styles.menuItem, { borderBottomColor: textSecondaryColor + '20' }]}
                  onPress={() => {
                    setShowMenu(false);
                    router.push({ pathname: '/send-messages' as any, params: { eventId: event.id } });
                  }}
                >
                  <ThemedText style={styles.menuItemText}>Send Messages</ThemedText>
                </Pressable>

                <Pressable
                  style={[styles.menuItem, { borderBottomColor: textSecondaryColor + '20' }]}
                  onPress={() => {
                    setShowMenu(false);
                    handleEmailParticipants();
                  }}
                >
                  <ThemedText style={styles.menuItemText}>Email All Participants</ThemedText>
                </Pressable>
                
                <Pressable
                  style={[styles.menuItem, { borderBottomColor: textSecondaryColor + '20' }]}
                  onPress={() => {
                    setShowMenu(false);
                    router.push({ pathname: '/import-contacts' as any, params: { eventId: event.id } });
                  }}
                >
                  <ThemedText style={styles.menuItemText}>Import Contact List (CSV)</ThemedText>
                </Pressable>
                
                <Pressable
                  style={[styles.menuItem, { borderBottomColor: textSecondaryColor + '20' }]}
                  onPress={() => {
                    setShowMenu(false);
                    router.push({ pathname: '/bulk-import' as any, params: { eventId: event.id } });
                  }}
                >
                  <ThemedText style={styles.menuItemText}>Bulk Import Availability</ThemedText>
                </Pressable>

                {/* Share & Export */}
                <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8, borderTopWidth: 1, borderTopColor: textSecondaryColor + '20' }}>
                  <ThemedText style={{ fontSize: 12, fontWeight: '700', color: textSecondaryColor, textTransform: 'uppercase', letterSpacing: 0.5 }}>Share & Export</ThemedText>
                </View>
                <Pressable
                  style={[styles.menuItem, { borderBottomColor: textSecondaryColor + '20' }]}
                  onPress={() => {
                    setShowMenu(false);
                    handleShareEvent();
                  }}
                >
                  <ThemedText style={styles.menuItemText}>Share Event</ThemedText>
                </Pressable>
                
                <Pressable
                  style={[styles.menuItem, { borderBottomColor: textSecondaryColor + '20' }]}
                  onPress={() => {
                    setShowMenu(false);
                    handleShareWithParticipants();
                  }}
                >
                  <ThemedText style={styles.menuItemText}>Share with Participants</ThemedText>
                </Pressable>
                
                <Pressable
                  style={[styles.menuItem, { borderBottomColor: textSecondaryColor + '20' }]}
                  onPress={() => {
                    setShowMenu(false);
                    handleExportToCalendar();
                  }}
                >
                  <ThemedText style={styles.menuItemText}>Export to Calendar</ThemedText>
                </Pressable>
                
                <Pressable
                  style={[styles.menuItem, { borderBottomColor: textSecondaryColor + '20' }]}
                  onPress={() => {
                    setShowMenu(false);
                    handleExportEventCSV();
                  }}
                >
                  <ThemedText style={styles.menuItemText}>Export Event to CSV</ThemedText>
                </Pressable>
                
                <Pressable
                  style={[styles.menuItem, { borderBottomColor: textSecondaryColor + '20' }]}
                  onPress={() => {
                    handleExportEventBackup();
                  }}
                >
                  <ThemedText style={styles.menuItemText}>Export Backup (Single Event)</ThemedText>
                </Pressable>

                {/* System & Status */}
                <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8, borderTopWidth: 1, borderTopColor: textSecondaryColor + '20' }}>
                  <ThemedText style={{ fontSize: 12, fontWeight: '700', color: textSecondaryColor, textTransform: 'uppercase', letterSpacing: 0.5 }}>System & Status</ThemedText>
                </View>
                <Pressable
                  style={[styles.menuItem, { borderBottomColor: textSecondaryColor + '20' }]}
                  onPress={() => {
                    setShowMenu(false);
                    handleSaveSnapshot();
                  }}
                >
                  <ThemedText style={styles.menuItemText}>Save Snapshot</ThemedText>
                </Pressable>
                
                <Pressable
                  style={[styles.menuItem, { borderBottomColor: textSecondaryColor + '20' }]}
                  onPress={() => {
                    setShowMenu(false);
                    handleFinalizeDate();
                  }}
                >
                  <ThemedText style={styles.menuItemText}>Finalize Date & Archive</ThemedText>
                </Pressable>
                
                <Pressable
                  style={[styles.menuItem, { borderBottomColor: textSecondaryColor + '20' }]}
                  onPress={() => {
                    setShowMenu(false);
                    handleArchiveEvent();
                  }}
                >
                  <ThemedText style={styles.menuItemText}>{event.archived ? 'Unarchive Event' : 'Archive Event'}</ThemedText>
                </Pressable>
                
                <Pressable
                  style={[styles.menuItem, { borderBottomColor: 'transparent' }]}
                  onPress={() => {
                    setShowMenu(false);
                    handleDeleteEvent();
                  }}
                >
                  <ThemedText style={[styles.menuItemText, { color: '#FF3B30' }]}>Delete Event</ThemedText>
                </Pressable>
              </ScrollView>
              
              <View style={{ borderTopWidth: 1, borderTopColor: textSecondaryColor + '20', backgroundColor: surfaceColor }}>
                <Pressable
                  style={[styles.menuItem, { borderBottomWidth: 0 }]}
                  onPress={() => setShowMenu(false)}
                >
                  <ThemedText style={[styles.menuItemText, { fontWeight: '600', textAlign: 'center' }]}>Cancel</ThemedText>
                </Pressable>
              </View>
            </View>
          </Pressable>
        </Modal>
      </View>

            <ScrollView
        style={styles.content}
        contentContainerStyle={[
          styles.contentContainer,
          { paddingBottom: Math.max(insets.bottom, 16) + 80 },
        ]}
      >
        <View style={[isDesktop && styles.splitContainer]}>
          <View style={[isDesktop && styles.splitLeft]}>
            {/* Fixed Event Date & RSVP/Attendance Summary */}
            {event.eventType === 'fixed' && event.fixedDate ? (
              <>
                <View style={[styles.fixedDateCard, { backgroundColor: surfaceColor }]}>
                  <View style={styles.fixedDateHeader}>
                    <IconSymbol name="calendar" size={24} color={tintColor} />
                    <ThemedText type="subtitle">
                      {new Date(event.fixedDate + 'T12:00:00').toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </ThemedText>
                  </View>
                  {event.fixedTime && (
                    <View style={styles.fixedTimeRow}>
                      <IconSymbol name="clock" size={20} color={textSecondaryColor} />
                      <ThemedText style={{ color: textSecondaryColor, fontSize: 16 }}>
                        {(() => {
                          const [hours, minutes] = event.fixedTime.split(':').map(Number);
                          const ampm = hours >= 12 ? 'PM' : 'AM';
                          const displayHours = hours % 12 || 12;
                          return `${displayHours}:${String(minutes).padStart(2, '0')} ${ampm}`;
                        })()}
                      </ThemedText>
                    </View>
                  )}
                </View>

                {/* RSVP/Attendance Summary */}
                <View style={styles.section}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <ThemedText type="subtitle" style={[styles.sectionTitle, { marginBottom: 0 }]}>
                      {fixedEventHasAttendance ? 'Attendance Summary' : 'RSVP Summary'}
                    </ThemedText>
                    <Pressable
                      style={{ backgroundColor: tintColor, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 }}
                      onPress={() => router.push({ pathname: '/admin/attendance-event' as any, params: { eventId: event.id } })}
                    >
                      <ThemedText style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>Take Attendance</ThemedText>
                    </Pressable>
                  </View>
                  <ThemedText style={{ color: textSecondaryColor, fontSize: 13, marginTop: -8, marginBottom: 12 }}>
                    Tap a box below to filter the participant list on the right.
                  </ThemedText>
                  <View style={[styles.rsvpSummaryCard, { backgroundColor: surfaceColor }]}>
                    <View style={styles.rsvpSummaryRow}>
                      <Pressable 
                        style={[
                          styles.rsvpSummaryItem, 
                          rsvpFilter === 'attending' && { opacity: 1, backgroundColor: tintColor + '10', borderRadius: 12 }, 
                          rsvpFilter && rsvpFilter !== 'attending' && { opacity: 0.3 }
                        ]}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setRsvpFilter(prev => prev === 'attending' ? null : 'attending');
                        }}
                      >
                        <ThemedText style={[styles.rsvpSummaryCount, { color: successColor }]}>
                          {fixedEventHasAttendance ? fixedEventRsvpCounts?.attending.length : event.participants.filter(p => !p.deletedAt && p.rsvpStatus === 'attending').length}
                        </ThemedText>
                        <ThemedText style={[styles.rsvpSummaryLabel, { color: textSecondaryColor }]}>
                          {rsvpFilter === 'attending' ? (fixedEventHasAttendance ? 'Selected: Attended' : 'Selected: Attending') : (fixedEventHasAttendance ? 'Attended' : 'Attending')}
                        </ThemedText>
                      </Pressable>
                      <Pressable 
                        style={[
                          styles.rsvpSummaryItem, 
                          rsvpFilter === 'not-attending' && { opacity: 1, backgroundColor: tintColor + '10', borderRadius: 12 }, 
                          rsvpFilter && rsvpFilter !== 'not-attending' && { opacity: 0.3 }
                        ]}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setRsvpFilter(prev => prev === 'not-attending' ? null : 'not-attending');
                        }}
                      >
                        <ThemedText style={[styles.rsvpSummaryCount, { color: errorColor }]}>
                          {fixedEventHasAttendance ? fixedEventRsvpCounts?.notAttending.length : event.participants.filter(p => !p.deletedAt && p.rsvpStatus === 'not-attending').length}
                        </ThemedText>
                        <ThemedText style={[styles.rsvpSummaryLabel, { color: textSecondaryColor }]}>
                          {rsvpFilter === 'not-attending' ? (fixedEventHasAttendance ? 'Selected: Not Attended' : 'Selected: Not Attending') : (fixedEventHasAttendance ? 'Not Attended' : 'Not Attending')}
                        </ThemedText>
                      </Pressable>
                      <Pressable 
                        style={[
                          styles.rsvpSummaryItem, 
                          rsvpFilter === 'no-response' && { opacity: 1, backgroundColor: tintColor + '10', borderRadius: 12 }, 
                          rsvpFilter && rsvpFilter !== 'no-response' && { opacity: 0.3 }
                        ]}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setRsvpFilter(prev => prev === 'no-response' ? null : 'no-response');
                        }}
                      >
                        <ThemedText style={[styles.rsvpSummaryCount, { color: textSecondaryColor }]}>
                          {fixedEventHasAttendance ? fixedEventRsvpCounts?.noResponse.length : event.participants.filter(p => !p.deletedAt && (!p.rsvpStatus || p.rsvpStatus === 'no-response')).length}
                        </ThemedText>
                        <ThemedText style={[styles.rsvpSummaryLabel, { color: textSecondaryColor }]}>
                          {rsvpFilter === 'no-response' ? 'Selected: No Response' : (fixedEventHasAttendance ? 'Unchecked' : 'No Response')}
                        </ThemedText>
                      </Pressable>
                    </View>
                  </View>
                </View>
              </>
            ) : (
              <>
                {/* Month/Year Display */}
                <View style={styles.monthHeader}>
                  <ThemedText type="title">
                    {getMonthName(event.month)} {event.year}
                  </ThemedText>
                </View>

                {/* Calendar Grid */}
                <CalendarGrid event={event} onDayPress={handleDayPress} />
              </>
            )}

            {renderMeetingAndReminderSections()}
            {!isDesktop && renderParticipantsSection()}
          </View>

          {isDesktop && (
            <View style={[styles.splitRight, { borderColor: textSecondaryColor + '20' }]}>
              {selectedDay !== null ? (
                <DayDetailPane 
                  eventId={event.id} 
                  day={selectedDay} 
                  onClose={() => setSelectedDay(null)} 
                  onUpdate={() => loadEvent()}
                />
              ) : selectedParticipantId !== null ? (
                <ParticipantDetailPane
                  eventId={event.id}
                  participantId={selectedParticipantId}
                  onClose={() => setSelectedParticipantId(null)}
                  onEventUpdated={updateEvent}
                />
              ) : (
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 24, paddingTop: 0 }}>
                  {renderParticipantsSection()}
                </ScrollView>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={showDeleteConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteConfirm(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowDeleteConfirm(false)}
        >
          <Pressable
            style={[styles.confirmDialog, { backgroundColor }]}
            onPress={(e) => e.stopPropagation()}
          >
            <ThemedText type="subtitle" style={styles.confirmTitle}>
              Delete Event
            </ThemedText>
            <ThemedText style={[styles.confirmMessage, { color: textSecondaryColor }]}>
              Are you sure you want to delete this event? This action cannot be undone.
            </ThemedText>
            <View style={styles.confirmActions}>
              <Pressable
                style={[styles.confirmButton, { backgroundColor: surfaceColor }]}
                onPress={() => setShowDeleteConfirm(false)}
              >
                <ThemedText style={styles.confirmButtonText}>Cancel</ThemedText>
              </Pressable>
              <Pressable
                style={[styles.confirmButton, { backgroundColor: errorColor }]}
                onPress={confirmDelete}
              >
                <ThemedText style={[styles.confirmButtonText, { color: '#FFFFFF' }]}>Delete</ThemedText>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ThemedView>
    </DesktopLayout>
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
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  nameInput: {
    flex: 1,
    fontSize: 20,
    lineHeight: 28,
    fontWeight: 'bold',
    marginHorizontal: 8,
  },
  nameButton: {
    flex: 1,
    marginHorizontal: 8,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  monthHeader: {
    marginBottom: 16,
    alignItems: 'center',
  },
  section: {
    marginTop: 32,
  },
  sectionTitle: {
    marginBottom: 16,
    fontSize: 20,
    lineHeight: 28,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  reminderCard: {
    borderRadius: 16,
    padding: 16,
  },
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reminderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  reminderButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  reminderHint: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 12,
  },
  participantCount: {
    fontSize: 16,
    lineHeight: 24,
  },
  emptyParticipants: {
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyMeetingDetails: {
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    marginTop: 8,
  },
  emptyText: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  participantsList: {
    gap: 8,
    marginBottom: 16,
  },
  participantCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
  },
  participantInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  participantNameContainer: {
    flex: 1,
  },
  participantNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  participantName: {
    fontSize: 15,
    lineHeight: 22,
  },
  sourceBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  participantNotes: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    minHeight: 48,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 4,
  },
  actionButton: {
    padding: 8,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  participantPhone: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  participantEmail: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  participantActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quickActionButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fixedDateCard: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 24,
  },
  fixedDateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  fixedTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    marginLeft: 36,
  },
  rsvpSummaryCard: {
    padding: 20,
    borderRadius: 16,
  },
  rsvpSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  rsvpSummaryItem: {
    alignItems: 'center',
    gap: 4,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  rsvpSummaryCount: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: '700',
  },
  rsvpSummaryLabel: {
    fontSize: 13,
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  menuContainer: {
    borderRadius: 16,
    minWidth: 280,
    maxWidth: 400,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  menuItem: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  menuItemText: {
    fontSize: 16,
    lineHeight: 24,
  },
  confirmDialog: {
    borderRadius: 16,
    padding: 24,
    minWidth: 300,
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  confirmTitle: {
    marginBottom: 12,
  },
  confirmMessage: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 24,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 12,
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  confirmButtonText: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
  },
  directionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  splitContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 24,
  },
  splitLeft: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    borderRadius: 16,
    padding: 16,
  },
  splitRight: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    height: '100%',
    minHeight: 600,
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
});
