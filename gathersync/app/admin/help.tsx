import React, { useState } from 'react';
import { StyleSheet, ScrollView, View, Pressable, useWindowDimensions, LayoutAnimation, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';
import { AdminColors, AdminTypography, AdminSpacing, AdminBorderRadius, AdminShadows } from '@/constants/admin-theme';
import { DesktopLayout } from '@/components/desktop-layout';

interface HelpTopic {
  id: string;
  title: string;
  icon: any;
  content: React.ReactNode;
}

export default function HelpScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const [expandedTopic, setExpandedTopic] = useState<string | null>(null);

  const tintColor = useThemeColor({}, 'tint');

  const toggleTopic = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedTopic(expandedTopic === id ? null : id);
    if (expandedTopic !== id) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const topics: HelpTopic[] = [
    {
      id: 'getting-started',
      title: 'Getting Started',
      icon: 'star.fill',
      content: (
        <View style={styles.topicContent}>
          <ThemedText style={styles.paragraph}>
            Welcome to GatherSync! This application is designed to make event planning, participant management, and attendance tracking effortless.
          </ThemedText>
          <ThemedText style={styles.paragraph}>
            As an Administrator, you have access to this Dashboard where you can oversee all events, manage users, and generate detailed reports.
          </ThemedText>
        </View>
      ),
    },
    {
      id: 'creating-events',
      title: 'Creating & Managing Events',
      icon: 'calendar',
      content: (
        <View style={styles.topicContent}>
          <ThemedText style={styles.paragraph}>
            <ThemedText style={{ fontWeight: 'bold' }}>Flexible vs Fixed Events:</ThemedText>
          </ThemedText>
          <ThemedText style={styles.paragraph}>
            • <ThemedText style={{ fontWeight: 'bold' }}>Flexible Events:</ThemedText> Best for finding a date. Invitees receive a calendar where they mark their availability (Green=Available, Red=Unavailable). The system then highlights the "Best Days" with the highest attendance percentage.
          </ThemedText>
          <ThemedText style={styles.paragraph}>
            • <ThemedText style={{ fontWeight: 'bold' }}>Fixed Events:</ThemedText> Best when you already know the exact date and time. Invitees can quickly RSVP (Attending, Not Attending).
          </ThemedText>
          <ThemedText style={styles.paragraph}>
            <ThemedText style={{ fontWeight: 'bold' }}>To create an event:</ThemedText> Go to the Events tab, click the "+" button, and follow the wizard. You can add locations, virtual meeting links, and a Team Leader.
          </ThemedText>
        </View>
      ),
    },
    {
      id: 'templates-recurring',
      title: 'Templates & Recurring Events',
      icon: 'doc.on.doc',
      content: (
        <View style={styles.topicContent}>
          <ThemedText style={styles.paragraph}>
            <ThemedText style={{ fontWeight: 'bold' }}>Standard Templates:</ThemedText> Under the "Saves" tab, you can create and manage templates to instantly copy participants when creating a new event.
          </ThemedText>
          <ThemedText style={styles.paragraph}>
            <ThemedText style={{ fontWeight: 'bold' }}>Recurring Templates:</ThemedText> Also in the "Saves" tab, you can set up templates that automatically generate events on a schedule (e.g. "First Monday of every month" or "Weekly").
          </ThemedText>
          <ThemedText style={styles.paragraph}>
            • When creating a recurring template, use the <ThemedText style={{ fontWeight: 'bold' }}>Copy from Past Event</ThemedText> button to quickly import all details (including meeting type, location, link, and exact participant list) from a previous gathering.
          </ThemedText>
          <ThemedText style={styles.paragraph}>
            • GatherSync will automatically look ahead and generate the event for the correct upcoming date, saving you from having to recreate regular meetings.
          </ThemedText>
        </View>
      ),
    },
    {
      id: 'importing-participants',
      title: 'Importing Participants (CSV)',
      icon: 'arrow.up.doc',
      content: (
        <View style={styles.topicContent}>
          <ThemedText style={styles.paragraph}>
            For large gatherings like corporate events, weddings, or club meetings, you can bulk-import your invitees via a CSV file.
          </ThemedText>
          <ThemedText style={styles.paragraph}>
            1. Open any Event's details screen.
          </ThemedText>
          <ThemedText style={styles.paragraph}>
            2. Click the three dots "..." menu in the top right.
          </ThemedText>
          <ThemedText style={styles.paragraph}>
            3. Select <ThemedText style={{ fontWeight: 'bold' }}>Import Contact List (CSV)</ThemedText>.
          </ThemedText>
          <ThemedText style={styles.paragraph}>
            4. Prepare a spreadsheet with columns: <ThemedText style={{ fontStyle: 'italic' }}>Name, Phone, Email, Title/Designation, Company/Organization</ThemedText>.
          </ThemedText>
          <ThemedText style={styles.paragraph}>
            5. Copy/paste the data or select the file directly to instantly import everyone. GatherSync will automatically skip duplicates.
          </ThemedText>
        </View>
      ),
    },
    {
      id: 'communication',
      title: 'Sending Messages & Reminders',
      icon: 'paperplane.fill',
      content: (
        <View style={styles.topicContent}>
          <ThemedText style={styles.paragraph}>
            GatherSync makes it easy to communicate with your event participants.
          </ThemedText>
          <ThemedText style={styles.paragraph}>
            <ThemedText style={{ fontWeight: 'bold' }}>Custom Reminders:</ThemedText> On the event details page, you can draft a "Reminder Message". This message will be automatically prepended whenever you share the event link.
          </ThemedText>
          <ThemedText style={styles.paragraph}>
            <ThemedText style={{ fontWeight: 'bold' }}>Send Messages (SMS/Email):</ThemedText> From the event menu, select "Send Messages". Here you can quickly filter participants (e.g. "Select All Attending" or "Select No Response") and launch your phone's native Email or SMS app with a pre-filled invitation template!
          </ThemedText>
        </View>
      ),
    },
    {
      id: 'attendance',
      title: 'Tracking Attendance',
      icon: 'checkmark.circle.fill',
      content: (
        <View style={styles.topicContent}>
          <ThemedText style={styles.paragraph}>
            When a Fixed Event is happening, you can take live attendance:
          </ThemedText>
          <ThemedText style={styles.paragraph}>
            1. Open the Event Details and open the menu.
          </ThemedText>
          <ThemedText style={styles.paragraph}>
            2. Select <ThemedText style={{ fontWeight: 'bold' }}>Take / View Attendance</ThemedText>.
          </ThemedText>
          <ThemedText style={styles.paragraph}>
            3. Simply tap names to mark them as "Attended". Once saved, this feeds directly into your Analytics and Reports.
          </ThemedText>
        </View>
      ),
    },
    {
      id: 'reporting',
      title: 'Reporting & Exporting',
      icon: 'chart.bar.fill',
      content: (
        <View style={styles.topicContent}>
          <ThemedText style={styles.paragraph}>
            <ThemedText style={{ fontWeight: 'bold' }}>Analytics Dashboard:</ThemedText> Found in the Admin menu, this gives you a macro view of your organization's health—total participants, overall response rates, and a history of past events.
          </ThemedText>
          <ThemedText style={styles.paragraph}>
            <ThemedText style={{ fontWeight: 'bold' }}>Export Event to CSV:</ThemedText> Need to print name tags using Canva, Microsoft Word, or import into another CRM? Open an event's menu and select "Export Event to CSV". It generates a file with all contact details, titles, organizations, and their final RSVP/Attendance status!
          </ThemedText>
        </View>
      ),
    },
    {
      id: 'participant-management',
      title: 'Participant Management & CRM',
      icon: 'person.3.fill',
      content: (
        <View style={styles.topicContent}>
          <ThemedText style={styles.paragraph}>
            The <ThemedText style={{ fontWeight: 'bold' }}>Participant Management</ThemedText> screen is your master directory and built-in CRM. If you edit a participant's phone number or Title here, it syncs globally across all their events!
          </ThemedText>
          <ThemedText style={[styles.paragraph, { marginTop: 8 }]}>
            <ThemedText style={{ fontWeight: 'bold' }}>Using the Prospecting System:</ThemedText>
          </ThemedText>
          <ThemedText style={styles.paragraph}>
            • <ThemedText style={{ fontWeight: 'bold' }}>Add a Prospect:</ThemedText> Click "+", enter their details, and select "None (Add as Prospect)" as the event. They will be saved to your directory without creating an account.
          </ThemedText>
          <ThemedText style={styles.paragraph}>
            • <ThemedText style={{ fontWeight: 'bold' }}>Find Prospects:</ThemedText> Use the "Filter: All Events" button at the top and select "Prospects Only" to instantly view your leads.
          </ThemedText>
          <ThemedText style={styles.paragraph}>
            • <ThemedText style={{ fontWeight: 'bold' }}>Upgrade to User:</ThemedText> Open a prospect's details and scroll to the bottom. Click "Create Account & Send Link" to instantly generate a free GatherSync account and get a magic login link to email them!
          </ThemedText>
        </View>
      ),
    },
    {
      id: 'data-backup-recovery',
      title: 'Data Backup & Recovery',
      icon: 'arrow.triangle.2.circlepath',
      content: (
        <View style={styles.topicContent}>
          <ThemedText style={styles.paragraph}>
            Your event data is safely stored on your device, but it's important to know how the backup system works:
          </ThemedText>
          <ThemedText style={styles.paragraph}>
            <ThemedText style={{ fontWeight: 'bold' }}>Export / Import Backup:</ThemedText> From the main Events screen, you can export your entire database as a JSON file to your device. You can then use this file to restore your data later via "Import Backup". <ThemedText style={{ fontStyle: 'italic' }}>Note: Importing a backup completely overwrites your current data.</ThemedText>
          </ThemedText>
          <ThemedText style={styles.paragraph}>
            <ThemedText style={{ fontWeight: 'bold' }}>Single Event Backup:</ThemedText> Have an important event with a lot of transactions? Open that specific event, click the menu ("..."), and select <ThemedText style={{ fontWeight: 'bold' }}>Export Backup (Single Event)</ThemedText>. This lets you save the state of just one event without affecting the rest of your app.
          </ThemedText>
          <ThemedText style={styles.paragraph}>
            <ThemedText style={{ fontWeight: 'bold' }}>Automatic Backups & Data Recovery:</ThemedText> GatherSync automatically takes hidden "safety snapshots" before major actions (like importing data or syncing to the cloud). If something goes wrong, use the <ThemedText style={{ fontWeight: 'bold' }}>Data Recovery</ThemedText> tool to revert your app back to the exact moment before the action was taken.
          </ThemedText>
        </View>
      ),
    }
  ];

  return (
    <DesktopLayout>
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: Math.max(insets.top + 20, 40) }]}>
          <Pressable
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <IconSymbol name="chevron.left" size={24} color={AdminColors.primary} />
          </Pressable>
          <ThemedText style={styles.headerTitle}>Help & Tutorials</ThemedText>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          <View style={styles.introBox}>
            <IconSymbol name="book.fill" size={32} color={AdminColors.primary} />
            <ThemedText style={styles.introText}>
              Learn how to master GatherSync. Click on any topic below to view the guide.
            </ThemedText>
          </View>

          <View style={styles.topicsList}>
            {topics.map((topic) => (
              <View key={topic.id} style={styles.topicCard}>
                <Pressable
                  style={styles.topicHeader}
                  onPress={() => toggleTopic(topic.id)}
                >
                  <View style={styles.topicTitleRow}>
                    <View style={styles.iconContainer}>
                      <IconSymbol name={topic.icon} size={20} color={AdminColors.primary} />
                    </View>
                    <ThemedText style={styles.topicTitle}>{topic.title}</ThemedText>
                  </View>
                  <IconSymbol 
                    name={expandedTopic === topic.id ? "chevron.down" : "chevron.right" as any} 
                    size={20} 
                    color={AdminColors.gray400} 
                  />
                </Pressable>
                
                {expandedTopic === topic.id && topic.content}
              </View>
            ))}
          </View>

          <View style={styles.supportBox}>
            <ThemedText style={styles.supportTitle}>Need more help?</ThemedText>
            <ThemedText style={styles.supportText}>
              If you have any further questions or feature requests, please reach out to our support team. We're always looking for ways to improve GatherSync!
            </ThemedText>
          </View>
        </ScrollView>
      </View>
    </DesktopLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AdminColors.gray50,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: AdminSpacing.xl,
    paddingBottom: AdminSpacing.xl,
    backgroundColor: AdminColors.surface,
    ...Platform.select({
      web: { boxShadow: AdminShadows.sm },
      default: { elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4 },
    }),
    zIndex: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: AdminColors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: AdminTypography.xl,
    fontWeight: AdminTypography.bold as any,
    color: AdminColors.gray900,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: AdminSpacing.xl,
    maxWidth: 800,
    width: '100%',
    alignSelf: 'center',
    paddingBottom: 100,
  },
  introBox: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: AdminSpacing['2xl'],
    backgroundColor: AdminColors.primaryLight,
    borderRadius: AdminBorderRadius.xl,
    marginBottom: AdminSpacing.xl,
    gap: AdminSpacing.md,
  },
  introText: {
    textAlign: 'center',
    color: AdminColors.primaryHover,
    fontSize: AdminTypography.base,
    lineHeight: 22,
  },
  topicsList: {
    gap: AdminSpacing.md,
  },
  topicCard: {
    backgroundColor: AdminColors.surface,
    borderRadius: AdminBorderRadius.lg,
    overflow: 'hidden',
    ...Platform.select({
      web: { boxShadow: AdminShadows.sm },
      default: { elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2 },
    }),
  },
  topicHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: AdminSpacing.lg,
  },
  topicTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: AdminSpacing.md,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: AdminColors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topicTitle: {
    fontSize: AdminTypography.lg,
    fontWeight: AdminTypography.semibold as any,
    color: AdminColors.gray900,
  },
  topicContent: {
    padding: AdminSpacing.lg,
    paddingTop: 0,
    paddingLeft: 68, // Aligns text with the title, accounting for icon + gap
    gap: AdminSpacing.sm,
  },
  paragraph: {
    fontSize: AdminTypography.base,
    color: AdminColors.gray600,
    lineHeight: 24,
  },
  supportBox: {
    marginTop: AdminSpacing['2xl'],
    padding: AdminSpacing.xl,
    backgroundColor: AdminColors.surface,
    borderRadius: AdminBorderRadius.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: AdminColors.gray200,
  },
  supportTitle: {
    fontSize: AdminTypography.lg,
    fontWeight: AdminTypography.semibold as any,
    color: AdminColors.gray900,
    marginBottom: AdminSpacing.sm,
  },
  supportText: {
    textAlign: 'center',
    color: AdminColors.gray600,
    fontSize: AdminTypography.sm,
    lineHeight: 20,
  },
});