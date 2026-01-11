import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, View, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { IconSymbol } from './ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface OnboardingModalProps {
  visible: boolean;
  onComplete: () => void;
}

const ONBOARDING_SCREENS = [
  {
    icon: 'calendar.badge.plus' as const,
    title: 'Find the Perfect Date',
    description: 'Create events with date polling to find times that work for everyone. No more endless group chats!',
  },
  {
    icon: 'mappin' as const,
    title: 'Organize Gatherings',
    description: 'Search venues with Google Maps, track RSVPs, and send invites via SMS or WhatsApp.',
  },
  {
    icon: 'cloud' as const,
    title: 'Your Data, Your Way',
    description: 'Works offline with local storage. Log in for cloud sync across devices—completely optional.',
  },
];

export function OnboardingModal({ visible, onComplete }: OnboardingModalProps) {
  const [currentScreen, setCurrentScreen] = useState(0);
  const insets = useSafeAreaInsets();
  const tintColor = useThemeColor({}, 'tint');
  const textColor = useThemeColor({}, 'text');
  const backgroundColor = useThemeColor({}, 'background');

  const isLastScreen = currentScreen === ONBOARDING_SCREENS.length - 1;
  const screen = ONBOARDING_SCREENS[currentScreen];

  const handleNext = () => {
    if (isLastScreen) {
      onComplete();
    } else {
      setCurrentScreen(currentScreen + 1);
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onComplete}
    >
      <ThemedView style={[styles.container, { backgroundColor }]}>
        {/* Skip Button */}
        {!isLastScreen && (
          <Pressable
            onPress={handleSkip}
            style={[
              styles.skipButton,
              {
                top: Math.max(insets.top, 16) + 8,
                right: 20,
              },
            ]}
            hitSlop={8}
          >
            <ThemedText style={[styles.skipText, { color: tintColor }]}>Skip</ThemedText>
          </Pressable>
        )}

        {/* Content */}
        <View style={styles.content}>
          {/* Icon */}
          <View style={[styles.iconContainer, { backgroundColor: `${tintColor}15` }]}>
            <IconSymbol name={screen.icon} size={64} color={tintColor} />
          </View>

          {/* Title */}
          <ThemedText type="title" style={styles.title}>
            {screen.title}
          </ThemedText>

          {/* Description */}
          <ThemedText style={[styles.description, { color: textColor }]}>
            {screen.description}
          </ThemedText>

          {/* Page Indicators */}
          <View style={styles.indicators}>
            {ONBOARDING_SCREENS.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.indicator,
                  {
                    backgroundColor: index === currentScreen ? tintColor : '#E0E0E0',
                    width: index === currentScreen ? 24 : 8,
                  },
                ]}
              />
            ))}
          </View>
        </View>

        {/* Next/Get Started Button */}
        <View
          style={[
            styles.footer,
            {
              paddingBottom: Math.max(insets.bottom, 16) + 16,
            },
          ]}
        >
          <Pressable
            onPress={handleNext}
            style={[styles.nextButton, { backgroundColor: tintColor }]}
          >
            <ThemedText style={styles.nextButtonText}>
              {isLastScreen ? 'Get Started' : 'Next'}
            </ThemedText>
          </Pressable>
        </View>
      </ThemedView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  skipButton: {
    position: 'absolute',
    zIndex: 10,
  },
  skipText: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  title: {
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    fontSize: 17,
    lineHeight: 24,
    textAlign: 'center',
    maxWidth: 320,
  },
  indicators: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 48,
  },
  indicator: {
    height: 8,
    borderRadius: 4,
  },
  footer: {
    paddingHorizontal: 32,
  },
  nextButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '600',
  },
});
