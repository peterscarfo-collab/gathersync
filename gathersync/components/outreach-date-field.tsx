import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';

export function todayIsoDate(): string {
  return new Date().toISOString().split('T')[0];
}

export function parseIsoDate(value?: string): Date | null {
  if (!value?.trim()) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatDisplayDate(value?: string): string {
  const date = parseIsoDate(value);
  if (!date) return 'Pick a date';
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

interface OutreachDateFieldProps {
  label: string;
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function OutreachDateField({ label, value = '', onChange, placeholder }: OutreachDateFieldProps) {
  const tintColor = useThemeColor({}, 'tint');
  const surfaceColor = useThemeColor({ light: '#fff', dark: '#1a1a1a' }, 'background');
  const textColor = useThemeColor({}, 'text');
  const [showPicker, setShowPicker] = useState(false);
  const parsed = parseIsoDate(value) || new Date();

  const setDate = (date: Date) => {
    onChange(formatIsoDate(date));
  };

  const handleToday = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onChange(todayIsoDate());
  };

  const handleClear = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onChange('');
  };

  return (
    <View style={styles.wrap}>
      <ThemedText style={styles.label}>{label}</ThemedText>
      <View style={styles.row}>
        {Platform.OS === 'web' ? (
          <input
            type="date"
            value={value || ''}
            placeholder={placeholder}
            onChange={e => onChange(e.target.value)}
            style={{
              flex: 1,
              padding: 12,
              fontSize: 15,
              backgroundColor: surfaceColor,
              color: textColor,
              border: '1px solid #ddd',
              borderRadius: 8,
            }}
          />
        ) : (
          <>
            <Pressable
              style={[styles.input, { flex: 1, borderColor: '#ddd', justifyContent: 'center' }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowPicker(true);
              }}
            >
              <ThemedText style={{ color: value ? textColor : '#999' }}>
                {value ? formatDisplayDate(value) : placeholder || 'Pick a date'}
              </ThemedText>
            </Pressable>
            {showPicker && (
              <DateTimePicker
                value={parsed}
                mode="date"
                display="spinner"
                onChange={(event, selectedDate) => {
                  setShowPicker(Platform.OS === 'ios');
                  if (event.type === 'dismissed') return;
                  if (selectedDate) setDate(selectedDate);
                }}
              />
            )}
          </>
        )}
        <Pressable style={[styles.chipBtn, { borderColor: tintColor }]} onPress={handleToday}>
          <ThemedText style={{ color: tintColor, fontWeight: '600', fontSize: 13 }}>Today</ThemedText>
        </Pressable>
        {value ? (
          <Pressable style={[styles.chipBtn, { borderColor: '#999' }]} onPress={handleClear}>
            <ThemedText style={{ color: '#666', fontWeight: '600', fontSize: 13 }}>Clear</ThemedText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 4 },
  label: { fontSize: 12, fontWeight: '600', opacity: 0.6, marginBottom: 4, marginTop: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 15 },
  chipBtn: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1 },
});
