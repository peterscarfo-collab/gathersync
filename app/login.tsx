import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View, TextInput } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuth } from '@/hooks/auth-context';
import { db } from '@/lib/db';

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ error?: string }>();
  const { isAuthenticated, loading: authLoading } = useAuth();
  
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sentEmail, setSentEmail] = useState(false);

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

  const handleSendCode = async () => {
    if (!email || !email.includes('@')) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }

    try {
      setIsLoading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      await db.auth.sendMagicCode({ email });
      setSentEmail(true);
      Alert.alert('Code Sent!', `Check your email at ${email} for your login code.`);
    } catch (error: any) {
      console.error('[Login] Failed to send code:', error);
      Alert.alert('Error', error.message || 'Failed to send login code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!code || code.length !== 6) {
      Alert.alert('Invalid Code', 'Please enter the 6-digit code from your email.');
      return;
    }

    try {
      setIsLoading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      console.log('[Login] Attempting to verify code for:', email);
      const result = await db.auth.signInWithMagicCode({ email, code });
      console.log('[Login] Sign in result:', result);

      Alert.alert('Success!', 'Logged in successfully');
      // Auth state will update automatically and redirect
    } catch (error: any) {
      console.error('[Login] Failed to verify code:', error);
      Alert.alert('Error', error.message || 'Invalid code. Please try again.');
    } finally {
      setIsLoading(false);
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
            {sentEmail 
              ? 'Enter the 6-digit code sent to your email'
              : 'Sign in with your email - no password needed!'}
          </ThemedText>

          {!sentEmail ? (
            <>
              {/* Email Input */}
              <TextInput
                style={[styles.input, { backgroundColor: surfaceColor, color: textColor }]}
                placeholder="Enter your email"
                placeholderTextColor={textSecondaryColor}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
              />

              {/* Send Code Button */}
              <Pressable
                style={[
                  styles.loginButton,
                  { backgroundColor: tintColor },
                  isLoading && styles.loginButtonDisabled,
                ]}
                onPress={handleSendCode}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ThemedText style={styles.loginButtonText}>Sending...</ThemedText>
                ) : (
                  <>
                    <IconSymbol name="envelope.fill" size={20} color="#FFFFFF" />
                    <ThemedText style={styles.loginButtonText}>Send Login Code</ThemedText>
                  </>
                )}
              </Pressable>
            </>
          ) : (
            <>
              {/* Code Input */}
              <TextInput
                style={[styles.input, styles.codeInput, { backgroundColor: surfaceColor, color: textColor }]}
                placeholder="000000"
                placeholderTextColor={textSecondaryColor}
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
                editable={!isLoading}
              />

              {/* Verify Code Button */}
              <Pressable
                style={[
                  styles.loginButton,
                  { backgroundColor: tintColor },
                  isLoading && styles.loginButtonDisabled,
                ]}
                onPress={handleVerifyCode}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ThemedText style={styles.loginButtonText}>Verifying...</ThemedText>
                ) : (
                  <>
                    <IconSymbol name="checkmark.circle.fill" size={20} color="#FFFFFF" />
                    <ThemedText style={styles.loginButtonText}>Verify Code</ThemedText>
                  </>
                )}
              </Pressable>

              {/* Resend Code */}
              <Pressable
                onPress={() => {
                  setSentEmail(false);
                  setCode('');
                }}
                disabled={isLoading}
              >
                <ThemedText style={[styles.linkText, { color: tintColor }]}>
                  Use a different email
                </ThemedText>
              </Pressable>
            </>
          )}

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
  input: {
    width: '100%',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  codeInput: {
    fontSize: 24,
    fontWeight: '600',
    letterSpacing: 8,
    textAlign: 'center',
  },
  linkText: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 24,
  },
});
