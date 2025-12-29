import { StyleSheet, View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';

export default function AboutScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const backgroundColor = useThemeColor({}, 'background');
  const textSecondaryColor = useThemeColor({}, 'textSecondary');

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
          style={styles.backButton}
        >
          <IconSymbol name="chevron.left" size={24} color={useThemeColor({}, 'text')} />
        </Pressable>
        <ThemedText type="title" style={styles.headerTitle}>
          About
        </ThemedText>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <IconSymbol name="calendar" size={80} color={useThemeColor({}, 'tint')} />
          <ThemedText type="title" style={styles.appName}>
            GatherSync
          </ThemedText>
          <ThemedText style={[styles.version, { color: textSecondaryColor }]}>
            Version 1.0.0
          </ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            About GatherSync
          </ThemedText>
          <ThemedText style={[styles.description, { color: textSecondaryColor }]}>
            GatherSync helps you find the perfect date for group gatherings by visualizing
            everyone's availability with an intelligent heatmap. Perfect for book clubs, team
            meetings, family events, and community groups.
          </ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Copyright & Legal
          </ThemedText>
          <ThemedText style={[styles.copyright, { color: textSecondaryColor }]}>
            © 2025 Peter Scarfo. All rights reserved.
          </ThemedText>
          <ThemedText style={[styles.legalText, { color: textSecondaryColor }]}>
            This application and its contents are protected by copyright law. Unauthorized
            reproduction, distribution, or modification is prohibited.
          </ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Contact
          </ThemedText>
          <ThemedText style={[styles.contactText, { color: textSecondaryColor }]}>
            For support or inquiries, please contact the developer.
          </ThemedText>
        </View>
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
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 20,
    lineHeight: 28,
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 24,
  },
  logoContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  appName: {
    marginTop: 16,
    fontSize: 28,
    lineHeight: 36,
  },
  version: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
  },
  section: {
    marginTop: 32,
  },
  sectionTitle: {
    marginBottom: 12,
    fontSize: 18,
    lineHeight: 24,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
  },
  copyright: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
  },
  legalText: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  contactText: {
    fontSize: 15,
    lineHeight: 22,
  },
});
