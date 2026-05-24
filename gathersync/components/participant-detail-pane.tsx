import React, { useState, useEffect, useRef } from 'react';
import { Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, Switch, TextInput, View, KeyboardAvoidingView } from 'react-native';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { eventsLocalStorage } from '@/lib/local-storage';
import { eventsCloudStorage } from '@/lib/cloud-storage';
import { useAuth } from '@/hooks/use-auth';
import {
  getDaysInMonth,
  getFirstDayOfMonth,
  formatDate,
} from '@/lib/calendar-utils';
import type { Event, Participant } from '@/types/models';
import { useAutoSync } from '@/hooks/use-auto-sync';

interface ParticipantDetailPaneProps {
  eventId: string;
  participantId: string;
  onClose?: () => void;
  onEventUpdated?: (event: Event) => void;
}

export function ParticipantDetailPane({ eventId, participantId, onClose, onEventUpdated }: ParticipantDetailPaneProps) {
  const colorScheme = useColorScheme();
  const { updateEvent } = useAutoSync();
  const { isAuthenticated } = useAuth();

  const [event, setEvent] = useState<Event | null>(null);
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [unavailableAllMonth, setUnavailableAllMonth] = useState(false);
  const [notes, setNotes] = useState('');
  const [name, setName] = useState('');
  const [originalName, setOriginalName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [designation, setDesignation] = useState('');
  const [organization, setOrganization] = useState('');
  const [leadSource, setLeadSource] = useState('');
  const [digitalTwinUrl, setDigitalTwinUrl] = useState('');
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
    if (!loadedParticipant) {
      if (onClose) onClose();
      return;
    }

    // Enrich missing contact details from other events
    try {
      const allEvents = await eventsLocalStorage.getAll();
      let globalPhone = loadedParticipant.phone;
      let globalEmail = loadedParticipant.email;
      
      if (!globalPhone || !globalEmail) {
        for (const e of allEvents) {
          const p = e.participants.find(p => p.name === loadedParticipant.name);
          if (p) {
            if (!globalPhone && p.phone) globalPhone = p.phone;
            if (!globalEmail && p.email) globalEmail = p.email;
          }
          if (globalPhone && globalEmail) break;
        }
      }

      // Update the reference so the enriched data is visible and gets saved
      if (globalPhone && !loadedParticipant.phone) loadedParticipant.phone = globalPhone;
      if (globalEmail && !loadedParticipant.email) loadedParticipant.email = globalEmail;
    } catch (err) {
      console.error('Failed to enrich participant:', err);
    }

    setEvent(loadedEvent);
    setParticipant(loadedParticipant);
    setUnavailableAllMonth(loadedParticipant.unavailableAllMonth);
    setNotes(loadedParticipant.notes || '');
    setName(loadedParticipant.name || '');
    setOriginalName(loadedParticipant.name || '');
    setPhone(loadedParticipant.phone || '');
    setEmail(loadedParticipant.email || '');
    setDesignation(loadedParticipant.designation || '');
    setOrganization(loadedParticipant.organization || '');
    setLeadSource(loadedParticipant.leadSource || '');
    setDigitalTwinUrl(loadedParticipant.digitalTwinUrl || '');
  };

  const handleDayPress = (day: number) => {
    if (!event || !participant) return;

    const dateStr = formatDate(event.year, event.month, day);
    const hasStatus = dateStr in participant.availability;
    const currentStatus = participant.availability[dateStr];
    
    // Toggle: undefined -> true (Available), true -> false (Unavailable), false -> undefined (No Response)
    if (!hasStatus) {
      participant.availability[dateStr] = true;
    } else if (currentStatus === true) {
      participant.availability[dateStr] = false;
    } else {
      delete participant.availability[dateStr];
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    saveChanges();
  };

  const handleSelectWeekends = (available: boolean) => {
    if (!event || !participant) return;

    const daysInMonth = getDaysInMonth(event.year, event.month);
    const firstDay = getFirstDayOfMonth(event.year, event.month);

    for (let day = 1; day <= daysInMonth; day++) {
      const dayOfWeek = (firstDay + day - 1) % 7;
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        const dateStr = formatDate(event.year, event.month, day);
        participant.availability[dateStr] = available;
      }
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    saveChanges();
  };

  const handleUnavailableToggle = (value: boolean) => {
    if (!participant) return;

    setUnavailableAllMonth(value);
    participant.unavailableAllMonth = value;
    
    if (value) {
      participant.availability = {};
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    saveChanges();
  };

  const handleRsvpChange = (status: 'attending' | 'not-attending' | 'no-response') => {
    if (!participant) return;

    participant.rsvpStatus = status;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    saveChanges();
  };

  const handleDeleteParticipant = async () => {
    if (!event || !participantId) return;

    if (Platform.OS === 'web') {
      if (window.confirm(`Are you sure you want to remove ${participant?.name} from this event?`)) {
        const updatedEvent = { ...event };
        updatedEvent.participants = updatedEvent.participants.map(p => 
          p.id === participantId 
            ? { ...p, deletedAt: new Date().toISOString() }
            : p
        );
        updatedEvent.updatedAt = new Date().toISOString();
        await eventsLocalStorage.update(eventId, updatedEvent);
        if (onEventUpdated) onEventUpdated(updatedEvent);
        if (onClose) onClose();
      }
      return;
    }

    Alert.alert(
      'Remove Participant',
      `Are you sure you want to remove ${participant?.name} from this event?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const updatedEvent = { ...event };
            updatedEvent.participants = updatedEvent.participants.map(p => 
              p.id === participantId 
                ? { ...p, deletedAt: new Date().toISOString() }
                : p
            );
            updatedEvent.updatedAt = new Date().toISOString();
            await eventsLocalStorage.update(eventId, updatedEvent);
            if (onEventUpdated) onEventUpdated(updatedEvent);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            if (onClose) onClose();
          },
        },
      ]
    );
  };

  const handleNotesChange = (text: string) => {
    setNotes(text);
    if (participant) {
      participant.notes = text;
    }
  };

  const handleNameChange = (text: string) => {
    setName(text);
    if (participant) {
      participant.name = text;
    }
  };

  const handlePhoneChange = (text: string) => {
    setPhone(text);
    if (participant) {
      participant.phone = text || undefined;
    }
  };

  const handleEmailChange = (text: string) => {
    setEmail(text);
    if (participant) {
      participant.email = text || undefined;
    }
  };

  const handleDesignationChange = (text: string) => {
    setDesignation(text);
    if (participant) {
      participant.designation = text || undefined;
    }
  };

  const handleOrganizationChange = (text: string) => {
    setOrganization(text);
    if (participant) {
      participant.organization = text || undefined;
    }
  };

  const handleLeadSourceChange = (text: string) => {
    setLeadSource(text);
    if (participant) {
      participant.leadSource = text || undefined;
    }
  };

  const handleDigitalTwinUrlChange = (text: string) => {
    setDigitalTwinUrl(text);
    if (participant) {
      participant.digitalTwinUrl = text || undefined;
    }
  };

  const saveChanges = async (syncGlobally = false) => {
    if (!event || !participant) return;

    const updatedParticipants = event.participants.map((p) =>
      p.id === participant.id
        ? {
            ...p,
            name: name.trim() || p.name,
            phone: phone.trim() || undefined,
            email: email.trim() || undefined,
            designation: designation.trim() || undefined,
            organization: organization.trim() || undefined,
            leadSource: leadSource.trim() || undefined,
            digitalTwinUrl: digitalTwinUrl.trim() || undefined,
            notes: notes.trim() || undefined,
            unavailableAllMonth,
            availability: participant.availability,
            rsvpStatus: participant.rsvpStatus,
          }
        : p
    );
    const updatedParticipant = updatedParticipants.find((p) => p.id === participant.id)!;

    const updatedEvent = {
      ...event,
      participants: updatedParticipants,
      updatedAt: new Date().toISOString(),
    };

    setEvent(updatedEvent);
    setParticipant(updatedParticipant);
    
    await eventsLocalStorage.update(eventId, updatedEvent);
    if (onEventUpdated) onEventUpdated(updatedEvent);
    
    // Sync globally if requested
    const eventsToSyncToCloud = [updatedEvent];
    
    if (syncGlobally && originalName) {
      try {
        const allEvents = await eventsLocalStorage.getAll();
        for (const e of allEvents) {
          if (e.id === eventId) continue; // Already updated above
          
          const participantIndex = e.participants.findIndex(p => p.name === originalName);
          if (participantIndex !== -1) {
            e.participants[participantIndex] = {
              ...e.participants[participantIndex],
              name: updatedParticipant.name,
              phone: updatedParticipant.phone,
              email: updatedParticipant.email,
              designation: updatedParticipant.designation,
              organization: updatedParticipant.organization,
              leadSource: updatedParticipant.leadSource,
              digitalTwinUrl: updatedParticipant.digitalTwinUrl,
            };
            await eventsLocalStorage.update(e.id, e);
            eventsToSyncToCloud.push(e);
          }
        }
        setOriginalName(participant?.name || name); // update the reference
      } catch (err) {
        console.error('Failed to sync participant details globally:', err);
      }
    }
    
    if (isSavingRef.current) {
      pendingSaveRef.current = true;
      return;
    }

    
    isSavingRef.current = true;
    
    if (isAuthenticated) {
      try {
        // Sync all modified events to cloud
        await Promise.all(
          eventsToSyncToCloud.map(e => eventsCloudStorage.update(e.id, e))
        );
      } catch (error) {
        console.error('[EditAvailability] Failed to push to cloud:', error);
      }
    }
    
    isSavingRef.current = false;
    
    if (pendingSaveRef.current) {
      pendingSaveRef.current = false;
      saveChanges(syncGlobally);
    }
  };

  const handleManualSave = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    // Save local changes and sync globally
    await saveChanges(true);

    if (Platform.OS === 'web') {
      alert('Edits saved successfully!');
    } else {
      Alert.alert('Success', 'Edits saved successfully!');
    }
  };

  if (!event || !participant) {
    return (
      <View style={[styles.container, { backgroundColor }]}>
        <ThemedText>Loading...</ThemedText>
      </View>
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
      <View style={[styles.container, { backgroundColor }]}>
        {onClose && (
          <View style={styles.header}>
            <Pressable onPress={onClose} hitSlop={8}>
              <IconSymbol name="xmark" size={24} color={tintColor} />
            </Pressable>
            <ThemedText type="subtitle" numberOfLines={1} style={styles.headerTitle}>
              {name || participant.name}
            </ThemedText>
            <Pressable onPress={handleDeleteParticipant} hitSlop={8}>
              <IconSymbol name="trash.fill" size={24} color={errorColor} />
            </Pressable>
          </View>
        )}

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled"
        >
          {/* RSVP for All Events */}
          <View style={[styles.rsvpCard, { backgroundColor: surfaceColor }]}>
            <ThemedText type="defaultSemiBold" style={styles.rsvpTitle}>
              RSVP Status
            </ThemedText>
            {event.eventType === 'fixed' && (
              <ThemedText style={[styles.rsvpSubtitle, { color: textSecondaryColor }]}>
                {event.fixedDate && new Date(event.fixedDate + 'T00:00:00').toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
                {event.fixedTime && ` at ${event.fixedTime}`}
              </ThemedText>
            )}
              <View style={styles.rsvpButtons}>
                <Pressable
                  style={[
                    styles.rsvpButton,
                    participant.rsvpStatus === 'attending' && { backgroundColor: '#10B981', borderColor: '#10B981' },
                    participant.rsvpStatus !== 'attending' && { backgroundColor: surfaceColor, borderWidth: 1, borderColor: '#10B981' },
                  ]}
                  onPress={() => handleRsvpChange('attending')}
                >
                  <IconSymbol 
                    name="checkmark.circle.fill" 
                    size={20} 
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
                    participant.rsvpStatus === 'not-attending' && { backgroundColor: '#EF4444', borderColor: '#EF4444' },
                    participant.rsvpStatus !== 'not-attending' && { backgroundColor: surfaceColor, borderWidth: 1, borderColor: '#EF4444' },
                  ]}
                  onPress={() => handleRsvpChange('not-attending')}
                >
                  <IconSymbol 
                    name="xmark.circle.fill" 
                    size={20} 
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
                <Pressable
                  style={[
                    styles.rsvpButton,
                    (!participant.rsvpStatus || participant.rsvpStatus === 'no-response') && { backgroundColor: '#64748B', borderColor: '#64748B' },
                    (participant.rsvpStatus && participant.rsvpStatus !== 'no-response') && { backgroundColor: surfaceColor, borderWidth: 1, borderColor: '#64748B' },
                  ]}
                  onPress={() => handleRsvpChange('no-response')}
                >
                  <IconSymbol 
                    name="questionmark.circle.fill" 
                    size={20} 
                    color={(!participant.rsvpStatus || participant.rsvpStatus === 'no-response') ? '#FFFFFF' : '#64748B'} 
                  />
                  <ThemedText 
                    style={[
                      styles.rsvpButtonText,
                      { color: (!participant.rsvpStatus || participant.rsvpStatus === 'no-response') ? '#FFFFFF' : '#64748B' },
                    ]}
                  >
                    No Response
                  </ThemedText>
                </Pressable>
              </View>
            </View>

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
            
            <View style={{ marginBottom: 12 }}>
              <ThemedText style={[styles.fieldLabel, { color: textSecondaryColor }]}>
                Name
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
                value={name}
                onChangeText={handleNameChange}
                onBlur={() => saveChanges(false)}
                placeholder="Participant Name"
                placeholderTextColor={textSecondaryColor}
                autoCapitalize="words"
              />
            </View>

            <View style={{ marginBottom: 12 }}>
              <ThemedText style={[styles.fieldLabel, { color: textSecondaryColor }]}>
                Title or Designation
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
                value={designation}
                onChangeText={handleDesignationChange}
                onBlur={() => saveChanges(false)}
                placeholder="e.g. Director, Treasurer, VIP"
                placeholderTextColor={textSecondaryColor}
                autoCapitalize="words"
              />
            </View>

            <View style={{ marginBottom: 12 }}>
              <ThemedText style={[styles.fieldLabel, { color: textSecondaryColor }]}>
                Company or Organization
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
                value={organization}
                onChangeText={handleOrganizationChange}
                onBlur={() => saveChanges(false)}
                placeholder="e.g. Acme Corp, GatherSync"
                placeholderTextColor={textSecondaryColor}
                autoCapitalize="words"
              />
            </View>

            <View style={{ marginBottom: 12 }}>
              <ThemedText style={[styles.fieldLabel, { color: textSecondaryColor }]}>
                Lead Source
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
                value={leadSource}
                onChangeText={handleLeadSourceChange}
                onBlur={() => saveChanges(false)}
                placeholder="e.g. Letterbox, Trade Show, Referral"
                placeholderTextColor={textSecondaryColor}
                autoCapitalize="words"
              />
            </View>

            <View style={{ marginBottom: 12 }}>
              <ThemedText style={[styles.fieldLabel, { color: textSecondaryColor }]}>
                Digital Twin URL
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
                value={digitalTwinUrl}
                onChangeText={handleDigitalTwinUrlChange}
                onBlur={() => saveChanges(false)}
                placeholder="https://getbizcard.com/your-name"
                placeholderTextColor={textSecondaryColor}
                keyboardType="url"
                autoCapitalize="none"
              />
              <ThemedText style={{ fontSize: 12, color: textSecondaryColor, marginTop: 6, lineHeight: 17 }}>
                Opens from the person icon next to phone in the participant list. Host profiles also appear on the public RSVP page when the team leader has a link.
              </ThemedText>
              {digitalTwinUrl.trim() ? (
                <Pressable
                  onPress={() => Linking.openURL(digitalTwinUrl.trim())}
                  style={{ marginTop: 8 }}
                >
                  <ThemedText style={{ color: tintColor, fontWeight: '600', fontSize: 14 }}>
                    Open Digital Twin ↗
                  </ThemedText>
                </Pressable>
              ) : null}
            </View>

            <View style={styles.inputRow}>
              <View style={{ flex: 1 }}>
                <ThemedText style={[styles.fieldLabel, { color: textSecondaryColor }]}>
                  Phone
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
                  onBlur={() => saveChanges(false)}
                  placeholder="+1 234 567 8900"
                  placeholderTextColor={textSecondaryColor}
                  keyboardType="phone-pad"
                />
              </View>
              
              <View style={{ flex: 1 }}>
                <ThemedText style={[styles.fieldLabel, { color: textSecondaryColor }]}>
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
                  onBlur={() => saveChanges(false)}
                  placeholder="john@example.com"
                  placeholderTextColor={textSecondaryColor}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
            </View>
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
              onBlur={() => saveChanges(false)}
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
                  • Green = Available, Red = Not Available, Gray = No Response
                </ThemedText>
              </View>

              {/* Calendar */}
              <View style={[styles.calendar, { backgroundColor: surfaceColor }]}>
                <View style={styles.weekDaysRow}>
                  {weekDays.map((day, index) => (
                    <View key={index} style={styles.weekDayCell}>
                      <ThemedText style={[styles.weekDayText, { color: textSecondaryColor }]}>
                        {day}
                      </ThemedText>
                    </View>
                  ))}
                </View>

                <View style={styles.grid}>
                  {calendarDays.map((day, index) => {
                    if (day === null) {
                      return <View key={`empty-${index}`} style={styles.dayCell} />;
                    }

                    const dateStr = formatDate(event.year, event.month, day);
                    const hasStatus = dateStr in participant.availability;
                    const isAvailable = participant.availability[dateStr] === true;
                    const isUnavailable = hasStatus && participant.availability[dateStr] === false;

                    return (
                      <Pressable
                        key={`day-${day}`}
                        style={[
                          styles.dayCell,
                          {
                            backgroundColor: isAvailable 
                              ? successColor 
                              : isUnavailable
                                ? errorColor
                                : colorScheme === 'light' ? '#F1F5F9' : '#1E293B',
                          },
                        ]}
                        onPress={() => handleDayPress(day)}
                      >
                        <ThemedText
                          style={[
                            styles.dayText,
                            { color: hasStatus ? '#FFFFFF' : textColor },
                          ]}
                        >
                          {day}
                        </ThemedText>
                        {isAvailable && (
                          <IconSymbol name="checkmark" size={12} color="#FFFFFF" />
                        )}
                        {isUnavailable && (
                          <IconSymbol name="xmark" size={12} color="#FFFFFF" />
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </>
          )}

          {/* Save Button */}
          <View style={styles.saveContainer}>
            <Pressable
              style={[styles.saveButton, { backgroundColor: tintColor }]}
              onPress={handleManualSave}
            >
              <IconSymbol name="checkmark.circle.fill" size={20} color="#FFFFFF" />
              <ThemedText style={styles.saveButtonText}>Save Changes</ThemedText>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
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
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  toggleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleText: {
    flex: 1,
    marginRight: 12,
  },
  toggleHint: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  contactCard: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  contactTitle: {
    marginBottom: 8,
    fontSize: 14,
    lineHeight: 20,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  fieldLabel: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 4,
    fontWeight: '500',
  },
  contactInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    lineHeight: 20,
  },
  notesCard: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  notesTitle: {
    marginBottom: 8,
    fontSize: 14,
    lineHeight: 20,
  },
  notesInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    lineHeight: 20,
    minHeight: 60,
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
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  rsvpTitle: {
    marginBottom: 4,
    fontSize: 14,
  },
  rsvpSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  rsvpButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  rsvpButton: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  rsvpButtonText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  saveContainer: {
    marginTop: 8,
    paddingBottom: 24,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});