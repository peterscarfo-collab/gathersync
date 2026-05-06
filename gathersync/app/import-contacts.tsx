import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';
import { eventsLocalStorage } from '@/lib/local-storage';
import { parseContactsCSV, generateContactsImportTemplate } from '@/lib/bulk-import';
import { generateId } from '@/lib/calendar-utils';
import type { Event, Participant } from '@/types/models';

export default function ImportContactsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { eventId } = useLocalSearchParams<{ eventId: string }>();

  const [importText, setImportText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const tintColor = useThemeColor({}, 'tint');
  const backgroundColor = useThemeColor({}, 'background');
  const surfaceColor = useThemeColor({}, 'surface');
  const textColor = useThemeColor({}, 'text');
  const textSecondaryColor = useThemeColor({}, 'textSecondary');

  const handleSelectFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        
        if (Platform.OS === 'web') {
          // Read web file
          const response = await fetch(file.uri);
          const text = await response.text();
          setImportText(text);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
          // Read native file
          const fileContent = await FileSystem.readAsStringAsync(file.uri);
          setImportText(fileContent);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      }
    } catch (error) {
      console.error('Error selecting file:', error);
      Alert.alert('Error', 'Failed to read the selected file. Please try pasting the text instead.');
    }
  };

  const handleImport = async () => {
    if (!importText.trim()) {
      if (Platform.OS === 'web') {
        alert('Please paste your spreadsheet data');
      } else {
        Alert.alert('Error', 'Please paste your spreadsheet data');
      }
      return;
    }

    setIsProcessing(true);

    try {
      // Get event details
      const event = await eventsLocalStorage.getById(eventId!);
      if (!event) {
        if (Platform.OS === 'web') {
          alert('Event not found');
        } else {
          Alert.alert('Error', 'Event not found');
        }
        setIsProcessing(false);
        return;
      }

      // Parse the bulk data
      const result = parseContactsCSV(importText);

      if (!result.success) {
        if (Platform.OS === 'web') {
          alert('Import Failed\n\n' + result.errors.join('\n'));
        } else {
          Alert.alert(
            'Import Failed',
            result.errors.join('\n'),
            [{ text: 'OK' }]
          );
        }
        setIsProcessing(false);
        return;
      }

      // Add participants to event
      const newParticipants: Participant[] = result.participants.map(p => ({
        id: generateId(),
        name: p.name,
        phone: p.phone,
        email: p.email,
        designation: p.designation,
        organization: p.organization,
        availability: {},
        unavailableAllMonth: false,
        rsvpStatus: 'no-response',
      }));

      // Merge new participants, avoiding duplicates by name
      const existingNames = new Set(event.participants.map(p => p.name.toLowerCase()));
      const filteredNewParticipants = newParticipants.filter(p => !existingNames.has(p.name.toLowerCase()));

      const duplicatesCount = newParticipants.length - filteredNewParticipants.length;

      const updatedEvent: Event = {
        ...event,
        participants: [...event.participants, ...filteredNewParticipants],
        updatedAt: new Date().toISOString(),
      };

      await eventsLocalStorage.update(eventId!, updatedEvent);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      let successMessage = `Imported ${filteredNewParticipants.length} new participant${filteredNewParticipants.length === 1 ? '' : 's'}.`;
      if (duplicatesCount > 0) {
        successMessage += `\nSkipped ${duplicatesCount} duplicate${duplicatesCount === 1 ? '' : 's'}.`;
      }
      if (result.errors.length > 0) {
        successMessage += `\n\nWarnings:\n${result.errors.join('\n')}`;
      }

      if (Platform.OS === 'web') {
        alert(successMessage);
        router.back();
      } else {
        Alert.alert(
          'Success',
          successMessage,
          [
            {
              text: 'OK',
              onPress: () => router.back(),
            },
          ]
        );
      }
    } catch (error: any) {
      if (Platform.OS === 'web') {
        alert(error.message || 'Failed to import data');
      } else {
        Alert.alert('Error', error.message || 'Failed to import data');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleShowExample = () => {
    const template = generateContactsImportTemplate();
    Alert.alert(
      'Example Format',
      'Copy this format and replace with your data:\n\n' + template,
      [{ text: 'OK' }]
    );
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Math.max(insets.top, 20),
            paddingBottom: Math.max(insets.bottom, 20) + 80,
          },
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={8}
          >
            <IconSymbol name="chevron.left" size={24} color={tintColor} />
          </Pressable>
          <ThemedText type="title">Import Contact List</ThemedText>
          <View style={{ width: 24 }} />
        </View>

        {/* Instructions */}
        <View style={[styles.card, { backgroundColor: surfaceColor }]}>
          <ThemedText type="subtitle" style={styles.cardTitle}>
            How to Import
          </ThemedText>
          <ThemedText style={[styles.instruction, { color: textSecondaryColor }]}>
            1. Prepare your data in a spreadsheet (Excel, Google Sheets, etc.)
          </ThemedText>
          <ThemedText style={[styles.instruction, { color: textSecondaryColor }]}>
            2. Columns must be: Name, Phone, Email, Title/Designation, Company/Organization
          </ThemedText>
          <ThemedText style={[styles.instruction, { color: textSecondaryColor }]}>
            3. Each row represents one participant
          </ThemedText>
          <ThemedText style={[styles.instruction, { color: textSecondaryColor }]}>
            4. Copy all cells and paste below
          </ThemedText>

          <Pressable
            style={[styles.exampleButton, { borderColor: tintColor }]}
            onPress={handleShowExample}
          >
            <IconSymbol name="info.circle" size={16} color={tintColor} />
            <ThemedText style={[styles.exampleButtonText, { color: tintColor }]}>
              Show Example
            </ThemedText>
          </Pressable>

          <Pressable
            style={[styles.exampleButton, { backgroundColor: tintColor, borderColor: tintColor }]}
            onPress={handleSelectFile}
          >
            <IconSymbol name="arrow.up.doc" size={16} color="#FFFFFF" />
            <ThemedText style={[styles.exampleButtonText, { color: '#FFFFFF' }]}>
              Select CSV File
            </ThemedText>
          </Pressable>
        </View>

        {/* Input */}
        <View style={[styles.card, { backgroundColor: surfaceColor }]}>
          <ThemedText type="subtitle" style={styles.cardTitle}>
            Paste Spreadsheet Data
          </ThemedText>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor,
                color: textColor,
                borderColor: textSecondaryColor + '40',
              },
            ]}
            value={importText}
            onChangeText={setImportText}
            placeholder="Name, Phone, Email&#10;John Doe, 555-1234, john@example.com&#10;Sarah Smith, , sarah@example.com"
            placeholderTextColor={textSecondaryColor}
            multiline
            numberOfLines={10}
            textAlignVertical="top"
          />
        </View>
      </ScrollView>

      {/* Import Button */}
      <View
        style={[
          styles.footer,
          {
            paddingBottom: Math.max(insets.bottom, 20),
            backgroundColor,
          },
        ]}
      >
        <Pressable
          style={[
            styles.importButton,
            { backgroundColor: tintColor },
            isProcessing && styles.importButtonDisabled,
          ]}
          onPress={handleImport}
          disabled={isProcessing}
        >
          <ThemedText style={styles.importButtonText}>
            {isProcessing ? 'Importing...' : 'Import Contact List'}
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
  scrollContent: {
    paddingHorizontal: 20,
    gap: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  card: {
    borderRadius: 16,
    padding: 20,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTitle: {
    marginBottom: 4,
  },
  instruction: {
    fontSize: 15,
    lineHeight: 22,
  },
  exampleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
  },
  exampleButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    minHeight: 200,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
  },
  importButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  importButtonDisabled: {
    opacity: 0.5,
  },
  importButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
});