import { useState, useEffect } from "react";
import {
  StyleSheet,
  ScrollView,
  View,
  Pressable,
  Platform,
  Share,
  TextInput,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useThemeColor } from "@/hooks/use-theme-color";
import { eventsLocalStorage } from "@/lib/local-storage";
import type { Event, AttendanceRecord } from "@/types/models";

interface ParticipantStats {
  name: string;
  totalEvents: number;
  attended: number;
  percentage: number;
  events: {
    id: string;
    name: string;
    date: string;
    status: "attended" | "missed" | "pending";
  }[];
}

export default function AdminAttendanceScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tintColor = useThemeColor({}, "tint");
  const cardBg = useThemeColor(
    { light: "#f5f5f5", dark: "#2a2a2a" },
    "background",
  );

  const [events, setEvents] = useState<Event[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<
    AttendanceRecord[]
  >([]);
  const [participantStats, setParticipantStats] = useState<ParticipantStats[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [expandedParticipant, setExpandedParticipant] = useState<string | null>(
    null,
  );
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const allEvents = await eventsLocalStorage.getAll();
      const activeEvents = allEvents.filter((e) => !e.archived);
      setEvents(activeEvents);

      // Collect all attendance records
      const records: AttendanceRecord[] = [];
      activeEvents.forEach((event) => {
        if (event.attendanceRecords) {
          records.push(...event.attendanceRecords);
        }
      });
      setAttendanceRecords(records);

      // Calculate participant statistics
      const statsMap = new Map<
        string,
        {
          attended: number;
          total: number;
          events: {
            id: string;
            name: string;
            date: string;
            status: "attended" | "missed" | "pending";
          }[];
        }
      >();

      const isEventInFuture = (current: Event) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (current.eventType === "fixed" && current.fixedDate) {
          const eventDateStart = new Date(current.fixedDate);
          eventDateStart.setHours(0, 0, 0, 0);
          return eventDateStart.getTime() > today.getTime();
        } else if (
          current.eventType === "flexible" &&
          current.year &&
          current.month
        ) {
          const currentYear = today.getFullYear();
          const currentMonth = today.getMonth() + 1;
          if (current.year > currentYear) return true;
          if (current.year === currentYear && current.month > currentMonth)
            return true;
          return false;
        }
        return false;
      };

      const getLatestAttendanceRecord = (current: Event) => {
        if (
          !current.attendanceRecords ||
          current.attendanceRecords.length === 0
        )
          return null;
        return [...current.attendanceRecords].sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
        )[0];
      };

      const hasAttendanceOutcomes = (current: Event) => {
        const latest = getLatestAttendanceRecord(current);
        if (!latest) return false;
        if (latest.statuses && typeof latest.statuses === "object") {
          return Object.values(latest.statuses).some(
            (value) => value === "attended" || value === "not-attended",
          );
        }
        return Array.isArray(latest.attendees) && latest.attendees.length > 0;
      };

      const getAttendanceMap = (
        current: Event,
      ): Record<string, "attended" | "not-attended" | "unchecked"> => {
        const map: Record<string, "attended" | "not-attended" | "unchecked"> =
          {};
        const participants = current.participants.filter((p) => !p.deletedAt);
        const useAttendanceOutcomes =
          !isEventInFuture(current) && hasAttendanceOutcomes(current);
        participants.forEach((participant) => {
          if (useAttendanceOutcomes) {
            map[participant.id] = "unchecked";
            return;
          }
          map[participant.id] =
            participant.rsvpStatus === "attending"
              ? "attended"
              : participant.rsvpStatus === "not-attending"
                ? "not-attended"
                : "unchecked";
        });

        const latest = getLatestAttendanceRecord(current);
        if (!latest) return map;

        if (!useAttendanceOutcomes) {
          return map;
        }

        if (latest.statuses && typeof latest.statuses === "object") {
          participants.forEach((participant) => {
            const value =
              latest.statuses[participant.id] ??
              latest.statuses[participant.name];
            if (
              value === "attended" ||
              value === "not-attended" ||
              value === "unchecked"
            ) {
              map[participant.id] = value as any;
            }
          });
          return map;
        }

        const attended = latest.attendees || [];
        attended.forEach((name: string) => {
          const participant = participants.find(
            (p) => p.name === name || p.id === name,
          );
          if (participant) map[participant.id] = "attended";
        });
        return map;
      };

      allEvents.forEach((event) => {
        const attendanceMap = getAttendanceMap(event);
        const isFuture = isEventInFuture(event);

        event.participants.forEach((participant) => {
          if (participant.deletedAt) return;

          const current = statsMap.get(participant.name) || {
            attended: 0,
            total: 0,
            events: [],
          };

          const eventState = attendanceMap[participant.id] || "unchecked";

          let status: "attended" | "missed" | "pending" = "pending";
          if (isFuture) {
            status = "pending";
          } else if (eventState === "attended") {
            status = "attended";
          } else if (eventState === "not-attended") {
            status = "missed";
          } else {
            status = "pending";
          }

          if (!isFuture && status !== "pending") {
            current.total += 1;
            if (status === "attended") {
              current.attended += 1;
            }
          }

          const eventDate =
            event.eventType === "fixed" && event.fixedDate
              ? new Date(event.fixedDate).toLocaleDateString()
              : `${event.month}/${event.year}`;

          current.events.push({
            id: event.id,
            name: event.name,
            date: eventDate,
            status,
          });

          statsMap.set(participant.name, current);
        });
      });

      const stats: ParticipantStats[] = Array.from(statsMap.entries())
        .map(([name, data]) => ({
          name,
          totalEvents: data.total,
          attended: data.attended,
          percentage:
            data.total > 0 ? Math.round((data.attended / data.total) * 100) : 0,
          events: data.events,
        }))
        .sort((a, b) => b.percentage - a.percentage);

      setParticipantStats(stats);
    } catch (error) {
      console.error("Failed to load attendance data:", error);
    } finally {
      setLoading(false);
    }
  };

  const exportAttendanceReport = () => {
    // Generate CSV report
    let csv = "Participant Name,Total Events,Attended,Attendance Rate\n";
    participantStats.forEach((stat) => {
      csv += `${stat.name},${stat.totalEvents},${stat.attended},${stat.percentage}%\n`;
    });

    csv += "\n\nEvent Attendance Records\n";
    csv += "Event Name,Date,Attendees\n";

    events.forEach((event) => {
      if (event.attendanceRecords && event.attendanceRecords.length > 0) {
        event.attendanceRecords.forEach((record) => {
          const eventDate =
            event.eventType === "fixed" && event.fixedDate
              ? new Date(event.fixedDate).toLocaleDateString()
              : `${event.month}/${event.year}`;
          csv += `${event.name},${eventDate},"${record.attendees.join(", ")}"\n`;
        });
      }
    });

    if (Platform.OS === "web") {
      // Copy to clipboard on web
      if (navigator.clipboard) {
        navigator.clipboard.writeText(csv);
        alert(
          "Attendance report copied to clipboard! Paste into Excel or Google Sheets.",
        );
      } else {
        // Fallback: create download link
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `attendance-report-${new Date().toISOString().split("T")[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } else {
      // Share on mobile
      Share.share({
        message: csv,
        title: "Attendance Report",
      });
    }
  };

  const getTotalAttendanceRate = () => {
    if (participantStats.length === 0) return 0;
    const sum = participantStats.reduce(
      (acc, stat) => acc + stat.percentage,
      0,
    );
    return Math.round(sum / participantStats.length);
  };

  const filteredStats = participantStats.filter((stat) =>
    stat.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <IconSymbol name="chevron.left" size={24} color={tintColor} />
        </Pressable>
        <ThemedText type="title">Attendance Tracking</ThemedText>
      </View>

      <ScrollView style={styles.content}>
        {/* Summary Cards */}
        <View style={styles.summaryGrid}>
          <View style={[styles.summaryCard, { backgroundColor: cardBg }]}>
            <ThemedText style={styles.summaryValue}>{events.length}</ThemedText>
            <ThemedText style={styles.summaryLabel}>Total Events</ThemedText>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: cardBg }]}>
            <ThemedText style={styles.summaryValue}>
              {attendanceRecords.length}
            </ThemedText>
            <ThemedText style={styles.summaryLabel}>Records</ThemedText>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: cardBg }]}>
            <ThemedText style={styles.summaryValue}>
              {participantStats.length}
            </ThemedText>
            <ThemedText style={styles.summaryLabel}>Participants</ThemedText>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: cardBg }]}>
            <ThemedText style={styles.summaryValue}>
              {getTotalAttendanceRate()}%
            </ThemedText>
            <ThemedText style={styles.summaryLabel}>Avg Rate</ThemedText>
          </View>
        </View>

        {/* Export Button */}
        <Pressable
          style={[styles.exportButton, { backgroundColor: tintColor }]}
          onPress={exportAttendanceReport}
        >
          <IconSymbol name="square.and.arrow.up" size={20} color="#fff" />
          <ThemedText style={styles.exportButtonText}>Export Report</ThemedText>
        </Pressable>

        {/* Participant Statistics */}
        <View style={styles.section}>
          <ThemedText type="subtitle">Participant Statistics</ThemedText>
          <ThemedText style={styles.sectionDesc}>
            Attendance rates across all events
          </ThemedText>

          <View style={[styles.searchContainer, { backgroundColor: cardBg }]}>
            <IconSymbol name="magnifyingglass" size={20} color="#9ca3af" />
            <TextInput
              style={[styles.searchInput, { color: tintColor }]}
              placeholder="Search participants..."
              placeholderTextColor="#9ca3af"
              value={searchQuery}
              onChangeText={setSearchQuery}
              clearButtonMode="while-editing"
            />
          </View>

          {filteredStats.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: cardBg }]}>
              <ThemedText style={{ opacity: 0.5 }}>
                {searchQuery
                  ? "No participants found matching search"
                  : "No attendance records yet"}
              </ThemedText>
            </View>
          ) : (
            <View style={styles.statsTable}>
              {/* Table Header */}
              <View
                style={[
                  styles.tableRow,
                  styles.tableHeader,
                  { backgroundColor: cardBg },
                ]}
              >
                <ThemedText
                  style={[styles.tableCell, styles.nameCell, styles.headerText]}
                >
                  Participant
                </ThemedText>
                <ThemedText
                  style={[
                    styles.tableCell,
                    styles.numberCell,
                    styles.headerText,
                  ]}
                >
                  Events
                </ThemedText>
                <ThemedText
                  style={[
                    styles.tableCell,
                    styles.numberCell,
                    styles.headerText,
                  ]}
                >
                  Attended
                </ThemedText>
                <ThemedText
                  style={[
                    styles.tableCell,
                    styles.numberCell,
                    styles.headerText,
                  ]}
                >
                  Rate
                </ThemedText>
              </View>

              {/* Table Rows */}
              {filteredStats.map((stat, index) => (
                <View key={stat.name}>
                  <Pressable
                    style={[
                      styles.tableRow,
                      {
                        backgroundColor:
                          index % 2 === 0 ? "transparent" : cardBg + "40",
                      },
                    ]}
                    onPress={() =>
                      setExpandedParticipant(
                        expandedParticipant === stat.name ? null : stat.name,
                      )
                    }
                  >
                    <ThemedText style={[styles.tableCell, styles.nameCell]}>
                      {stat.name}
                    </ThemedText>
                    <ThemedText style={[styles.tableCell, styles.numberCell]}>
                      {stat.totalEvents}
                    </ThemedText>
                    <ThemedText style={[styles.tableCell, styles.numberCell]}>
                      {stat.attended}
                    </ThemedText>
                    <View style={[styles.tableCell, styles.numberCell]}>
                      <View
                        style={[
                          styles.percentageBadge,
                          {
                            backgroundColor:
                              stat.percentage >= 80
                                ? "#34c759"
                                : stat.percentage >= 50
                                  ? "#ff9500"
                                  : "#ff3b30",
                          },
                        ]}
                      >
                        <ThemedText style={styles.percentageText}>
                          {stat.percentage}%
                        </ThemedText>
                      </View>
                    </View>
                  </Pressable>

                  {expandedParticipant === stat.name && (
                    <View
                      style={[
                        styles.expandedDetails,
                        { backgroundColor: cardBg + "20" },
                      ]}
                    >
                      {stat.events.map((evt) => (
                        <View key={evt.id} style={styles.expandedEventRow}>
                          <ThemedText
                            style={styles.expandedEventName}
                            numberOfLines={1}
                          >
                            {evt.name}
                          </ThemedText>
                          <ThemedText style={styles.expandedEventDate}>
                            {evt.date}
                          </ThemedText>
                          <View style={styles.expandedEventStatus}>
                            {evt.status === "attended" ? (
                              <IconSymbol
                                name="checkmark.circle.fill"
                                color="#34c759"
                                size={20}
                              />
                            ) : evt.status === "missed" ? (
                              <IconSymbol
                                name="xmark.circle.fill"
                                color="#ff3b30"
                                size={20}
                              />
                            ) : (
                              <IconSymbol
                                name="questionmark.circle.fill"
                                color="#9ca3af"
                                size={20}
                              />
                            )}
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Recent Attendance Records */}
        <View style={styles.section}>
          <ThemedText type="subtitle">Recent Records</ThemedText>
          <ThemedText style={styles.sectionDesc}>
            Latest attendance entries
          </ThemedText>

          {attendanceRecords.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: cardBg }]}>
              <ThemedText style={{ opacity: 0.5 }}>No records yet</ThemedText>
            </View>
          ) : (
            attendanceRecords
              .slice(-10)
              .reverse()
              .map((record, index) => {
                const event = events.find((e) =>
                  e.attendanceRecords?.some((r) => r.date === record.date),
                );

                return (
                  <View
                    key={index}
                    style={[styles.recordCard, { backgroundColor: cardBg }]}
                  >
                    <View style={styles.recordHeader}>
                      <ThemedText type="defaultSemiBold">
                        {event?.name || "Unknown Event"}
                      </ThemedText>
                      <ThemedText style={styles.recordDate}>
                        {new Date(record.date).toLocaleDateString()}
                      </ThemedText>
                    </View>
                    <View style={styles.attendeeList}>
                      {record.attendees.map((name, i) => (
                        <View
                          key={i}
                          style={[
                            styles.attendeeChip,
                            { backgroundColor: tintColor + "20" },
                          ]}
                        >
                          <ThemedText
                            style={[styles.attendeeText, { color: tintColor }]}
                          >
                            {name}
                          </ThemedText>
                        </View>
                      ))}
                    </View>
                  </View>
                );
              })
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
    flexDirection: "row",
    alignItems: "center",
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
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 20,
  },
  summaryCard: {
    flex: 1,
    minWidth: 150,
    padding: 20,
    borderRadius: 12,
    alignItems: "center",
  },
  summaryValue: {
    fontSize: 32,
    fontWeight: "bold",
  },
  summaryLabel: {
    fontSize: 14,
    opacity: 0.7,
    marginTop: 4,
  },
  exportButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 12,
    gap: 8,
    marginBottom: 24,
  },
  exportButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  section: {
    marginBottom: 32,
  },
  sectionDesc: {
    fontSize: 14,
    opacity: 0.7,
    marginTop: 4,
    marginBottom: 16,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    padding: 0,
  },
  emptyCard: {
    padding: 40,
    borderRadius: 12,
    alignItems: "center",
  },
  statsTable: {
    borderRadius: 12,
    overflow: "hidden",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  tableHeader: {
    borderBottomWidth: 2,
    borderBottomColor: "rgba(0,0,0,0.1)",
  },
  expandedDetails: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  expandedEventRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  expandedEventName: {
    flex: 2,
    fontSize: 14,
  },
  expandedEventDate: {
    flex: 1,
    fontSize: 13,
    opacity: 0.7,
  },
  expandedEventStatus: {
    width: 60,
    alignItems: "center",
  },
  tableCell: {
    justifyContent: "center",
  },
  nameCell: {
    flex: 2,
  },
  numberCell: {
    flex: 1,
    alignItems: "center",
  },
  headerText: {
    fontWeight: "600",
    fontSize: 12,
    textTransform: "uppercase",
    opacity: 0.7,
  },
  percentageBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  percentageText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  recordCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  recordHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  recordDate: {
    fontSize: 12,
    opacity: 0.7,
  },
  attendeeList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  attendeeChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  attendeeText: {
    fontSize: 12,
    fontWeight: "500",
  },
});
