import React, { useRef, useState } from 'react';
import { StyleSheet, ScrollView, View, Pressable, Platform, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { AdminColors, AdminTypography, AdminSpacing, AdminBorderRadius, AdminShadows } from '@/constants/admin-theme';
import { DesktopLayout } from '@/components/desktop-layout';

export default function UserManualScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const scrollViewRef = useRef<ScrollView>(null);
  const [sectionLayouts, setSectionLayouts] = useState<Record<string, number>>({});

  const handleLayout = (id: string) => (event: any) => {
    const { y } = event.nativeEvent.layout;
    setSectionLayouts(prev => ({ ...prev, [id]: y }));
  };

  const scrollToSection = (id: string) => {
    const y = sectionLayouts[id];
    if (y !== undefined && scrollViewRef.current) {
      scrollViewRef.current.scrollTo({ y, animated: true });
    }
  };

  return (
    <DesktopLayout>
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: Math.max(insets.top + 20, 40) }]}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <IconSymbol name="chevron.left" size={24} color={AdminColors.primary} />
          </Pressable>
          <ThemedText style={styles.headerTitle}>User Manual</ThemedText>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView ref={scrollViewRef} style={styles.content} contentContainerStyle={styles.contentContainer}>
          <ThemedText style={styles.h1}>GatherSync: Step-by-Step User Manual</ThemedText>
          <ThemedText style={styles.paragraph}>Welcome to GatherSync! This guide will walk you through everything you need to know to schedule events, manage participants, and organize your gatherings without the usual email chains and group text headaches.</ThemedText>
          <View style={styles.divider} />
          <View onLayout={handleLayout('table-of-contents')}><ThemedText style={styles.h2}>Table of Contents</ThemedText></View>
          <Pressable onPress={() => scrollToSection('1-getting-started')} style={({pressed}) => [styles.tocLink, pressed && {opacity: 0.7}]}>
            <ThemedText style={styles.tocLinkText}>• Getting Started</ThemedText>
          </Pressable>
          <Pressable onPress={() => scrollToSection('2-creating-your-first-event')} style={({pressed}) => [styles.tocLink, pressed && {opacity: 0.7}]}>
            <ThemedText style={styles.tocLinkText}>• Creating Your First Event</ThemedText>
          </Pressable>
          <Pressable onPress={() => scrollToSection('3-the-event-actions-menu')} style={({pressed}) => [styles.tocLink, pressed && {opacity: 0.7}]}>
            <ThemedText style={styles.tocLinkText}>• The Event Actions Menu</ThemedText>
          </Pressable>
          <Pressable onPress={() => scrollToSection('4-adding-participants')} style={({pressed}) => [styles.tocLink, pressed && {opacity: 0.7}]}>
            <ThemedText style={styles.tocLinkText}>• Adding Participants</ThemedText>
          </Pressable>
          <Pressable onPress={() => scrollToSection('5-sending-invitations')} style={({pressed}) => [styles.tocLink, pressed && {opacity: 0.7}]}>
            <ThemedText style={styles.tocLinkText}>• Sending Invitations</ThemedText>
          </Pressable>
          <Pressable onPress={() => scrollToSection('6-tracking-responses-finalizing')} style={({pressed}) => [styles.tocLink, pressed && {opacity: 0.7}]}>
            <ThemedText style={styles.tocLinkText}>• Tracking Responses & Finalizing</ThemedText>
          </Pressable>
          <Pressable onPress={() => scrollToSection('7-receiving-responding-to-invitations-the-invitee-experience')} style={({pressed}) => [styles.tocLink, pressed && {opacity: 0.7}]}>
            <ThemedText style={styles.tocLinkText}>• Receiving & Responding to Invitations</ThemedText>
          </Pressable>
          <Pressable onPress={() => scrollToSection('8-using-templates-duplicating-events')} style={({pressed}) => [styles.tocLink, pressed && {opacity: 0.7}]}>
            <ThemedText style={styles.tocLinkText}>• Using Templates & Duplicating Events</ThemedText>
          </Pressable>
          <Pressable onPress={() => scrollToSection('9-managing-prospects-crm-features')} style={({pressed}) => [styles.tocLink, pressed && {opacity: 0.7}]}>
            <ThemedText style={styles.tocLinkText}>• Managing Prospects (CRM Features)</ThemedText>
          </Pressable>
          <Pressable onPress={() => scrollToSection('10-data-backup-recovery')} style={({pressed}) => [styles.tocLink, pressed && {opacity: 0.7}]}>
            <ThemedText style={styles.tocLinkText}>• Data Backup & Recovery</ThemedText>
          </Pressable>
          <Pressable onPress={() => scrollToSection('11-advanced-features-settings')} style={({pressed}) => [styles.tocLink, pressed && {opacity: 0.7}]}>
            <ThemedText style={styles.tocLinkText}>• Advanced Features & Settings</ThemedText>
          </Pressable>
          <View style={styles.divider} />
          <View onLayout={handleLayout('1-getting-started')}><ThemedText style={styles.h2}>1. Getting Started</ThemedText></View>
          <View onLayout={handleLayout('accessing-the-app')}><ThemedText style={styles.h3}>Accessing the App</ThemedText></View>
          <View style={styles.listItem}><ThemedText style={styles.listBullet}>•</ThemedText><ThemedText style={styles.paragraph}>Navigate to <ThemedText style={{fontWeight: "bold"}}>app.gathersync.app</ThemedText> in your web browser. (GatherSync is a fully responsive web application, so there is no need to download anything from an App Store).</ThemedText></View>
          <View style={styles.listItem}><ThemedText style={styles.listBullet}>•</ThemedText><ThemedText style={styles.paragraph}>Click the <ThemedText style={{fontWeight: "bold"}}>Profile</ThemedText> icon in the top right corner (or the <ThemedText style={{fontWeight: "bold"}}>Log In</ThemedText> button on the banner).</ThemedText></View>
          <View style={styles.listItem}><ThemedText style={styles.listBullet}>•</ThemedText><ThemedText style={styles.paragraph}>Enter your email address to receive a secure "Magic Link" to log in password-free.</ThemedText></View>
          <View style={styles.listItem}><ThemedText style={styles.listBullet}>•</ThemedText><ThemedText style={styles.paragraph}>Once logged in, you will be taken to your <ThemedText style={{fontWeight: "bold"}}>Events Dashboard</ThemedText>, which displays all your active and upcoming events.</ThemedText></View>
          <View style={styles.divider} />
          <View onLayout={handleLayout('2-creating-your-first-event')}><ThemedText style={styles.h2}>2. Creating Your First Event</ThemedText></View>
          <ThemedText style={styles.paragraph}>GatherSync supports two types of events: <ThemedText style={{fontWeight: "bold"}}>Flexible</ThemedText> (to find the best day) and <ThemedText style={{fontWeight: "bold"}}>Fixed</ThemedText> (when you already know the date and time).</ThemedText>
          <View onLayout={handleLayout('step-by-step')}><ThemedText style={styles.h3}>Step-by-Step:</ThemedText></View>
          <View style={styles.listItem}><ThemedText style={styles.listBullet}>•</ThemedText><ThemedText style={styles.paragraph}>From the <ThemedText style={{fontWeight: "bold"}}>Events</ThemedText> tab, click the <ThemedText style={{fontWeight: "bold"}}>+ Create Event</ThemedText> button (or the floating <ThemedText style={{fontWeight: "bold"}}>+</ThemedText> button).</ThemedText></View>
          <View style={styles.listItem}><ThemedText style={styles.listBullet}>•</ThemedText><ThemedText style={styles.paragraph}><ThemedText style={{fontWeight: "bold"}}>Enter Event Details:</ThemedText></ThemedText></View>
          <ThemedText style={styles.paragraph}>   * <ThemedText style={{fontWeight: "bold"}}>Event Name:</ThemedText> Give your gathering a clear title (e.g., "Monthly Mastermind" or "Team Dinner").</ThemedText>
          <ThemedText style={styles.paragraph}>   * <ThemedText style={{fontWeight: "bold"}}>Meeting Type:</ThemedText> Choose between <ThemedText style={{fontWeight: "bold"}}>In-Person</ThemedText> or <ThemedText style={{fontWeight: "bold"}}>Virtual</ThemedText>.</ThemedText>
          <ThemedText style={styles.paragraph}>     <ThemedText style={{fontStyle: "italic"}}> </ThemedText>In-Person:* Add the Venue Name and Address.</ThemedText>
          <ThemedText style={styles.paragraph}>     <ThemedText style={{fontStyle: "italic"}}> </ThemedText>Virtual:* Add your Zoom, Google Meet, or Teams link.</ThemedText>
          <ThemedText style={styles.paragraph}>   * <ThemedText style={{fontWeight: "bold"}}>Meeting Notes:</ThemedText> Add an agenda or any instructions for attendees.</ThemedText>
          <ThemedText style={styles.paragraph}>   * <ThemedText style={{fontWeight: "bold"}}>Minimum Attendance (Quorum):</ThemedText> Set a required number or percentage of attendees for the event to proceed.</ThemedText>
          <View style={styles.listItem}><ThemedText style={styles.listBullet}>•</ThemedText><ThemedText style={styles.paragraph}><ThemedText style={{fontWeight: "bold"}}>Choose Event Type:</ThemedText></ThemedText></View>
          <ThemedText style={styles.paragraph}>   * <ThemedText style={{fontWeight: "bold"}}>Flexible (Find a Date):</ThemedText> Select the Month and Year. Participants will be able to tap all the days they are free so the system can calculate the best day.</ThemedText>
          <ThemedText style={styles.paragraph}>   * <ThemedText style={{fontWeight: "bold"}}>Fixed (Set Date & Time):</ThemedText> Select the exact Date and Time. Participants will simply RSVP "Attending" or "Not Attending".</ThemedText>
          <View style={styles.listItem}><ThemedText style={styles.listBullet}>•</ThemedText><ThemedText style={styles.paragraph}>Click <ThemedText style={{fontWeight: "bold"}}>Save Event</ThemedText>.</ThemedText></View>
          <View style={styles.divider} />
          <View onLayout={handleLayout('3-the-event-actions-menu')}><ThemedText style={styles.h2}>3. The Event Actions Menu</ThemedText></View>
          <ThemedText style={styles.paragraph}>In the top right corner of any event, the <ThemedText style={{fontWeight: "bold"}}>Actions</ThemedText> button ("...") opens a powerful menu with everything you need to manage your gathering. Here is what each option does:</ThemedText>
          <View onLayout={handleLayout('event-management')}><ThemedText style={styles.h3}>EVENT MANAGEMENT</ThemedText></View>
          <View style={styles.listItem}><ThemedText style={styles.listBullet}>-</ThemedText><ThemedText style={styles.paragraph}>  <ThemedText style={{fontWeight: "bold"}}>Edit Event:</ThemedText> Change the name, date, time, location, or privacy settings.</ThemedText></View>
          <View style={styles.listItem}><ThemedText style={styles.listBullet}>-</ThemedText><ThemedText style={styles.paragraph}>  <ThemedText style={{fontWeight: "bold"}}>Copy Event:</ThemedText> Instantly duplicates this event (including all participants) to a new date. Great for recurring meetings!</ThemedText></View>
          <View style={styles.listItem}><ThemedText style={styles.listBullet}>-</ThemedText><ThemedText style={styles.paragraph}>  <ThemedText style={{fontWeight: "bold"}}>Copy Event Details:</ThemedText> Copies a text summary of the event (and the attendee list) to your clipboard so you can paste it into an email or document.</ThemedText></View>
          <View onLayout={handleLayout('participants-communication')}><ThemedText style={styles.h3}>PARTICIPANTS & COMMUNICATION</ThemedText></View>
          <View style={styles.listItem}><ThemedText style={styles.listBullet}>-</ThemedText><ThemedText style={styles.paragraph}>  <ThemedText style={{fontWeight: "bold"}}>Take / View Attendance:</ThemedText> Opens a checklist to mark who actually showed up to a Fixed Event.</ThemedText></View>
          <View style={styles.listItem}><ThemedText style={styles.listBullet}>-</ThemedText><ThemedText style={styles.paragraph}>  <ThemedText style={{fontWeight: "bold"}}>Invite Participants:</ThemedText> Generates a generic public link you can share anywhere for people to RSVP.</ThemedText></View>
          <View style={styles.listItem}><ThemedText style={styles.listBullet}>-</ThemedText><ThemedText style={styles.paragraph}>  <ThemedText style={{fontWeight: "bold"}}>Send Messages (SMS/Email):</ThemedText> Opens a screen where you can select specific participants and choose to send them an SMS, a Native Email (which opens your default email client with their addresses in Bcc), or an App Email (which uses GatherSync&apos;s built-in system to send beautiful, personalized invitations).</ThemedText></View>
          <View style={styles.listItem}><ThemedText style={styles.listBullet}>-</ThemedText><ThemedText style={styles.paragraph}>  <ThemedText style={{fontWeight: "bold"}}>Import Contact List (CSV):</ThemedText> Bulk-add hundreds of participants at once using a spreadsheet.</ThemedText></View>
          <View style={styles.listItem}><ThemedText style={styles.listBullet}>-</ThemedText><ThemedText style={styles.paragraph}>  <ThemedText style={{fontWeight: "bold"}}>Bulk Import Availability:</ThemedText> Upload a spreadsheet containing people&apos;s availability for a Flexible Event.</ThemedText></View>
          <View onLayout={handleLayout('share-export')}><ThemedText style={styles.h3}>SHARE & EXPORT</ThemedText></View>
          <View style={styles.listItem}><ThemedText style={styles.listBullet}>-</ThemedText><ThemedText style={styles.paragraph}>  <ThemedText style={{fontWeight: "bold"}}>Share Event:</ThemedText> Opens your device&apos;s native share sheet to send the event link via WhatsApp, iMessage, etc.</ThemedText></View>
          <View style={styles.listItem}><ThemedText style={styles.listBullet}>-</ThemedText><ThemedText style={styles.paragraph}>  <ThemedText style={{fontWeight: "bold"}}>Share with Participants:</ThemedText> Sends the event details specifically to the people already on the list.</ThemedText></View>
          <View style={styles.listItem}><ThemedText style={styles.listBullet}>-</ThemedText><ThemedText style={styles.paragraph}>  <ThemedText style={{fontWeight: "bold"}}>Export to Calendar:</ThemedText> Downloads an .ics file so you can add the event to your Google Calendar, Outlook, or Apple Calendar.</ThemedText></View>
          <View style={styles.listItem}><ThemedText style={styles.listBullet}>-</ThemedText><ThemedText style={styles.paragraph}>  <ThemedText style={{fontWeight: "bold"}}>Export Event to CSV:</ThemedText> Downloads a spreadsheet of all attendees, their contact info, and their RSVP status.</ThemedText></View>
          <View style={styles.listItem}><ThemedText style={styles.listBullet}>-</ThemedText><ThemedText style={styles.paragraph}>  <ThemedText style={{fontWeight: "bold"}}>Export Backup (Single Event):</ThemedText> Downloads a raw JSON data file of this specific event for safekeeping.</ThemedText></View>
          <View style={styles.divider} />
          <View onLayout={handleLayout('4-adding-participants')}><ThemedText style={styles.h2}>4. Adding Participants</ThemedText></View>
          <ThemedText style={styles.paragraph}>Once your event is created, you need to add the people you want to invite.</ThemedText>
          <View style={styles.listItem}><ThemedText style={styles.listBullet}>•</ThemedText><ThemedText style={styles.paragraph}>Open your newly created event from the dashboard.</ThemedText></View>
          <View style={styles.listItem}><ThemedText style={styles.listBullet}>•</ThemedText><ThemedText style={styles.paragraph}>Scroll down to the <ThemedText style={{fontWeight: "bold"}}>Participants</ThemedText> section and click <ThemedText style={{fontWeight: "bold"}}>Add Participants</ThemedText>.</ThemedText></View>
          <View style={styles.listItem}><ThemedText style={styles.listBullet}>•</ThemedText><ThemedText style={styles.paragraph}>You can add people in three ways:</ThemedText></View>
          <ThemedText style={styles.paragraph}>   * <ThemedText style={{fontWeight: "bold"}}>From Directory:</ThemedText> Select existing contacts you&apos;ve invited to previous events. (Note: GatherSync does not import contacts directly from your phone&apos;s address book, as it is a web-based application).</ThemedText>
          <ThemedText style={styles.paragraph}>   * <ThemedText style={{fontWeight: "bold"}}>Add New:</ThemedText> Enter their details manually. </ThemedText>
          <ThemedText style={styles.paragraph}>     * <ThemedText style={{fontWeight: "bold"}}>Name:</ThemedText> (Required)</ThemedText>
          <ThemedText style={styles.paragraph}>     * <ThemedText style={{fontWeight: "bold"}}>Event:</ThemedText> (If left blank, they will be added as a <ThemedText style={{fontWeight: "bold"}}>Prospect</ThemedText>)</ThemedText>
          <ThemedText style={styles.paragraph}>     * <ThemedText style={{fontWeight: "bold"}}>Phone & Email:</ThemedText> (Optional)</ThemedText>
          <ThemedText style={styles.paragraph}>     * <ThemedText style={{fontWeight: "bold"}}>Title/Designation & Company:</ThemedText> (Optional)</ThemedText>
          <ThemedText style={styles.paragraph}>     * <ThemedText style={{fontWeight: "bold"}}>Digital Twin URL:</ThemedText> (Optional) Add a link to their GetBizCard, LinkedIn, or personal website. This will automatically create a beautiful "Featured Profile" for them at the top of the public event page!</ThemedText>
          <ThemedText style={styles.paragraph}>   * <ThemedText style={{fontWeight: "bold"}}>Import Contact List (CSV):</ThemedText> For large gatherings, click the "..." menu in the top right of the event and select <ThemedText style={{fontWeight: "bold"}}>Import Contact List (CSV)</ThemedText>. You can paste or upload a spreadsheet to instantly import hundreds of people at once. For flexible events, you can even include columns for Day 1, Day 2, and Day 3 to automatically set their availability!</ThemedText>
          <View style={styles.listItem}><ThemedText style={styles.listBullet}>•</ThemedText><ThemedText style={styles.paragraph}><ThemedText style={{fontStyle: "italic"}}>Note: Anyone you add is automatically saved to your global Participant Directory for easy access next time.</ThemedText></ThemedText></View>
          <View style={styles.divider} />
          <View onLayout={handleLayout('5-sending-invitations')}><ThemedText style={styles.h2}>5. Sending Invitations</ThemedText></View>
          <ThemedText style={styles.paragraph}>GatherSync makes it incredibly easy to send invitations out to your group.</ThemedText>
          <View onLayout={handleLayout('option-a-mass-email-built-in')}><ThemedText style={styles.h3}>Option A: Mass Email (Built-in)</ThemedText></View>
          <View style={styles.listItem}><ThemedText style={styles.listBullet}>•</ThemedText><ThemedText style={styles.paragraph}>Open your event.</ThemedText></View>
          <View style={styles.listItem}><ThemedText style={styles.listBullet}>•</ThemedText><ThemedText style={styles.paragraph}>Click the <ThemedText style={{fontWeight: "bold"}}>Email All Participants</ThemedText> button.</ThemedText></View>
          <View style={styles.listItem}><ThemedText style={styles.listBullet}>•</ThemedText><ThemedText style={styles.paragraph}>GatherSync will use its automated email system to send beautiful, personalized invitations directly to everyone on the list, including their unique RSVP link.</ThemedText></View>
          <View onLayout={handleLayout('option-b-send-messages-sms-or-native-email')}><ThemedText style={styles.h3}>Option B: Send Messages (SMS or Native Email)</ThemedText></View>
          <View style={styles.listItem}><ThemedText style={styles.listBullet}>•</ThemedText><ThemedText style={styles.paragraph}>Open your event and click the "..." menu in the top right.</ThemedText></View>
          <View style={styles.listItem}><ThemedText style={styles.listBullet}>•</ThemedText><ThemedText style={styles.paragraph}>Select <ThemedText style={{fontWeight: "bold"}}>Send Messages</ThemedText>.</ThemedText></View>
          <View style={styles.listItem}><ThemedText style={styles.listBullet}>•</ThemedText><ThemedText style={styles.paragraph}>You can quickly filter participants (e.g., "Select All Attending" or "Select No Response").</ThemedText></View>
          <View style={styles.listItem}><ThemedText style={styles.listBullet}>•</ThemedText><ThemedText style={styles.paragraph}>Choose to send via SMS or Email. This will launch your phone or computer&apos;s native messaging app (like Apple Messages or Outlook) with a pre-filled invitation template!</ThemedText></View>
          <View onLayout={handleLayout('option-c-shareable-link')}><ThemedText style={styles.h3}>Option C: Shareable Link</ThemedText></View>
          <View style={styles.listItem}><ThemedText style={styles.listBullet}>•</ThemedText><ThemedText style={styles.paragraph}>Open your event.</ThemedText></View>
          <View style={styles.listItem}><ThemedText style={styles.listBullet}>•</ThemedText><ThemedText style={styles.paragraph}>Click <ThemedText style={{fontWeight: "bold"}}>Share Link</ThemedText> or <ThemedText style={{fontWeight: "bold"}}>Copy Link</ThemedText>.</ThemedText></View>
          <View style={styles.listItem}><ThemedText style={styles.listBullet}>•</ThemedText><ThemedText style={styles.paragraph}>Paste this link into a WhatsApp group, Slack channel, or text message thread.</ThemedText></View>
          <View style={styles.listItem}><ThemedText style={styles.listBullet}>•</ThemedText><ThemedText style={styles.paragraph}>When people click the link, they just type their name and submit their availability.</ThemedText></View>
          <View style={styles.divider} />
          <View onLayout={handleLayout('6-tracking-responses-finalizing')}><ThemedText style={styles.h2}>6. Tracking Responses & Finalizing</ThemedText></View>
          <ThemedText style={styles.paragraph}>As people respond, GatherSync does the math for you.</ThemedText>
          <View onLayout={handleLayout('for-flexible-events')}><ThemedText style={styles.h3}>For Flexible Events:</ThemedText></View>
          <View style={styles.listItem}><ThemedText style={styles.listBullet}>•</ThemedText><ThemedText style={styles.paragraph}>Open the event to view the calendar grid.</ThemedText></View>
          <View style={styles.listItem}><ThemedText style={styles.listBullet}>•</ThemedText><ThemedText style={styles.paragraph}>Days with the most availability will be highlighted in green (the "Best Day").</ThemedText></View>
          <View style={styles.listItem}><ThemedText style={styles.listBullet}>•</ThemedText><ThemedText style={styles.paragraph}>Click on any day to see exactly <ThemedText style={{fontStyle: "italic"}}>who</ThemedText> is free and who isn&apos;t.</ThemedText></View>
          <View style={styles.listItem}><ThemedText style={styles.listBullet}>•</ThemedText><ThemedText style={styles.paragraph}>Once you&apos;ve found the perfect day, click <ThemedText style={{fontWeight: "bold"}}>Finalize Event</ThemedText>, select the winning date, and notify your attendees!</ThemedText></View>
          <View onLayout={handleLayout('for-fixed-events')}><ThemedText style={styles.h3}>For Fixed Events:</ThemedText></View>
          <View style={styles.listItem}><ThemedText style={styles.listBullet}>•</ThemedText><ThemedText style={styles.paragraph}>Open the event to see a summary of RSVPs.</ThemedText></View>
          <View style={styles.listItem}><ThemedText style={styles.listBullet}>•</ThemedText><ThemedText style={styles.paragraph}>You will see a clear breakdown of <ThemedText style={{fontWeight: "bold"}}>Attending</ThemedText>, <ThemedText style={{fontWeight: "bold"}}>Not Attending</ThemedText>, and <ThemedText style={{fontWeight: "bold"}}>No Response</ThemedText>.</ThemedText></View>
          <View onLayout={handleLayout('taking-live-attendance')}><ThemedText style={styles.h3}>Taking Live Attendance:</ThemedText></View>
          <ThemedText style={styles.paragraph}>When a Fixed Event is actually happening, you can take live attendance:</ThemedText>
          <View style={styles.listItem}><ThemedText style={styles.listBullet}>•</ThemedText><ThemedText style={styles.paragraph}>Open the Event Details and click the "..." menu.</ThemedText></View>
          <View style={styles.listItem}><ThemedText style={styles.listBullet}>•</ThemedText><ThemedText style={styles.paragraph}>Select <ThemedText style={{fontWeight: "bold"}}>Take / View Attendance</ThemedText>.</ThemedText></View>
          <View style={styles.listItem}><ThemedText style={styles.listBullet}>•</ThemedText><ThemedText style={styles.paragraph}>Simply tap names to mark them as "Attended". Once saved, this feeds directly into your Analytics and Reports.</ThemedText></View>
          <View style={styles.divider} />
          <View onLayout={handleLayout('7-receiving-responding-to-invitations-the-invitee-experience')}><ThemedText style={styles.h2}>7. Receiving & Responding to Invitations (The Invitee Experience)</ThemedText></View>
          <ThemedText style={styles.paragraph}>When you invite others to an event, they also get a seamless experience if they use GatherSync.</ThemedText>
          <View onLayout={handleLayout('events-i-apos-m-invited-to')}><ThemedText style={styles.h3}>Events I&apos;m Invited To</ThemedText></View>
          <ThemedText style={styles.paragraph}>When an invitee RSVPs to your event using their email address, that event will automatically appear on their own GatherSync dashboard under the <ThemedText style={{fontWeight: "bold"}}>"Events I&apos;m Invited To"</ThemedText> section. This keeps all their invitations organized in one place.</ThemedText>
          <View onLayout={handleLayout('managing-their-own-record')}><ThemedText style={styles.h3}>Managing Their Own Record</ThemedText></View>
          <ThemedText style={styles.paragraph}>Invitees can click on the event from their dashboard to view the full details. They can then click on their own name in the participant list to edit their record.</ThemedText>
          <View onLayout={handleLayout('editing-details-adding-notes')}><ThemedText style={styles.h3}>Editing Details & Adding Notes</ThemedText></View>
          <ThemedText style={styles.paragraph}>Invitees have full control over their own profile for that event. For example, if you added them as "Peter S", they have the ability to change it to their full name. They can also:</ThemedText>
          <View style={styles.listItem}><ThemedText style={styles.listBullet}>-</ThemedText><ThemedText style={styles.paragraph}>  Update their phone number or email address.</ThemedText></View>
          <View style={styles.listItem}><ThemedText style={styles.listBullet}>-</ThemedText><ThemedText style={styles.paragraph}>  Add their Digital Twin URL.</ThemedText></View>
          <View style={styles.listItem}><ThemedText style={styles.listBullet}>-</ThemedText><ThemedText style={styles.paragraph}>  Add Notes (e.g., "Can only arrive after 6pm" or "Bringing a +1").</ThemedText></View>
          <View style={styles.listItem}><ThemedText style={styles.listBullet}>-</ThemedText><ThemedText style={styles.paragraph}>  Update their availability or RSVP status at any time.</ThemedText></View>
          <ThemedText style={styles.paragraph}>Any changes they make will automatically sync back to your organizer dashboard!</ThemedText>
          <View style={styles.divider} />
          <View onLayout={handleLayout('8-using-templates-duplicating-events')}><ThemedText style={styles.h2}>8. Using Templates & Duplicating Events</ThemedText></View>
          <ThemedText style={styles.paragraph}>If you host regular meetings with the same group (e.g., a weekly Zoom call or a monthly dinner), you don&apos;t need to start from scratch.</ThemedText>
          <View onLayout={handleLayout('duplicating-an-event')}><ThemedText style={styles.h3}>Duplicating an Event:</ThemedText></View>
          <View style={styles.listItem}><ThemedText style={styles.listBullet}>•</ThemedText><ThemedText style={styles.paragraph}>Open a past event.</ThemedText></View>
          <View style={styles.listItem}><ThemedText style={styles.listBullet}>•</ThemedText><ThemedText style={styles.paragraph}>Click the <ThemedText style={{fontWeight: "bold"}}>Copy Event</ThemedText> button.</ThemedText></View>
          <View style={styles.listItem}><ThemedText style={styles.listBullet}>•</ThemedText><ThemedText style={styles.paragraph}>This instantly clones the event, keeping the entire participant list, venue details, and meeting links. Just update the date/month and you&apos;re ready to send!</ThemedText></View>
          <View onLayout={handleLayout('creating-a-group-template')}><ThemedText style={styles.h3}>Creating a Group Template:</ThemedText></View>
          <View style={styles.listItem}><ThemedText style={styles.listBullet}>•</ThemedText><ThemedText style={styles.paragraph}>Go to the <ThemedText style={{fontWeight: "bold"}}>Saves</ThemedText> tab from the main menu.</ThemedText></View>
          <View style={styles.listItem}><ThemedText style={styles.listBullet}>•</ThemedText><ThemedText style={styles.paragraph}>Select <ThemedText style={{fontWeight: "bold"}}>Templates</ThemedText>.</ThemedText></View>
          <View style={styles.listItem}><ThemedText style={styles.listBullet}>•</ThemedText><ThemedText style={styles.paragraph}>Use the <ThemedText style={{fontWeight: "bold"}}>Actions Button</ThemedText> to select <ThemedText style={{fontWeight: "bold"}}>Create Template</ThemedText>, give it a name (e.g., "Marketing Team"), and add the relevant participants.</ThemedText></View>
          <View style={styles.listItem}><ThemedText style={styles.listBullet}>•</ThemedText><ThemedText style={styles.paragraph}>Next time you create an event, you can apply this template to instantly add everyone at once.</ThemedText></View>
          <View onLayout={handleLayout('creating-a-recurring-template')}><ThemedText style={styles.h3}>Creating a Recurring Template:</ThemedText></View>
          <View style={styles.listItem}><ThemedText style={styles.listBullet}>•</ThemedText><ThemedText style={styles.paragraph}>Go to the <ThemedText style={{fontWeight: "bold"}}>Saves</ThemedText> tab and select <ThemedText style={{fontWeight: "bold"}}>Recurring</ThemedText>.</ThemedText></View>
          <View style={styles.listItem}><ThemedText style={styles.listBullet}>•</ThemedText><ThemedText style={styles.paragraph}>Set up a schedule (e.g., "First Monday of every month").</ThemedText></View>
          <View style={styles.listItem}><ThemedText style={styles.listBullet}>•</ThemedText><ThemedText style={styles.paragraph}>Use the <ThemedText style={{fontWeight: "bold"}}>Copy from Past Event</ThemedText> button to instantly import all details (meeting type, location, link, and exact participant list) from a previous gathering.</ThemedText></View>
          <View style={styles.listItem}><ThemedText style={styles.listBullet}>•</ThemedText><ThemedText style={styles.paragraph}>GatherSync will automatically look ahead and generate the event for the correct upcoming date, saving you from having to recreate regular meetings!</ThemedText></View>
          <View style={styles.divider} />
          <View onLayout={handleLayout('9-managing-prospects-crm-features')}><ThemedText style={styles.h2}>9. Managing Prospects (CRM Features)</ThemedText></View>
          <ThemedText style={styles.paragraph}>GatherSync acts as a lightweight CRM to help you manage leads and network connections.</ThemedText>
          <View style={styles.listItem}><ThemedText style={styles.listBullet}>•</ThemedText><ThemedText style={styles.paragraph}>Go to the <ThemedText style={{fontWeight: "bold"}}>Dashboard</ThemedText> (Admin) tab.</ThemedText></View>
          <View style={styles.listItem}><ThemedText style={styles.listBullet}>•</ThemedText><ThemedText style={styles.paragraph}>Click on <ThemedText style={{fontWeight: "bold"}}>Participant Directory</ThemedText>.</ThemedText></View>
          <View style={styles.listItem}><ThemedText style={styles.listBullet}>•</ThemedText><ThemedText style={styles.paragraph}>Here, you can view everyone you&apos;ve ever invited.</ThemedText></View>
          <View style={styles.listItem}><ThemedText style={styles.listBullet}>•</ThemedText><ThemedText style={styles.paragraph}><ThemedText style={{fontWeight: "bold"}}>Adding a Prospect:</ThemedText> Click <ThemedText style={{fontWeight: "bold"}}>+</ThemedText> to add someone you met at a networking event. Select &quot;None (Add as Prospect)&quot; as the event. They are saved to your directory with a special &quot;Prospect&quot; badge, without needing to be added to an active event.</ThemedText></View>
          <View style={styles.listItem}><ThemedText style={styles.listBullet}>•</ThemedText><ThemedText style={styles.paragraph}><ThemedText style={{fontWeight: "bold"}}>Search & Filter:</ThemedText> Use the search bar to find people by name, phone, email, company, or lead source. Use <ThemedText style={{fontWeight: "bold"}}>Prospects Only</ThemedText> to manage your leads. Click the <ThemedText style={{fontWeight: "bold"}}>Total</ThemedText>, <ThemedText style={{fontWeight: "bold"}}>With Phone</ThemedText>, or <ThemedText style={{fontWeight: "bold"}}>With Email</ThemedText> cards to filter—the counts update to match your current filter and search.</ThemedText></View>
          <View style={styles.listItem}><ThemedText style={styles.listBullet}>•</ThemedText><ThemedText style={styles.paragraph}><ThemedText style={{fontWeight: "bold"}}>Sort:</ThemedText> Sort by First Name, Last Name, Phone, Event, or Lead Source. When sorting by Last Name, people with a surname are listed alphabetically first; single-name contacts appear at the end.</ThemedText></View>
          <View style={styles.listItem}><ThemedText style={styles.listBullet}>•</ThemedText><ThemedText style={styles.paragraph}><ThemedText style={{fontWeight: "bold"}}>Actions Menu:</ThemedText> Click the <ThemedText style={{fontWeight: "bold"}}>Actions</ThemedText> button (⋯) to bulk-add filtered contacts to an event, export your filtered list as CSV, or import a contact list. For example, filter to letterbox-drop prospects and add them all to a virtual event in one step.</ThemedText></View>
          <View style={styles.listItem}><ThemedText style={styles.listBullet}>•</ThemedText><ThemedText style={styles.paragraph}><ThemedText style={{fontWeight: "bold"}}>Upgrade to User:</ThemedText> Open a prospect&apos;s details and click &quot;Create Account & Send Link&quot; to generate a free GatherSync account and magic login link.</ThemedText></View>
          <View style={styles.divider} />
          <View onLayout={handleLayout('10-data-backup-recovery')}><ThemedText style={styles.h2}>10. Data Backup & Recovery</ThemedText></View>
          <ThemedText style={styles.paragraph}>Your event data is safely stored on your device, but it&apos;s important to know how the backup system works:</ThemedText>
          <View style={styles.listItem}><ThemedText style={styles.listBullet}>-</ThemedText><ThemedText style={styles.paragraph}>  <ThemedText style={{fontWeight: "bold"}}>Export / Import Backup:</ThemedText> From the new <ThemedText style={{fontWeight: "bold"}}>Backup</ThemedText> tab on your dashboard, you can download a full backup of your entire site (all events, templates, and snapshots) as a secure JSON file. You can also restore your site from a previous backup file here. <ThemedText style={{fontStyle: "italic"}}>Note: Importing a backup completely overwrites your current data.</ThemedText></ThemedText></View>
          <View style={styles.listItem}><ThemedText style={styles.listBullet}>-</ThemedText><ThemedText style={styles.paragraph}>  <ThemedText style={{fontWeight: "bold"}}>Single Event Backup:</ThemedText> Have an important event with a lot of transactions? Open that specific event, click the menu ("..."), and select <ThemedText style={{fontWeight: "bold"}}>Export Backup (Single Event)</ThemedText>. This lets you save the state of just one event without affecting the rest of your app.</ThemedText></View>
          <View style={styles.listItem}><ThemedText style={styles.listBullet}>-</ThemedText><ThemedText style={styles.paragraph}>  <ThemedText style={{fontWeight: "bold"}}>Automatic Backups & Data Recovery:</ThemedText> GatherSync automatically takes hidden "safety snapshots" before major actions (like importing data or syncing to the cloud). If something goes wrong, use the <ThemedText style={{fontWeight: "bold"}}>Data Recovery</ThemedText> tool (found in the Backup tab) to revert your app back to the exact moment before the action was taken.</ThemedText></View>
          <View style={styles.divider} />
          <View onLayout={handleLayout('11-advanced-features-settings')}><ThemedText style={styles.h2}>11. Advanced Features & Settings</ThemedText></View>
          <View onLayout={handleLayout('cloud-sync')}><ThemedText style={styles.h3}>Cloud Sync</ThemedText></View>
          <ThemedText style={styles.paragraph}>GatherSync securely syncs your data to the cloud. As long as you are logged in, your events, participants, and templates are backed up and accessible across any device you log into.</ThemedText>
          <View onLayout={handleLayout('privacy-settings')}><ThemedText style={styles.h3}>Privacy Settings</ThemedText></View>
          <View style={styles.listItem}><ThemedText style={styles.listBullet}>-</ThemedText><ThemedText style={styles.paragraph}>  <ThemedText style={{fontWeight: "bold"}}>Can participants see each other&apos;s availability?</ThemedText> Yes, but as an Admin/Organizer, you have a <ThemedText style={{fontWeight: "bold"}}>Privacy Button</ThemedText> that allows you to determine exactly how much information is revealed to attendees.</ThemedText></View>
          <View onLayout={handleLayout('attendance-tracking')}><ThemedText style={styles.h3}>Attendance Tracking</ThemedText></View>
          <View style={styles.listItem}><ThemedText style={styles.listBullet}>-</ThemedText><ThemedText style={styles.paragraph}>  To track or view attendance for past events, navigate to the event and use the <ThemedText style={{fontWeight: "bold"}}>Actions Button</ThemedText> to access attendance records.</ThemedText></View>
          <View onLayout={handleLayout('exporting-data')}><ThemedText style={styles.h3}>Exporting Data</ThemedText></View>
          <View style={styles.listItem}><ThemedText style={styles.listBullet}>-</ThemedText><ThemedText style={styles.paragraph}>  You can export your participant records and event data. Look for the export options within your Dashboard or Event views to download your data.</ThemedText></View>
          <View onLayout={handleLayout('backup-restore')}><ThemedText style={styles.h3}>Backup & Restore</ThemedText></View>
          <View style={styles.listItem}><ThemedText style={styles.listBullet}>-</ThemedText><ThemedText style={styles.paragraph}>  To ensure your data is always safe, you can download a full backup of your entire site (including all events, templates, and snapshots) as a secure JSON file. Go to the <ThemedText style={{fontWeight: "bold"}}>Backup</ThemedText> tab on your dashboard to export a backup or restore your site from a previous backup file.</ThemedText></View>
          <View style={styles.divider} />
          <View onLayout={handleLayout('need-more-help')}><ThemedText style={styles.h3}>Need More Help?</ThemedText></View>
          <ThemedText style={styles.paragraph}>If you get stuck or have questions, visit the <ThemedText style={{fontWeight: "bold"}}>Dashboard</ThemedText> tab and click on <ThemedText style={{fontWeight: "bold"}}>Help & Tutorials</ThemedText> for more resources and guides. You can also reach out to our support team at <ThemedText style={{fontWeight: "bold"}}>hello@gathersync.app</ThemedText>.</ThemedText>
          <ThemedText style={styles.paragraph}><ThemedText style={{fontStyle: "italic"}}>© 2026 GatherSync. All rights reserved.</ThemedText></ThemedText>
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
    fontWeight: 'bold',
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
  h1: {
    fontSize: 28,
    fontWeight: 'bold',
    color: AdminColors.gray900,
    marginTop: 24,
    marginBottom: 16,
  },
  h2: {
    fontSize: 22,
    fontWeight: 'bold',
    color: AdminColors.gray900,
    marginTop: 32,
    marginBottom: 12,
  },
  h3: {
    fontSize: 18,
    fontWeight: '600',
    color: AdminColors.gray800,
    marginTop: 24,
    marginBottom: 8,
  },
  paragraph: {
    fontSize: 16,
    color: AdminColors.gray700,
    lineHeight: 24,
    marginBottom: 12,
  },
  listItem: {
    flexDirection: 'row',
    marginBottom: 8,
    paddingLeft: 8,
  },
  listBullet: {
    fontSize: 16,
    color: AdminColors.gray700,
    marginRight: 8,
    lineHeight: 24,
  },
  divider: {
    height: 1,
    backgroundColor: AdminColors.gray200,
    marginVertical: 24,
  },
  tocLink: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 4,
    borderRadius: 8,
    backgroundColor: AdminColors.primaryLight,
  },
  tocLinkText: {
    fontSize: 16,
    color: AdminColors.primary,
    fontWeight: '600',
  },
});
