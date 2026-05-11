import React, { useState, useEffect } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, View, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';
import { eventsLocalStorage } from '@/lib/local-storage';
import { getMonthName, getBestDays } from '@/lib/calendar-utils';
import type { Event, Participant } from '@/types/models';
import { getEffectiveAttendanceStatus, getParticipantStatus } from '@/lib/participant-status';

export default function ExportReportScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { eventId, mode } = useLocalSearchParams<{ eventId: string, mode?: string }>();

  const [event, setEvent] = useState<Event | null>(null);
  const [selectedParticipants, setSelectedParticipants] = useState<Set<string>>(new Set());
  
  // New state for columns
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(
    new Set(['name', 'phone', 'email', 'designation', 'organization', 'rsvp', 'attendance'])
  );

  const toggleColumn = (col: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newSelected = new Set(selectedColumns);
    if (newSelected.has(col)) {
      if (newSelected.size > 1) { // prevent deselecting all
        newSelected.delete(col);
      }
    } else {
      newSelected.add(col);
    }
    setSelectedColumns(newSelected);
  };

  const tintColor = useThemeColor({}, 'tint');
  const backgroundColor = useThemeColor({}, 'background');
  const surfaceColor = useThemeColor({}, 'surface');
  const textSecondaryColor = useThemeColor({}, 'textSecondary');
  const successColor = useThemeColor({}, 'success');
  const errorColor = useThemeColor({}, 'error');

  useEffect(() => {
    loadEvent();
  }, [eventId]);

  const loadEvent = async () => {
    if (!eventId) return;
    const loadedEvent = await eventsLocalStorage.getById(eventId);
    if (loadedEvent) {
      // Enrich participants with global contact info to ensure phone/email is loaded
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
      
      // Filter out deleted participants
      loadedEvent.participants = loadedEvent.participants.filter(p => !p.deletedAt);
      
      // Update default selected columns based on event privacy settings
      const initialCols = new Set(['designation', 'organization', 'rsvp', 'attendance']);
      if (loadedEvent.showAttendeeNames !== false) initialCols.add('name');
      if (loadedEvent.showAttendeeEmails === true) initialCols.add('email');
      if (loadedEvent.showAttendeePhones === true) initialCols.add('phone');
      
      // If it's an older event without these settings, default to showing everything
      if (loadedEvent.showAttendeeEmails === undefined && loadedEvent.showAttendeePhones === undefined) {
        initialCols.add('email');
        initialCols.add('phone');
      }
      
      setSelectedColumns(initialCols);
      
      setEvent(loadedEvent);
    }
  };

  const toggleParticipant = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newSelected = new Set(selectedParticipants);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedParticipants(newSelected);
  };

  const selectAll = () => {
    if (!event) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedParticipants(new Set(event.participants.map(p => p.id)));
  };

  const selectNone = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedParticipants(new Set());
  };

  const selectByStatus = (status: 'attending' | 'not-attending' | 'no-response' | 'available' | 'not-available') => {
    if (!event) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newSelected = new Set<string>();
    event.participants.forEach(p => {
      if (event.eventType === 'fixed') {
        const effectiveStatus = getEffectiveAttendanceStatus(p, event);
        if (effectiveStatus === status) {
          newSelected.add(p.id);
        }
      } else {
        let isAvailable = false;
        let isNotAvailable = false;
        
        if (p.unavailableAllMonth) {
          isNotAvailable = true;
        } else if (p.availability && Object.keys(p.availability).length > 0) {
          const hasAvailableDays = Object.values(p.availability).some(v => v === true);
          if (hasAvailableDays) {
            isAvailable = true;
          } else {
            isNotAvailable = true;
          }
        }
        
        if (status === 'available' && isAvailable) {
          newSelected.add(p.id);
        } else if (status === 'not-available' && isNotAvailable) {
          newSelected.add(p.id);
        } else if (status === 'no-response' && !isAvailable && !isNotAvailable) {
          newSelected.add(p.id);
        }
      }
    });
    setSelectedParticipants(newSelected);
  };

  const handleExportCSV = () => {
    if (!event || selectedParticipants.size === 0) return;

    try {
      const allCols = [
        { id: 'name', label: 'Name' },
        { id: 'phone', label: 'Phone' },
        { id: 'email', label: 'Email' },
        { id: 'designation', label: 'Title/Designation' },
        { id: 'organization', label: 'Company/Organization' },
        { id: 'rsvp', label: 'RSVP Status' },
        { id: 'attendance', label: 'Attendance' },
      ];
      
      const activeCols = allCols.filter(c => selectedColumns.has(c.id));
      const header = activeCols.map(c => c.label).join(',');
      
      const rows = event.participants
        .filter(p => selectedParticipants.has(p.id))
        .map(p => {
          const rowData = [];
          
          if (selectedColumns.has('name')) rowData.push(`"${p.name || ''}"`);
          if (selectedColumns.has('phone')) rowData.push(p.phone ? `="${p.phone}"` : '""');
          if (selectedColumns.has('email')) rowData.push(`"${p.email || ''}"`);
          if (selectedColumns.has('designation')) rowData.push(`"${p.designation || ''}"`);
          if (selectedColumns.has('organization')) rowData.push(`"${p.organization || ''}"`);
          if (selectedColumns.has('rsvp')) {
            if (event.eventType === 'fixed') {
              rowData.push(`"${p.rsvpStatus || 'no-response'}"`);
            } else {
              let flexStatusStr = 'No Response';
              if (p.unavailableAllMonth) {
                flexStatusStr = 'Not Available';
              } else if (p.availability && Object.keys(p.availability).length > 0) {
                const hasAvailableDays = Object.values(p.availability).some(v => v === true);
                flexStatusStr = hasAvailableDays ? 'Available' : 'Not Available';
              }
              rowData.push(`"${flexStatusStr}"`);
            }
          }
          if (selectedColumns.has('attendance')) {
            let attendance = 'Unknown';
            if (event.eventType === 'fixed' && (event as any).attendanceRecords && (event as any).attendanceRecords.length > 0) {
              const latestRecord = (event as any).attendanceRecords[(event as any).attendanceRecords.length - 1];
              attendance = latestRecord.attendees.includes(p.id) ? 'Attended' : 'Not Attended';
            }
            rowData.push(`"${attendance}"`);
          }

          return rowData.join(',');
        });

      const csvContent = [header, ...rows].join('\n');

      if (Platform.OS === 'web') {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `${event.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_report.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        Share.share({
          message: csvContent,
          title: `${event.name} Report`,
        });
      }
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      Alert.alert('Export Failed', 'Could not export report to CSV');
      console.error(error);
    }
  };

  const handleCopyText = async () => {
    if (!event || selectedParticipants.size === 0) return;

    try {
      const bestDays = getBestDays(event);
      const bestDayText = bestDays.length > 0
        ? `Best day: ${bestDays[0].date} (${bestDays[0].availableCount} available)`
        : 'No availability data yet';

      const eventType = event.eventType === 'fixed' 
        ? `Fixed Event: ${event.fixedDate}${event.fixedTime ? ' at ' + event.fixedTime : ''}`
        : `Flexible Event: ${getMonthName(event.month)} ${event.year}`;

      const participantsList = event.participants
        .filter(p => selectedParticipants.has(p.id))
        .map(p => {
          const details = [];
          
          if (selectedColumns.has('email') && p.email) details.push(p.email);
          if (selectedColumns.has('phone') && p.phone) details.push(p.phone);
          if (selectedColumns.has('designation') && p.designation) details.push(p.designation);
          if (selectedColumns.has('organization') && p.organization) details.push(p.organization);
          if (selectedColumns.has('rsvp')) {
            if (event.eventType === 'fixed') {
              details.push(`RSVP: ${p.rsvpStatus || 'no-response'}`);
            } else {
              let flexStatusStr = 'No Response';
              if (p.unavailableAllMonth) {
                flexStatusStr = 'Not Available';
              } else if (p.availability && Object.keys(p.availability).length > 0) {
                const hasAvailableDays = Object.values(p.availability).some(v => v === true);
                flexStatusStr = hasAvailableDays ? 'Available' : 'Not Available';
              }
              details.push(`RSVP: ${flexStatusStr}`);
            }
          }
          if (selectedColumns.has('attendance')) {
            let attendance = 'Unknown';
            if (event.eventType === 'fixed' && (event as any).attendanceRecords && (event as any).attendanceRecords.length > 0) {
              const latestRecord = (event as any).attendanceRecords[(event as any).attendanceRecords.length - 1];
              attendance = latestRecord.attendees.includes(p.id) ? 'Attended' : 'Not Attended';
            }
            details.push(`Attendance: ${attendance}`);
          }

          let line = `  • `;
          if (selectedColumns.has('name')) {
            line += p.name;
          } else {
            line += 'Participant';
          }
          
          if (details.length > 0) {
            line += ` (${details.join(', ')})`;
          }
          
          return line;
        })
        .join('\n');

      const details = `📅 ${event.name}\n\n${eventType}\n\n${bestDayText}\n\nParticipants (${selectedParticipants.size}):\n${participantsList || '  No participants yet'}`;

      await Clipboard.setStringAsync(details);
      if (Platform.OS === 'web') {
        alert('Report copied to clipboard!');
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Success', 'Report copied to clipboard!');
      }
    } catch (error) {
      console.error('Error copying:', error);
      Alert.alert('Error', 'Failed to copy report to clipboard');
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
        <ThemedText type="subtitle">Export Report</ThemedText>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Columns to Include */}
        <View style={{ marginBottom: 24 }}>
          <ThemedText type="defaultSemiBold" style={{ marginBottom: 8 }}>Columns to Include</ThemedText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {[
              { id: 'name', label: 'Name' },
              { id: 'phone', label: 'Phone' },
              { id: 'email', label: 'Email' },
              { id: 'designation', label: 'Title/Designation' },
              { id: 'organization', label: 'Company/Organization' },
              { id: 'rsvp', label: 'RSVP Status' },
              { id: 'attendance', label: 'Attendance' },
            ].map(col => {
              const isColSelected = selectedColumns.has(col.id);
              return (
                <Pressable 
                  key={col.id}
                  style={[
                    styles.filterButton, 
                    { 
                      backgroundColor: isColSelected ? tintColor : textSecondaryColor + '20',
                      borderWidth: 1,
                      borderColor: isColSelected ? tintColor : 'transparent'
                    }
                  ]} 
                  onPress={() => toggleColumn(col.id)}
                >
                  <ThemedText style={{ color: isColSelected ? '#fff' : textSecondaryColor, fontSize: 13, fontWeight: '500' }}>
                    {col.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Filters */}
        <View style={{ marginBottom: 16 }}>
          <ThemedText type="defaultSemiBold" style={{ marginBottom: 8 }}>Quick Select</ThemedText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Pressable style={[styles.filterButton, { backgroundColor: tintColor + '20' }]} onPress={selectAll}>
              <ThemedText style={{ color: tintColor, fontSize: 13, fontWeight: '500' }}>Select All</ThemedText>
            </Pressable>
            <Pressable style={[styles.filterButton, { backgroundColor: textSecondaryColor + '20' }]} onPress={selectNone}>
              <ThemedText style={{ color: textSecondaryColor, fontSize: 13, fontWeight: '500' }}>Select None</ThemedText>
            </Pressable>
            {event.eventType === 'fixed' ? (
              <>
                <Pressable style={[styles.filterButton, { backgroundColor: successColor + '20' }]} onPress={() => selectByStatus('attending')}>
                  <ThemedText style={{ color: successColor, fontSize: 13, fontWeight: '500' }}>Attending</ThemedText>
                </Pressable>
                <Pressable style={[styles.filterButton, { backgroundColor: errorColor + '20' }]} onPress={() => selectByStatus('not-attending')}>
                  <ThemedText style={{ color: errorColor, fontSize: 13, fontWeight: '500' }}>Not Attending</ThemedText>
                </Pressable>
              </>
            ) : (
              <>
                <Pressable style={[styles.filterButton, { backgroundColor: successColor + '20' }]} onPress={() => selectByStatus('available')}>
                  <ThemedText style={{ color: successColor, fontSize: 13, fontWeight: '500' }}>Available</ThemedText>
                </Pressable>
                <Pressable style={[styles.filterButton, { backgroundColor: errorColor + '20' }]} onPress={() => selectByStatus('not-available')}>
                  <ThemedText style={{ color: errorColor, fontSize: 13, fontWeight: '500' }}>Not Available</ThemedText>
                </Pressable>
              </>
            )}
            <Pressable style={[styles.filterButton, { backgroundColor: textSecondaryColor + '20' }]} onPress={() => selectByStatus('no-response')}>
              <ThemedText style={{ color: textSecondaryColor, fontSize: 13, fontWeight: '500' }}>No Response</ThemedText>
            </Pressable>
          </View>
        </View>

        <ThemedText type="defaultSemiBold" style={{ marginBottom: 8 }}>
          Participants ({selectedParticipants.size}/{event.participants.length} selected)
        </ThemedText>

        <View style={[styles.card, { backgroundColor: surfaceColor, padding: 0 }]}>
          {event.participants.map((p, index) => {
            const isSelected = selectedParticipants.has(p.id);
            
            let statusColor = textSecondaryColor;
            let statusText = 'No Response';
            
            if (event.eventType === 'fixed') {
              const status = getEffectiveAttendanceStatus(p, event);
              if (status === 'attending') {
                statusColor = successColor;
                statusText = 'Attending';
              } else if (status === 'not-attending') {
                statusColor = errorColor;
                statusText = 'Not Attending';
              }
            } else {
              if (p.unavailableAllMonth) {
                statusColor = errorColor;
                statusText = 'Not Available';
              } else if (p.availability && Object.keys(p.availability).length > 0) {
                const hasAvailableDays = Object.values(p.availability).some(v => v === true);
                if (hasAvailableDays) {
                  statusColor = successColor;
                  statusText = 'Available';
                } else {
                  statusColor = errorColor;
                  statusText = 'Not Available';
                }
              }
            }
            
            return (
              <Pressable
                key={p.id}
                style={[
                  styles.participantRow,
                  index < event.participants.length - 1 && { borderBottomColor: textSecondaryColor + '20', borderBottomWidth: StyleSheet.hairlineWidth }
                ]}
                onPress={() => toggleParticipant(p.id)}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                  <View style={[
                    styles.checkbox,
                    { borderColor: isSelected ? tintColor : textSecondaryColor + '50' },
                    isSelected && { backgroundColor: tintColor }
                  ]}>
                    {isSelected && <IconSymbol name="checkmark" size={14} color="#FFFFFF" />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText type="defaultSemiBold">{p.name}</ThemedText>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                      <ThemedText style={{ fontSize: 12, color: statusColor }}>{statusText}</ThemedText>
                      {p.phone && <IconSymbol name="phone.fill" size={10} color={textSecondaryColor} />}
                      {p.email && <IconSymbol name="envelope.fill" size={10} color={textSecondaryColor} />}
                    </View>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
        <View style={{ height: Math.max(insets.bottom, 16) + 120 }} />
      </ScrollView>

      {/* Action Buttons */}
      <View style={[styles.actionContainer, { paddingBottom: Math.max(insets.bottom, 16), backgroundColor }]}>
        {mode === 'text' ? (
          <Pressable
            style={[styles.actionButton, { backgroundColor: tintColor, opacity: selectedParticipants.size === 0 ? 0.5 : 1 }]}
            onPress={handleCopyText}
            disabled={selectedParticipants.size === 0}
          >
            <IconSymbol name="doc.on.doc" size={20} color="#FFFFFF" />
            <ThemedText style={styles.actionButtonText}>Copy to Clipboard</ThemedText>
          </Pressable>
        ) : (
          <Pressable
            style={[styles.actionButton, { backgroundColor: tintColor, opacity: selectedParticipants.size === 0 ? 0.5 : 1 }]}
            onPress={handleExportCSV}
            disabled={selectedParticipants.size === 0}
          >
            <IconSymbol name="square.and.arrow.up" size={20} color="#FFFFFF" />
            <ThemedText style={styles.actionButtonText}>Export to CSV</ThemedText>
          </Pressable>
        )}
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
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  card: {
    borderRadius: 12,
    padding: 16,
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  participantRow: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    gap: 8,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
});