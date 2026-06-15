import { useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuth } from '@/hooks/use-auth';
import { generateId } from '@/lib/calendar-utils';
import {
  formatConferenceDate,
  formatTime12h,
  getConferenceDayList,
  sortSessions,
  validateSession,
} from '@/lib/conference-utils';
import { eventsLocalStorage } from '@/lib/local-storage';
import { sessionsCloudStorage } from '@/lib/cloud-storage';
import type { ConferenceSession, Event } from '@/types/models';

type SessionDraft = {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  room: string;
  speaker: string;
  description: string;
  capacity: string;
};

const emptyDraft = (defaultDate: string): SessionDraft => ({
  title: '',
  date: defaultDate,
  startTime: '09:00',
  endTime: '10:00',
  room: '',
  speaker: '',
  description: '',
  capacity: '',
});

interface ConferenceSessionsPanelProps {
  event: Event;
  onEventUpdated: (event: Event) => void;
}

export function ConferenceSessionsPanel({ event, onEventUpdated }: ConferenceSessionsPanelProps) {
  const { isAuthenticated } = useAuth();
  const tintColor = useThemeColor({}, 'tint');
  const surfaceColor = useThemeColor({}, 'surface');
  const textColor = useThemeColor({}, 'text');
  const textSecondaryColor = useThemeColor({}, 'textSecondary');
  const backgroundColor = useThemeColor({}, 'background');

  const conferenceDays = useMemo(() => {
    if (!event.startDate || !event.endDate) return [];
    return getConferenceDayList(event.startDate, event.endDate);
  }, [event.startDate, event.endDate]);

  const sessions = useMemo(
    () => sortSessions(event.sessions ?? []),
    [event.sessions],
  );

  const [modalVisible, setModalVisible] = useState(false);
  const [editingSession, setEditingSession] = useState<ConferenceSession | null>(null);
  const [draft, setDraft] = useState<SessionDraft>(emptyDraft(conferenceDays[0] ?? ''));

  const openAddModal = () => {
    setEditingSession(null);
    setDraft(emptyDraft(conferenceDays[0] ?? ''));
    setModalVisible(true);
  };

  const openEditModal = (session: ConferenceSession) => {
    setEditingSession(session);
    setDraft({
      title: session.title,
      date: session.date,
      startTime: session.startTime,
      endTime: session.endTime,
      room: session.room ?? '',
      speaker: session.speaker ?? '',
      description: session.description ?? '',
      capacity: session.capacity != null ? String(session.capacity) : '',
    });
    setModalVisible(true);
  };

  const persistEvent = async (updatedEvent: Event) => {
    await eventsLocalStorage.update(updatedEvent.id, updatedEvent);
    onEventUpdated(updatedEvent);
  };

  const handleSaveSession = async () => {
    const capacity = draft.capacity.trim() ? parseInt(draft.capacity, 10) : undefined;
    const base = {
      title: draft.title.trim(),
      date: draft.date,
      startTime: draft.startTime,
      endTime: draft.endTime,
      room: draft.room.trim() || undefined,
      speaker: draft.speaker.trim() || undefined,
      description: draft.description.trim() || undefined,
      capacity: Number.isFinite(capacity) ? capacity : undefined,
    };

    const validationError = validateSession(base, event);
    if (validationError) {
      Alert.alert('Session', validationError);
      return;
    }

    const now = new Date().toISOString();

    if (editingSession) {
      const updated: ConferenceSession = {
        ...editingSession,
        ...base,
        updatedAt: now,
      };
      const nextSessions = (event.sessions ?? []).map((s) =>
        s.id === editingSession.id ? updated : s,
      );
      const updatedEvent: Event = { ...event, sessions: nextSessions, updatedAt: now };
      await persistEvent(updatedEvent);
      if (isAuthenticated) {
        try {
          await sessionsCloudStorage.update(updated);
        } catch (error) {
          console.error('[Sessions] Cloud update failed:', error);
        }
      }
    } else {
      const created: ConferenceSession = {
        id: generateId(),
        eventId: event.id,
        ...base,
        sortOrder: sessions.length,
        createdAt: now,
        updatedAt: now,
      };
      const nextSessions = [...(event.sessions ?? []), created];
      const updatedEvent: Event = { ...event, sessions: nextSessions, updatedAt: now };
      await persistEvent(updatedEvent);
      if (isAuthenticated) {
        try {
          await sessionsCloudStorage.create(created);
        } catch (error) {
          console.error('[Sessions] Cloud create failed:', error);
        }
      }
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setModalVisible(false);
  };

  const handleDeleteSession = (session: ConferenceSession) => {
    const confirm = () => {
      void (async () => {
        const now = new Date().toISOString();
        const nextSessions = (event.sessions ?? []).map((s) =>
          s.id === session.id ? { ...s, deletedAt: now } : s,
        );
        const updatedEvent: Event = { ...event, sessions: nextSessions, updatedAt: now };
        await persistEvent(updatedEvent);
        if (isAuthenticated) {
          try {
            await sessionsCloudStorage.delete(session.id, event.id);
          } catch (error) {
            console.error('[Sessions] Cloud delete failed:', error);
          }
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      })();
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Delete session "${session.title}"?`)) confirm();
    } else {
      Alert.alert('Delete session', `Delete "${session.title}"?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: confirm },
      ]);
    }
  };

  if (!event.startDate || !event.endDate) {
    return (
      <View style={[styles.card, { backgroundColor: surfaceColor }]}>
        <ThemedText style={{ color: textSecondaryColor }}>
          Set conference start and end dates in Edit Event to add sessions.
        </ThemedText>
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      <View style={styles.headerRow}>
        <ThemedText type="subtitle">Session schedule</ThemedText>
        <Pressable
          style={[styles.addButton, { backgroundColor: tintColor }]}
          onPress={openAddModal}
        >
          <IconSymbol name="plus" size={16} color="#fff" />
          <ThemedText style={styles.addButtonText}>Add session</ThemedText>
        </Pressable>
      </View>

      {event.venueCapacity ? (
        <ThemedText style={[styles.meta, { color: textSecondaryColor }]}>
          Venue capacity: {event.venueCapacity} attendees
        </ThemedText>
      ) : null}

      {event.selectionDeadline ? (
        <ThemedText style={[styles.meta, { color: textSecondaryColor }]}>
          Selection deadline: {formatConferenceDate(event.selectionDeadline)}
        </ThemedText>
      ) : null}

      {sessions.length === 0 ? (
        <View style={[styles.card, { backgroundColor: surfaceColor }]}>
          <ThemedText style={{ color: textSecondaryColor }}>
            No sessions yet. Add keynotes, workshops, and breakouts for attendees to choose in Phase 2.
          </ThemedText>
        </View>
      ) : (
        sessions.map((session) => (
          <View key={session.id} style={[styles.sessionCard, { backgroundColor: surfaceColor }]}>
            <View style={styles.sessionMain}>
              <ThemedText type="defaultSemiBold">{session.title}</ThemedText>
              <ThemedText style={{ color: textSecondaryColor, marginTop: 4 }}>
                {formatConferenceDate(session.date)} · {formatTime12h(session.startTime)} – {formatTime12h(session.endTime)}
              </ThemedText>
              {session.speaker ? (
                <ThemedText style={{ color: textSecondaryColor, marginTop: 2 }}>
                  {session.speaker}
                </ThemedText>
              ) : null}
              <View style={styles.sessionMetaRow}>
                {session.room ? (
                  <ThemedText style={[styles.badge, { color: textSecondaryColor }]}>
                    Room: {session.room}
                  </ThemedText>
                ) : null}
                {session.capacity != null ? (
                  <ThemedText style={[styles.badge, { color: textSecondaryColor }]}>
                    Cap: {session.capacity}
                  </ThemedText>
                ) : null}
              </View>
            </View>
            <View style={styles.sessionActions}>
              <Pressable onPress={() => openEditModal(session)} hitSlop={8}>
                <IconSymbol name="pencil" size={18} color={tintColor} />
              </Pressable>
              <Pressable onPress={() => handleDeleteSession(session)} hitSlop={8}>
                <IconSymbol name="trash.fill" size={18} color="#ef4444" />
              </Pressable>
            </View>
          </View>
        ))
      )}

      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: backgroundColor }]}>
            <ThemedText type="subtitle" style={{ marginBottom: 16 }}>
              {editingSession ? 'Edit session' : 'Add session'}
            </ThemedText>
            <ScrollView keyboardShouldPersistTaps="handled">
              <ThemedText style={styles.label}>Title</ThemedText>
              <TextInput
                style={[styles.input, { backgroundColor: surfaceColor, color: textColor }]}
                value={draft.title}
                onChangeText={(title) => setDraft((d) => ({ ...d, title }))}
                placeholder="Keynote, Workshop A…"
              />

              <ThemedText style={styles.label}>Day</ThemedText>
              <View style={styles.dayRow}>
                {conferenceDays.map((day) => (
                  <Pressable
                    key={day}
                    style={[
                      styles.dayChip,
                      { backgroundColor: surfaceColor },
                      draft.date === day && { backgroundColor: tintColor },
                    ]}
                    onPress={() => setDraft((d) => ({ ...d, date: day }))}
                  >
                    <ThemedText style={draft.date === day ? styles.chipTextSelected : undefined}>
                      {new Date(day + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>

              <View style={styles.timeRow}>
                <View style={styles.timeCol}>
                  <ThemedText style={styles.label}>Start (HH:MM)</ThemedText>
                  <TextInput
                    style={[styles.input, { backgroundColor: surfaceColor, color: textColor }]}
                    value={draft.startTime}
                    onChangeText={(startTime) => setDraft((d) => ({ ...d, startTime }))}
                    placeholder="10:00"
                  />
                </View>
                <View style={styles.timeCol}>
                  <ThemedText style={styles.label}>End (HH:MM)</ThemedText>
                  <TextInput
                    style={[styles.input, { backgroundColor: surfaceColor, color: textColor }]}
                    value={draft.endTime}
                    onChangeText={(endTime) => setDraft((d) => ({ ...d, endTime }))}
                    placeholder="12:00"
                  />
                </View>
              </View>

              <ThemedText style={styles.label}>Speaker (optional)</ThemedText>
              <TextInput
                style={[styles.input, { backgroundColor: surfaceColor, color: textColor }]}
                value={draft.speaker}
                onChangeText={(speaker) => setDraft((d) => ({ ...d, speaker }))}
              />

              <ThemedText style={styles.label}>Room (optional)</ThemedText>
              <TextInput
                style={[styles.input, { backgroundColor: surfaceColor, color: textColor }]}
                value={draft.room}
                onChangeText={(room) => setDraft((d) => ({ ...d, room }))}
                placeholder="Main Hall, Room B…"
              />

              <ThemedText style={styles.label}>Capacity (optional)</ThemedText>
              <TextInput
                style={[styles.input, { backgroundColor: surfaceColor, color: textColor }]}
                value={draft.capacity}
                onChangeText={(capacity) => setDraft((d) => ({ ...d, capacity }))}
                keyboardType="number-pad"
                placeholder="40"
              />

              <ThemedText style={styles.label}>Description (optional)</ThemedText>
              <TextInput
                style={[styles.input, styles.textArea, { backgroundColor: surfaceColor, color: textColor }]}
                value={draft.description}
                onChangeText={(description) => setDraft((d) => ({ ...d, description }))}
                multiline
              />
            </ScrollView>

            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <ThemedText>Cancel</ThemedText>
              </Pressable>
              <Pressable style={[styles.saveBtn, { backgroundColor: tintColor }]} onPress={handleSaveSession}>
                <ThemedText style={{ color: '#fff', fontWeight: '600' }}>Save</ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 24 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  addButtonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  meta: { fontSize: 13, marginBottom: 4 },
  card: { padding: 16, borderRadius: 12, marginTop: 8 },
  sessionCard: {
    flexDirection: 'row',
    padding: 14,
    borderRadius: 12,
    marginTop: 10,
    alignItems: 'flex-start',
  },
  sessionMain: { flex: 1 },
  sessionMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  badge: { fontSize: 12 },
  sessionActions: { flexDirection: 'row', gap: 12, paddingLeft: 8 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    maxHeight: '90%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
  },
  label: { fontSize: 13, fontWeight: '600', marginTop: 12, marginBottom: 6 },
  input: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'web' ? 10 : 12,
    fontSize: 16,
  },
  textArea: { minHeight: 72, textAlignVertical: 'top' },
  dayRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dayChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  chipTextSelected: { color: '#fff', fontWeight: '600' },
  timeRow: { flexDirection: 'row', gap: 12 },
  timeCol: { flex: 1 },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 16,
    paddingTop: 12,
  },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 10 },
  saveBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
});
