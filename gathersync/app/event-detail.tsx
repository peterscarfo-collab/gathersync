import { useState, useCallback } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, TextInput, View, Share, Linking, Modal } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { DesktopLayout } from '@/components/desktop-layout';
import { CalendarGrid } from '@/components/calendar-grid';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAutoSync } from '@/hooks/use-auto-sync';
import { eventsLocalStorage as eventsLocalStorage, snapshotsLocalStorage as snapshotsLocalStorage } from '@/lib/local-storage';
import { getMonthName, generateId, getBestDays } from '@/lib/calendar-utils';
import { exportToCalendar } from '@/lib/calendar-export';
import { getParticipantStatus, getStatusBadge } from '@/lib/participant-status';
import type { Event, Participant } from '@/types/models';

export default function EventDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const { updateEvent: autoUpdateEvent } = useAutoSync();

  const [event, setEvent] = useState<Event | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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
      setEvent(loadedEvent);
      setEditedName(loadedEvent.name);
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
  };

  const handleSaveName = async () => {
    if (!event || !editedName.trim()) return;
    await updateEvent({ ...event, name: editedName.trim() });
    setIsEditingName(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleDayPress = (day: number) => {
    if (!event) return;
    router.push({
      pathname: '/day-detail' as any,
      params: { eventId: event.id, day: day.toString() },
    });
  };

  const handleAddParticipant = () => {
    if (!event) return;
    router.push({
      pathname: '/add-participant' as any,
      params: { eventId: event.id },
    });
  };

  const handleParticipantPress = (participant: Participant) => {
    if (!event) return;
    router.push({
      pathname: '/edit-availability' as any,
      params: { eventId: event.id, participantId: participant.id },
    });
  };

  const handleShareEvent = async () => {
    if (!event) return;

    const bestDays = getBestDays(event);
    const bestDayText = bestDays.length > 0
      ? `Best day: ${bestDays[0].date} (${bestDays[0].availableCount} available)`
      : 'No availability data yet';

    // Create web link for event viewing and RSVP
    const webUrl = `https://8081-ienb1rj930k0x92csc3x6-a41ba8ee.manus-asia.computer/public-event?eventId=${event.id}`;

    const message = `📅 ${event.name}\n${getMonthName(event.month)} ${event.year}\n\n${bestDayText}\n\nView and RSVP:\n${webUrl}`;

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
    const webUrl = `https://8081-ienb1rj930k0x92csc3x6-a41ba8ee.manus-asia.computer/public-event?eventId=${event.id}`;

    const message = `📅 ${event.name}\n\n${eventType}${bestDayText}${meetingDetails.length > 0 ? '\n\n' + meetingDetails.join('\n') : ''}\n\nView and RSVP:\n${webUrl}`;

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
      const webUrl = `https://8081-ienb1rj930k0x92csc3x6-a41ba8ee.manus-asia.computer/public-event?eventId=${event.id}&name=${encodeURIComponent(participant.name)}`;
      
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

    const bestDays = getBestDays(event);
    const bestDayText = bestDays.length > 0
      ? `Best day: ${bestDays[0].date} (${bestDays[0].availableCount} available)`
      : 'No availability data yet';

    const eventType = event.eventType === 'fixed' 
      ? `Fixed Event: ${event.fixedDate}${event.fixedTime ? ' at ' + event.fixedTime : ''}`
      : `Flexible Event: ${getMonthName(event.month)} ${event.year}`;

    const participantsList = event.participants
      .map(p => `  • ${p.name}${p.email ? ' (' + p.email + ')' : ''}${p.phone ? ' - ' + p.phone : ''}`)
      .join('\n');

    const details = `📅 ${event.name}\n\n${eventType}\n\n${bestDayText}\n\nParticipants (${event.participants.length}):\n${participantsList || '  No participants yet'}`;

    try {
      await Clipboard.setStringAsync(details);
      if (Platform.OS === 'web') {
        alert('Event details copied to clipboard!');
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('Error copying:', error);
    }
  };

  const handleEmailParticipants = () => {
    if (!event) return;

    router.push({
      pathname: '/email-participants' as any,
      params: { eventId: event.id },
    });
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
    await eventsLocalStorage.delete(eventId!);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  if (!event) {
    return (
      <ThemedView style={[styles.container, { backgroundColor }]}>
        <ThemedText>Loading...</ThemedText>
      </ThemedView>
    );
  }

  return (
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
          {/* Share Button */}
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              handleShareEvent();
            }}
            hitSlop={8}
          >
            <IconSymbol name="square.and.arrow.up" size={24} color={tintColor} />
          </Pressable>
          
          {/* Forward Button */}
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              handleForwardEvent();
            }}
            hitSlop={8}
          >
            <IconSymbol name="paperplane.fill" size={24} color={tintColor} />
          </Pressable>
          
          {/* Menu Button */}
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowMenu(true);
            }}
            hitSlop={8}
          >
            <IconSymbol name="ellipsis.circle" size={28} color={tintColor} />
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
            <View style={[styles.menuContainer, { backgroundColor: surfaceColor }]}>
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
                  handleExportToCalendar();
                }}
              >
                <ThemedText style={styles.menuItemText}>Export to Calendar</ThemedText>
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
                  handleCopyEvent();
                }}
              >
                <ThemedText style={styles.menuItemText}>Copy Event</ThemedText>
              </Pressable>
              
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
                  handleCopyEventDetails();
                }}
              >
                <ThemedText style={styles.menuItemText}>Copy Event Details</ThemedText>
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
                style={[styles.menuItem, { borderBottomColor: textSecondaryColor + '20' }]}
                onPress={() => {
                  setShowMenu(false);
                  handleDeleteEvent();
                }}
              >
                <ThemedText style={[styles.menuItemText, { color: '#FF3B30' }]}>Delete Event</ThemedText>
              </Pressable>
              
              <Pressable
                style={styles.menuItem}
                onPress={() => setShowMenu(false)}
              >
                <ThemedText style={[styles.menuItemText, { fontWeight: '600' }]}>Cancel</ThemedText>
              </Pressable>
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
        {/* Fixed Event Date & RSVP Summary */}
        {event.eventType === 'fixed' && event.fixedDate ? (
          <>
            <View style={[styles.fixedDateCard, { backgroundColor: surfaceColor }]}>
              <View style={styles.fixedDateHeader}>
                <IconSymbol name="calendar" size={24} color={tintColor} />
                <ThemedText type="subtitle">
                  {new Date(event.fixedDate + 'T00:00:00').toLocaleDateString('en-US', {
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
                    {event.fixedTime}
                  </ThemedText>
                </View>
              )}
            </View>

            {/* RSVP Summary */}
            <View style={styles.section}>
              <ThemedText type="subtitle" style={styles.sectionTitle}>RSVP Summary</ThemedText>
              <View style={[styles.rsvpSummaryCard, { backgroundColor: surfaceColor }]}>
                <View style={styles.rsvpSummaryRow}>
                  <View style={styles.rsvpSummaryItem}>
                    <ThemedText style={[styles.rsvpSummaryCount, { color: successColor }]}>
                      {event.participants.filter(p => p.rsvpStatus === 'attending').length}
                    </ThemedText>
                    <ThemedText style={[styles.rsvpSummaryLabel, { color: textSecondaryColor }]}>
                      Attending
                    </ThemedText>
                  </View>
                  <View style={styles.rsvpSummaryItem}>
                    <ThemedText style={[styles.rsvpSummaryCount, { color: errorColor }]}>
                      {event.participants.filter(p => p.rsvpStatus === 'not-attending').length}
                    </ThemedText>
                    <ThemedText style={[styles.rsvpSummaryLabel, { color: textSecondaryColor }]}>
                      Not Attending
                    </ThemedText>
                  </View>
                  <View style={styles.rsvpSummaryItem}>
                    <ThemedText style={[styles.rsvpSummaryCount, { color: textSecondaryColor }]}>
                      {event.participants.filter(p => !p.rsvpStatus || p.rsvpStatus === 'no-response').length}
                    </ThemedText>
                    <ThemedText style={[styles.rsvpSummaryLabel, { color: textSecondaryColor }]}>
                      No Response
                    </ThemedText>
                  </View>
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

        {/* Reminder Section */}
        <View style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>Reminder</ThemedText>
          <View style={[styles.reminderCard, { backgroundColor: surfaceColor }]}>
            <View style={styles.reminderRow}>
              <ThemedText type="defaultSemiBold">Set Reminder</ThemedText>
              <Pressable
                style={[styles.reminderButton, { backgroundColor: tintColor }]}
                onPress={() => {
                  Alert.alert(
                    'Set Reminder',
                    'How many days before the best day should we remind you?',
                    [
                      {
                        text: '1 day before',
                        onPress: async () => {
                          await updateEvent({ ...event, reminderDaysBefore: 1 });
                          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                          Alert.alert('Reminder Set', 'You\'ll be notified 1 day before the best available day.');
                        },
                      },
                      {
                        text: '3 days before',
                        onPress: async () => {
                          await updateEvent({ ...event, reminderDaysBefore: 3 });
                          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                          Alert.alert('Reminder Set', 'You\'ll be notified 3 days before the best available day.');
                        },
                      },
                      {
                        text: '7 days before',
                        onPress: async () => {
                          await updateEvent({ ...event, reminderDaysBefore: 7 });
                          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                          Alert.alert('Reminder Set', 'You\'ll be notified 7 days before the best available day.');
                        },
                      },
                      { text: 'Cancel', style: 'cancel' },
                    ]
                  );
                }}
              >
                <IconSymbol name="bell.fill" size={16} color="#FFFFFF" />
                <ThemedText style={styles.reminderButtonText}>
                  {event.reminderDaysBefore
                    ? `${event.reminderDaysBefore} day${event.reminderDaysBefore > 1 ? 's' : ''} before`
                    : 'Set Reminder'}
                </ThemedText>
              </Pressable>
            </View>
            {event.reminderDaysBefore && (
              <ThemedText style={[styles.reminderHint, { color: textSecondaryColor }]}>
                You'll receive a notification {event.reminderDaysBefore} day{event.reminderDaysBefore > 1 ? 's' : ''} before the best available day
              </ThemedText>
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

        {/* Participants Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText type="subtitle">Participants</ThemedText>
            <ThemedText style={[styles.participantCount, { color: textSecondaryColor }]}>
              {event.participants.length}
            </ThemedText>
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
              {event.participants.filter(p => !p.deletedAt).map((participant) => (
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
                      {participant.phone && (
                        <ThemedText style={[styles.participantPhone, { color: textSecondaryColor }]}>
                          {participant.phone}
                        </ThemedText>
                      )}
                    </View>
                    <View style={styles.participantActions}>
                      {participant.phone && (
                        <>
                          <Pressable
                            style={[styles.quickActionButton, { backgroundColor: tintColor }]}
                            onPress={() => {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                              Linking.openURL(`tel:${participant.phone}`);
                            }}
                            hitSlop={4}
                          >
                            <IconSymbol name="phone.fill" size={14} color="#fff" />
                          </Pressable>
                          <Pressable
                            style={[styles.quickActionButton, { backgroundColor: tintColor }]}
                            onPress={() => {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                              Linking.openURL(`sms:${participant.phone}`);
                            }}
                            hitSlop={4}
                          >
                            <IconSymbol name="message.fill" size={14} color="#fff" />
                          </Pressable>
                        </>
                      )}
                      <View style={[styles.statusBadge, { backgroundColor: getStatusBadge(getParticipantStatus(participant, event)).color + '20' }]}>
                        <ThemedText style={[styles.statusBadgeText, { color: getStatusBadge(getParticipantStatus(participant, event)).color }]}>
                          {getStatusBadge(getParticipantStatus(participant, event)).icon}
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
    padding: 16,
    borderRadius: 12,
  },
  participantInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
    fontSize: 16,
    lineHeight: 24,
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
});
