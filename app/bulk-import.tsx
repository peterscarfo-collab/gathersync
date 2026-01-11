import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';
import { eventsLocalStorage } from '@/lib/local-storage';
import { parseBulkAvailability, generateImportTemplate } from '@/lib/bulk-import';
import { generateId } from '@/lib/calendar-utils';
import type { Event, Participant } from '@/types/models';

export default function BulkImportScreen() {
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

  const handleImport = async () => {
    if (!importText.trim()) {
      Alert.alert('Error', 'Please paste your spreadsheet data');
      return;
    }

    setIsProcessing(true);

    try {
      // Get event details
      const event = await eventsLocalStorage.getById(eventId!);
      if (!event) {
        Alert.alert('Error', 'Event not found');
        return;
      }

      // Parse the bulk data
      const result = parseBulkAvailability(importText, event.month, event.year);

      if (!result.success) {
        Alert.alert(
          'Import Failed',
          result.errors.join('\n'),
          [{ text: 'OK' }]
        );
        return;
      }

      // Add participants to event
      const newParticipants: Participant[] = result.participants.map(p => ({
        id: generateId(),
        name: p.name,
        availability: p.availability,
        unavailableAllMonth: false,
      }));

      const updatedEvent: Event = {
        ...event,
        participants: [...event.participants, ...newParticipants],
        updatedAt: new Date().toISOString(),
      };

      await eventsLocalStorage.update(eventId!, updatedEvent);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        'Success',
        `Imported ${newParticipants.length} participant${newParticipants.length === 1 ? '' : 's'}${result.errors.length > 0 ? `\n\nWarnings:\n${result.errors.join('\n')}` : ''}`,
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to import data');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleShowExample = async () => {
    const event = await eventsLocalStorage.getById(eventId!);
    if (!event) return;

    const template = generateImportTemplate(event.month, event.year);
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
          <ThemedText type="title">Bulk Import</ThemedText>
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
            2. First row: Name, 1, 2, 3, ... (day numbers)
          </ThemedText>
          <ThemedText style={[styles.instruction, { color: textSecondaryColor }]}>
            3. Each row: Name, Y/N for each day (Y = available)
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
            placeholder="Name, 1, 2, 3, ...&#10;John, Y, N, Y, ...&#10;Sarah, Y, Y, N, ..."
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
            {isProcessing ? 'Importing...' : 'Import Participants'}
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
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  card: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  cardTitle: {
    marginBottom: 16,
  },
  instruction: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 8,
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
    marginTop: 12,
  },
  exampleButtonText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'monospace',
    minHeight: 200,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.05)',
  },
  importButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  importButtonDisabled: {
    opacity: 0.6,
  },
  importButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
  },
});
