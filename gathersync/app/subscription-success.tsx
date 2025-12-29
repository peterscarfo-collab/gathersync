import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuth } from '@/hooks/use-auth';

export default function SubscriptionSuccessScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tintColor = useThemeColor({}, 'tint');
  const { refresh } = useAuth();

  useEffect(() => {
    // Refresh user data to get updated subscription status
    console.log('[SubscriptionSuccess] Refreshing user data after payment...');
    refresh();
  }, [refresh]);

  return (
    <ThemedView
      style={[
        styles.container,
        {
          paddingTop: Math.max(insets.top, 20),
          paddingBottom: Math.max(insets.bottom, 20),
          paddingLeft: Math.max(insets.left, 20),
          paddingRight: Math.max(insets.right, 20),
        },
      ]}
    >
      <ThemedText style={styles.emoji}>🎉</ThemedText>
      <ThemedText type="title" style={styles.title}>
        Welcome to Pro!
      </ThemedText>
      <ThemedText style={styles.message}>
        Your subscription is now active. Enjoy unlimited events and all Pro features!
      </ThemedText>

      <Pressable
        style={[styles.button, { backgroundColor: tintColor }]}
        onPress={() => router.replace('/(tabs)')}
      >
        <ThemedText style={styles.buttonText}>Start Creating Events</ThemedText>
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  emoji: {
    fontSize: 80,
    marginBottom: 24,
  },
  title: {
    marginBottom: 16,
    textAlign: 'center',
  },
  message: {
    textAlign: 'center',
    marginBottom: 32,
    opacity: 0.7,
    fontSize: 16,
    lineHeight: 24,
    maxWidth: 400,
  },
  button: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    minWidth: 200,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
