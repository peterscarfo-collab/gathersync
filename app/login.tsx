import React, { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuth } from '@/hooks/auth-context';

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ error?: string }>();
  const { isAuthenticated, loading: authLoading } = useAuth();
  
  const [isLoading, setIsLoading] = useState(false);

  const tintColor = useThemeColor({}, 'tint');
  const backgroundColor = useThemeColor({}, 'background');
  const surfaceColor = useThemeColor({}, 'surface');
  const textColor = useThemeColor({}, 'text');
  const textSecondaryColor = useThemeColor({}, 'textSecondary');
  const errorColor = useThemeColor({}, 'error');

  // Redirect if already authenticated
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, authLoading, router]);

  // Handle OAuth errors from callback
  useEffect(() => {
    if (params.error) {
      let errorMessage = 'Login failed. Please try again.';
      
      switch (params.error) {
        case 'missing_state':
          errorMessage = 'Security verification failed. Please try again.';
          break;
        case 'missing_code':
          errorMessage = 'Authorization incomplete. Please try again.';
          break;
        case 'access_denied':
          errorMessage = 'Login was cancelled.';
          break;
        default:
          errorMessage = `Login error: ${params.error}`;
      }

      Alert.alert('Login Error', errorMessage);
      
      // Clear error from URL
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.delete('error');
        window.history.replaceState({}, '', url.toString());
      }
    }
  }, [params.error]);

  const handleGoogleLogin = async () => {
    try {
      setIsLoading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Use the Google OAuth endpoint directly
      const loginUrl = Platform.OS === 'web' 
        ? '/api/auth/google'
        : 'https://gathersync.fly.dev/api/auth/google';

      console.log('[Login] Initiating Google OAuth:', loginUrl);

      if (Platform.OS === 'web') {
        // Web: OAuth must be top-level navigation
        window.location.href = loginUrl;
        return;
      }

      // Native: open in browser
      const result = await WebBrowser.openBrowserAsync(loginUrl, {
        showInRecents: true,
      });

      setIsLoading(false);

      // Check if user cancelled
      if (result.type === 'cancel') {
        console.log('[Login] User cancelled OAuth');
      }
    } catch (error) {
      console.error('[Login] OAuth initiation failed:', error);
      setIsLoading(false);
      Alert.alert('Error', 'Failed to start login. Please try again.');
    }
  };

  // Show loading state
  if (authLoading) {
    return (
      <ThemedView style={[styles.container, { backgroundColor, justifyContent: 'center', alignItems: 'center' }]}>
        <ThemedText>Loading...</ThemedText>
      </ThemedView>
    );
  }

  // Don't render if already authenticated (will redirect)
  if (isAuthenticated) {
    return null;
  }

  return (
    <ThemedView style={[styles.container, { backgroundColor }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: Math.max(insets.top, 20), paddingBottom: Math.max(insets.bottom, 20) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.back();
            }}
            hitSlop={8}
            style={styles.backButton}
          >
            <IconSymbol name="chevron.left" size={24} color={textColor} />
          </Pressable>
          <ThemedText type="title" style={styles.headerTitle}>Log In</ThemedText>
          <View style={styles.backButton} />
        </View>

        {/* Content */}
        <View style={styles.content}>
          {/* Logo/Icon */}
          <View style={[styles.logoContainer, { backgroundColor: surfaceColor }]}>
            <IconSymbol name="calendar" size={64} color={tintColor} />
          </View>

          {/* Title */}
          <ThemedText type="title" style={styles.title}>
            Welcome to GatherSync
          </ThemedText>

          {/* Description */}
          <ThemedText style={[styles.description, { color: textSecondaryColor }]}>
            Log in to sync your events across devices and share them with participants.
          </ThemedText>

          {/* Benefits List */}
          <View style={styles.benefitsContainer}>
            <View style={styles.benefitItem}>
              <IconSymbol name="checkmark.circle.fill" size={20} color={tintColor} />
              <ThemedText style={styles.benefitText}>Sync events across all your devices</ThemedText>
            </View>
            <View style={styles.benefitItem}>
              <IconSymbol name="checkmark.circle.fill" size={20} color={tintColor} />
              <ThemedText style={styles.benefitText}>Share events with participants</ThemedText>
            </View>
            <View style={styles.benefitItem}>
              <IconSymbol name="checkmark.circle.fill" size={20} color={tintColor} />
              <ThemedText style={styles.benefitText}>Access your data anywhere</ThemedText>
            </View>
          </View>

          {/* Login Button */}
          <Pressable
            style={[
              styles.loginButton,
              { backgroundColor: tintColor },
              isLoading && styles.loginButtonDisabled,
            ]}
            onPress={handleGoogleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <ThemedText style={styles.loginButtonText}>Loading...</ThemedText>
            ) : (
              <>
                <IconSymbol name="globe" size={20} color="#FFFFFF" />
                <ThemedText style={styles.loginButtonText}>Continue with Google</ThemedText>
              </>
            )}
          </Pressable>

          {/* Privacy Note */}
          <ThemedText style={[styles.privacyNote, { color: textSecondaryColor }]}>
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </ThemedText>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: 400,
    width: '100%',
    alignSelf: 'center',
  },
  logoContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 32,
  },
  benefitsContainer: {
    width: '100%',
    marginBottom: 40,
    gap: 16,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  benefitText: {
    fontSize: 16,
    lineHeight: 24,
    flex: 1,
  },
  loginButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginBottom: 16,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  privacyNote: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
});
