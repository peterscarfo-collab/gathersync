import { useState, useEffect } from 'react';
import {
  StyleSheet,
  ScrollView,
  View,
  Pressable,
  Platform,
  Share,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';
import { eventsLocalStorage } from '@/lib/local-storage';
import type { Event } from '@/types/models';

interface AnalyticsData {
  totalEvents: number;
  flexibleEvents: number;
  fixedEvents: number;
  upcomingEvents: number;
  pastEvents: number;
  totalParticipants: number;
  uniqueParticipants: number;
  avgParticipantsPerEvent: number;
  avgResponseRate: number;
  eventsWithFullResponse: number;
  mostActiveParticipant: { name: string; eventCount: number } | null;
  mostPopularMonth: { month: string; count: number } | null;
}

export default function AdminAnalyticsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tintColor = useThemeColor({}, 'tint');
  const cardBg = useThemeColor({ light: '#f5f5f5', dark: '#2a2a2a' }, 'background');
  
  const [events, setEvents] = useState<Event[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    totalEvents: 0,
    flexibleEvents: 0,
    fixedEvents: 0,
    upcomingEvents: 0,
    pastEvents: 0,
    totalParticipants: 0,
    uniqueParticipants: 0,
    avgParticipantsPerEvent: 0,
    avgResponseRate: 0,
    eventsWithFullResponse: 0,
    mostActiveParticipant: null,
    mostPopularMonth: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const allEvents = await eventsLocalStorage.getAll();
      setEvents(allEvents);
      
      const now = new Date();
      
      // Basic counts
      const flexibleEvents = allEvents.filter(e => e.eventType === 'flexible').length;
      const fixedEvents = allEvents.filter(e => e.eventType === 'fixed').length;
      
      const upcomingEvents = allEvents.filter(e => {
        if (e.eventType === 'fixed' && e.fixedDate) {
          return new Date(e.fixedDate).getTime() > now.getTime();
        }
        return !e.finalized && !e.archived;
      }).length;
      
      const pastEvents = allEvents.filter(e => {
        if (e.eventType === 'fixed' && e.fixedDate) {
          return new Date(e.fixedDate).getTime() < now.getTime();
        }
        return e.finalized || e.archived;
      }).length;
      
      // Participant stats
      const totalParticipants = allEvents.reduce((sum, e) => sum + e.participants.length, 0);
      const uniqueParticipants = new Set(
        allEvents.flatMap(e => e.participants.map(p => p.name))
      ).size;
      const avgParticipantsPerEvent = allEvents.length > 0
        ? Math.round(totalParticipants / allEvents.length)
        : 0;
      
      // Response rate
      const responseCounts = allEvents.map(e => {
        const responded = e.participants.filter(p =>
          (e.eventType === 'flexible' && p.availability && Object.keys(p.availability).length > 0) ||
          (e.eventType === 'fixed' && p.rsvpStatus && p.rsvpStatus !== 'no-response')
        ).length;
        return e.participants.length > 0 ? (responded / e.participants.length) * 100 : 0;
      });
      const avgResponseRate = responseCounts.length > 0
        ? Math.round(responseCounts.reduce((sum, rate) => sum + rate, 0) / responseCounts.length)
        : 0;
      
      const eventsWithFullResponse = responseCounts.filter(rate => rate === 100).length;
      
      // Most active participant
      const participantCounts = new Map<string, number>();
      allEvents.forEach(e => {
        e.participants.forEach(p => {
          participantCounts.set(p.name, (participantCounts.get(p.name) || 0) + 1);
        });
      });
      const mostActiveEntry = Array.from(participantCounts.entries())
        .sort((a, b) => b[1] - a[1])[0];
      const mostActiveParticipant = mostActiveEntry
        ? { name: mostActiveEntry[0], eventCount: mostActiveEntry[1] }
        : null;
      
      // Most popular month
      const monthCounts = new Map<string, number>();
      allEvents.forEach(e => {
        const key = `${e.month}/${e.year}`;
        monthCounts.set(key, (monthCounts.get(key) || 0) + 1);
      });
      const mostPopularEntry = Array.from(monthCounts.entries())
        .sort((a, b) => b[1] - a[1])[0];
      const mostPopularMonth = mostPopularEntry
        ? { month: mostPopularEntry[0], count: mostPopularEntry[1] }
        : null;
      
      setAnalytics({
        totalEvents: allEvents.length,
        flexibleEvents,
        fixedEvents,
        upcomingEvents,
        pastEvents,
        totalParticipants,
        uniqueParticipants,
        avgParticipantsPerEvent,
        avgResponseRate,
        eventsWithFullResponse,
        mostActiveParticipant,
        mostPopularMonth,
      });
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportAnalyticsReport = () => {
    let report = 'GatherSync Analytics Report\n';
    report += `Generated: ${new Date().toLocaleString()}\n\n`;
    
    report += 'EVENT STATISTICS\n';
    report += `Total Events: ${analytics.totalEvents}\n`;
    report += `Flexible Events: ${analytics.flexibleEvents}\n`;
    report += `Fixed Events: ${analytics.fixedEvents}\n`;
    report += `Upcoming Events: ${analytics.upcomingEvents}\n`;
    report += `Past Events: ${analytics.pastEvents}\n\n`;
    
    report += 'PARTICIPANT STATISTICS\n';
    report += `Total Participants: ${analytics.totalParticipants}\n`;
    report += `Unique Participants: ${analytics.uniqueParticipants}\n`;
    report += `Average Participants per Event: ${analytics.avgParticipantsPerEvent}\n`;
    report += `Most Active Participant: ${analytics.mostActiveParticipant?.name || 'N/A'} (${analytics.mostActiveParticipant?.eventCount || 0} events)\n\n`;
    
    report += 'ENGAGEMENT STATISTICS\n';
    report += `Average Response Rate: ${analytics.avgResponseRate}%\n`;
    report += `Events with 100% Response: ${analytics.eventsWithFullResponse}\n`;
    report += `Most Popular Month: ${analytics.mostPopularMonth?.month || 'N/A'} (${analytics.mostPopularMonth?.count || 0} events)\n`;

    if (Platform.OS === 'web') {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(report);
        alert('Analytics report copied to clipboard!');
      } else {
        const blob = new Blob([report], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analytics-${new Date().toISOString().split('T')[0]}.txt`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } else {
      Share.share({
        message: report,
        title: 'Analytics Report',
      });
    }
  };

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <IconSymbol name="chevron.left" size={24} color={tintColor} />
        </Pressable>
        <ThemedText type="title">Analytics & Reports</ThemedText>
      </View>

      <ScrollView style={styles.content}>
        {/* Export Button */}
        <Pressable
          style={[styles.exportButton, { backgroundColor: tintColor }]}
          onPress={exportAnalyticsReport}
        >
          <IconSymbol name="square.and.arrow.up" size={20} color="#fff" />
          <ThemedText style={styles.exportButtonText}>Export Report</ThemedText>
        </Pressable>

        {/* Event Statistics */}
        <View style={styles.section}>
          <ThemedText type="subtitle">Event Statistics</ThemedText>
          <View style={styles.statsGrid}>
            <View style={[styles.statCard, { backgroundColor: cardBg }]}>
              <ThemedText style={styles.statValue}>{analytics.totalEvents}</ThemedText>
              <ThemedText style={styles.statLabel}>Total Events</ThemedText>
            </View>
            <View style={[styles.statCard, { backgroundColor: cardBg }]}>
              <ThemedText style={styles.statValue}>{analytics.flexibleEvents}</ThemedText>
              <ThemedText style={styles.statLabel}>Flexible</ThemedText>
            </View>
            <View style={[styles.statCard, { backgroundColor: cardBg }]}>
              <ThemedText style={styles.statValue}>{analytics.fixedEvents}</ThemedText>
              <ThemedText style={styles.statLabel}>Fixed</ThemedText>
            </View>
            <View style={[styles.statCard, { backgroundColor: cardBg }]}>
              <ThemedText style={styles.statValue}>{analytics.upcomingEvents}</ThemedText>
              <ThemedText style={styles.statLabel}>Upcoming</ThemedText>
            </View>
            <View style={[styles.statCard, { backgroundColor: cardBg }]}>
              <ThemedText style={styles.statValue}>{analytics.pastEvents}</ThemedText>
              <ThemedText style={styles.statLabel}>Past</ThemedText>
            </View>
          </View>
        </View>

        {/* Participant Statistics */}
        <View style={styles.section}>
          <ThemedText type="subtitle">Participant Statistics</ThemedText>
          <View style={styles.statsGrid}>
            <View style={[styles.statCard, { backgroundColor: cardBg }]}>
              <ThemedText style={styles.statValue}>{analytics.totalParticipants}</ThemedText>
              <ThemedText style={styles.statLabel}>Total Participants</ThemedText>
            </View>
            <View style={[styles.statCard, { backgroundColor: cardBg }]}>
              <ThemedText style={styles.statValue}>{analytics.uniqueParticipants}</ThemedText>
              <ThemedText style={styles.statLabel}>Unique</ThemedText>
            </View>
            <View style={[styles.statCard, { backgroundColor: cardBg }]}>
              <ThemedText style={styles.statValue}>{analytics.avgParticipantsPerEvent}</ThemedText>
              <ThemedText style={styles.statLabel}>Avg per Event</ThemedText>
            </View>
          </View>
        </View>

        {/* Engagement Statistics */}
        <View style={styles.section}>
          <ThemedText type="subtitle">Engagement Statistics</ThemedText>
          <View style={styles.statsGrid}>
            <View style={[styles.statCard, { backgroundColor: cardBg }]}>
              <ThemedText style={styles.statValue}>{analytics.avgResponseRate}%</ThemedText>
              <ThemedText style={styles.statLabel}>Avg Response Rate</ThemedText>
            </View>
            <View style={[styles.statCard, { backgroundColor: cardBg }]}>
              <ThemedText style={styles.statValue}>{analytics.eventsWithFullResponse}</ThemedText>
              <ThemedText style={styles.statLabel}>100% Response</ThemedText>
            </View>
          </View>
        </View>

        {/* Insights */}
        <View style={styles.section}>
          <ThemedText type="subtitle">Key Insights</ThemedText>
          
          {analytics.mostActiveParticipant && (
            <View style={[styles.insightCard, { backgroundColor: cardBg }]}>
              <View style={styles.insightHeader}>
                <IconSymbol name="star.fill" size={24} color={tintColor} />
                <ThemedText type="defaultSemiBold">Most Active Participant</ThemedText>
              </View>
              <ThemedText style={styles.insightValue}>
                {analytics.mostActiveParticipant.name}
              </ThemedText>
              <ThemedText style={styles.insightDesc}>
                Participated in {analytics.mostActiveParticipant.eventCount} events
              </ThemedText>
            </View>
          )}

          {analytics.mostPopularMonth && (
            <View style={[styles.insightCard, { backgroundColor: cardBg }]}>
              <View style={styles.insightHeader}>
                <IconSymbol name="calendar" size={24} color={tintColor} />
                <ThemedText type="defaultSemiBold">Most Popular Month</ThemedText>
              </View>
              <ThemedText style={styles.insightValue}>
                {analytics.mostPopularMonth.month}
              </ThemedText>
              <ThemedText style={styles.insightDesc}>
                {analytics.mostPopularMonth.count} events scheduled
              </ThemedText>
            </View>
          )}

          {analytics.avgResponseRate >= 80 && (
            <View style={[styles.insightCard, { backgroundColor: '#34c75920' }]}>
              <View style={styles.insightHeader}>
                <IconSymbol name="checkmark.circle.fill" size={24} color="#34c759" />
                <ThemedText type="defaultSemiBold">Great Engagement!</ThemedText>
              </View>
              <ThemedText style={styles.insightDesc}>
                Your events have an average response rate of {analytics.avgResponseRate}%. Keep up the great work!
              </ThemedText>
            </View>
          )}

          {analytics.avgResponseRate < 50 && analytics.totalEvents > 0 && (
            <View style={[styles.insightCard, { backgroundColor: '#ff950020' }]}>
              <View style={styles.insightHeader}>
                <IconSymbol name="info.circle" size={24} color="#ff9500" />
                <ThemedText type="defaultSemiBold">Improve Engagement</ThemedText>
              </View>
              <ThemedText style={styles.insightDesc}>
                Your average response rate is {analytics.avgResponseRate}%. Try sending reminders or following up with participants to improve engagement.
              </ThemedText>
            </View>
          )}
        </View>

        <View style={{ height: insets.bottom + 80 }} />
      </ScrollView>
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
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 12,
  },
  backButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
    marginBottom: 24,
  },
  exportButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  section: {
    marginBottom: 32,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 16,
  },
  statCard: {
    flex: 1,
    minWidth: 140,
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 4,
    textAlign: 'center',
  },
  insightCard: {
    padding: 16,
    borderRadius: 12,
    marginTop: 12,
    gap: 8,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  insightValue: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 4,
  },
  insightDesc: {
    fontSize: 14,
    opacity: 0.7,
  },
});
