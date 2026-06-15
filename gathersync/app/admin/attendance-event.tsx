// @ts-nocheck
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useAuth } from "@/hooks/use-auth";
import { useEffectiveTimeZone } from "@/hooks/use-effective-timezone";
import { useThemeColor } from "@/hooks/use-theme-color";
import { eventsLocalStorage } from "@/lib/local-storage";
import {
  formatEventCalendarDate,
  isCalendarDateInFuture,
  isEventInFuture,
} from "@/lib/calendar-utils";
import type { Event } from "@/types/models";

type AttendanceState = "unchecked" | "attended" | "not-attended";
type ParticipantView = "all" | "unchecked" | "attended" | "not-attended";

export default function AdminAttendanceEventScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { eventId, view } = useLocalSearchParams<{
    eventId: string;
    view?: string | string[];
  }>();
  const { user } = useAuth();
  const { timeZone } = useEffectiveTimeZone();
  const tintColor = useThemeColor({}, "tint");
  const cardBg = useThemeColor(
    { light: "#f5f5f5", dark: "#2a2a2a" },
    "background",
  );
  const textColor = useThemeColor({}, "text");
  const surfaceColor = useThemeColor({}, "surface");

  const [event, setEvent] = useState<Event | null>(null);
  const [participantView, setParticipantView] =
    useState<ParticipantView>("all");
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const selectedView = Array.isArray(view) ? view[0] : view;
    if (
      selectedView === "all" ||
      selectedView === "unchecked" ||
      selectedView === "attended" ||
      selectedView === "not-attended"
    ) {
      setParticipantView(selectedView);
    }
  }, [view]);

  useEffect(() => {
    const loadEvent = async () => {
      if (!eventId) return;
      try {
        const loaded = await eventsLocalStorage.getById(eventId);
        setEvent(loaded && !loaded.deletedAt ? loaded : null);
      } catch (error) {
        console.error("Failed to load event attendance:", error);
      }
    };
    loadEvent();
  }, [eventId]);

  const formatEventDate = (current: Event) =>
    formatEventCalendarDate(current);

  const getActiveParticipants = (current: Event) =>
    current.participants.filter((participant) => !participant.deletedAt);

  const getLatestAttendanceRecord = (current: Event) => {
    if (!current.attendanceRecords || current.attendanceRecords.length === 0)
      return null;
    return [...current.attendanceRecords].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    )[0];
  };

  const eventIsInFuture = (current: Event) => isEventInFuture(current, timeZone);

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
  ): Record<string, AttendanceState> => {
    const map: Record<string, AttendanceState> = {};
    const participants = getActiveParticipants(current);
    const useAttendanceOutcomes =
      !eventIsInFuture(current) && hasAttendanceOutcomes(current);
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
          latest.statuses[participant.id] ?? latest.statuses[participant.name];
        if (
          value === "attended" ||
          value === "not-attended" ||
          value === "unchecked"
        ) {
          map[participant.id] = value;
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

  /** Reads only saved attendance records — not RSVP fallback used for display. */
  const getPersistedAttendanceMap = (
    current: Event,
  ): Record<string, AttendanceState> => {
    const map: Record<string, AttendanceState> = {};
    const participants = getActiveParticipants(current);
    participants.forEach((participant) => {
      map[participant.id] = "unchecked";
    });

    const latest = getLatestAttendanceRecord(current);
    if (!latest) return map;

    if (latest.statuses && typeof latest.statuses === "object") {
      participants.forEach((participant) => {
        const value =
          latest.statuses[participant.id] ?? latest.statuses[participant.name];
        if (
          value === "attended" ||
          value === "not-attended" ||
          value === "unchecked"
        ) {
          map[participant.id] = value;
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

  const persistAttendanceMap = async (
    current: Event,
    nextMap: Record<string, AttendanceState>,
  ) => {
    const participants = getActiveParticipants(current);
    const statusesByIdOrName: Record<string, AttendanceState> = {};
    participants.forEach((participant) => {
      const state = nextMap[participant.id] || "unchecked";
      statusesByIdOrName[participant.id] = state;
      if (participant.name) statusesByIdOrName[participant.name] = state;
    });
    const attendees = participants
      .filter(
        (participant) =>
          (nextMap[participant.id] || "unchecked") === "attended",
      )
      .map((participant) => participant.name);
    const nextRecords = current.attendanceRecords
      ? [...current.attendanceRecords]
      : [];
    const nextRecord = {
      date: new Date().toISOString(),
      attendees,
      statuses: statusesByIdOrName,
    };

    if (nextRecords.length === 0) {
      nextRecords.push(nextRecord);
    } else {
      const latestIndex = nextRecords.reduce((bestIdx, record, idx, arr) => {
        return new Date(record.date).getTime() >
          new Date(arr[bestIdx].date).getTime()
          ? idx
          : bestIdx;
      }, 0);
      nextRecords[latestIndex] = {
        ...nextRecords[latestIndex],
        ...nextRecord,
      };
    }

    const nextEvent = { ...current, attendanceRecords: nextRecords } as Event;
    setEvent(nextEvent);
    await eventsLocalStorage.update(current.id, {
      attendanceRecords: nextRecords,
    } as Partial<Event>);
    return nextEvent;
  };

  const setAttendanceState = async (
    participantId: string,
    nextState: AttendanceState,
  ) => {
    if (!event) return;
    if (eventIsInFuture(event)) {
      Alert.alert(
        "RSVP Stage",
        "This event has not happened yet. Open the participant to update RSVP details.",
      );
      return;
    }
    const latestMap = getAttendanceMap(event);
    const participant = getActiveParticipants(event).find(
      (entry) => entry.id === participantId,
    );
    if (!participant) return;
    const currentState = latestMap[participantId] || "unchecked";
    if (currentState === nextState) return;

    if (event.eventType === "fixed" && event.fixedDate) {
      if (
        isCalendarDateInFuture(event.fixedDate, timeZone) &&
        currentState !== "attended" &&
        nextState === "attended"
      ) {
        Alert.alert(
          "Attendance Locked",
          "This event is in the future. You can remove incorrect marks, but new attendance can only be added on or after the event date.",
        );
        return;
      }
    }

    const key = `${event.id}:${participantId}`;
    setUpdatingKey(key);
    const previousEvent = event;

    try {
      const nextMap = { ...latestMap, [participantId]: nextState };
      await persistAttendanceMap(event, nextMap);
    } catch (error) {
      setEvent(previousEvent);
      console.error("Failed to update attendance:", error);
      Alert.alert(
        "Update failed",
        "Could not update attendance. Please try again.",
      );
    } finally {
      setUpdatingKey(null);
    }
  };

  const toggleAttended = async (participantId: string) => {
    if (!event) return;
    const latestMap = getAttendanceMap(event);
    const currentState = latestMap[participantId] || "unchecked";
    const nextState: AttendanceState =
      currentState === "attended" ? "unchecked" : "attended";
    await setAttendanceState(participantId, nextState);
  };

  const toggleNotAttended = async (participantId: string) => {
    if (!event) return;
    const latestMap = getAttendanceMap(event);
    const currentState = latestMap[participantId] || "unchecked";
    const nextState: AttendanceState =
      currentState === "not-attended" ? "unchecked" : "not-attended";
    await setAttendanceState(participantId, nextState);
  };

  const openParticipant = (participantId: string) => {
    if (!event) return;
    router.push({
      pathname: "/edit-availability",
      params: { eventId: event.id, participantId },
    });
  };

  const buildCsv = () => {
    if (!event) return "";
    const statuses = getAttendanceMap(event);
    const rows = event.participants
      .filter((participant) => !participant.deletedAt)
      .map((participant) => ({
        participant,
        state: statuses[participant.id] || "unchecked",
      }))
      .sort((a, b) => a.participant.name.localeCompare(b.participant.name));

    let csv = "Event Name,Event Date,Participant,Attendance Status,Finalized\n";
    rows.forEach(({ participant, state }) => {
      const status =
        state === "attended"
          ? "Attended"
          : state === "not-attended"
            ? "Did Not Attend"
            : "Unchecked";
      const finalized = state === "unchecked" ? "No" : "Yes";
      csv += `"${event.name.replace(/"/g, '""')}","${formatEventDate(event)}","${participant.name.replace(/"/g, '""')}","${status}","${finalized}"\n`;
    });
    return csv;
  };

  const exportReport = () => {
    if (!event) return;
    const csv = buildCsv();
    if (Platform.OS === "web") {
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `attendance-${event.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      Share.share({
        message: csv,
        title: `${event.name} attendance`,
      });
    }
  };

  const getCountByState = (state: AttendanceState) => {
    if (!event) return 0;
    const map = getAttendanceMap(event);
    return Object.values(map).filter((value) => value === state).length;
  };

  const markAllAttendingAsAttended = async () => {
    if (!event) return;
    if (eventIsInFuture(event)) {
      if (Platform.OS === "web")
        alert(
          "This event has not happened yet. Open each participant to update RSVP status.",
        );
      else
        Alert.alert(
          "RSVP Stage",
          "This event has not happened yet. Open each participant to update RSVP status.",
        );
      return;
    }

    const displayMap = getAttendanceMap(event);
    const persistedMap = getPersistedAttendanceMap(event);
    const nextMap = { ...displayMap };
    let count = 0;

    getActiveParticipants(event).forEach((p) => {
      if (
        p.rsvpStatus === "attending" &&
        persistedMap[p.id] !== "attended"
      ) {
        nextMap[p.id] = "attended";
        count++;
      }
    });

    if (count === 0) {
      if (Platform.OS === "web")
        alert("All 'Attending' RSVPs are already marked as Attended.");
      else
        Alert.alert(
          "No updates",
          "All 'Attending' RSVPs are already marked as Attended.",
        );
      return;
    }

    await persistAttendanceMap(event, nextMap);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (Platform.OS === "web")
      alert(`Marked ${count} 'Attending' RSVPs as Attended.`);
    else
      Alert.alert(
        "Success",
        `Marked ${count} 'Attending' RSVPs as Attended.`,
      );
  };

  const markAllNotAttendingAsNotAttended = async () => {
    if (!event) return;
    if (eventIsInFuture(event)) {
      if (Platform.OS === "web")
        alert(
          "This event has not happened yet. Open each participant to update RSVP status.",
        );
      else
        Alert.alert(
          "RSVP Stage",
          "This event has not happened yet. Open each participant to update RSVP status.",
        );
      return;
    }

    const displayMap = getAttendanceMap(event);
    const persistedMap = getPersistedAttendanceMap(event);
    const nextMap = { ...displayMap };
    let count = 0;

    getActiveParticipants(event).forEach((p) => {
      if (
        p.rsvpStatus === "not-attending" &&
        persistedMap[p.id] !== "not-attended"
      ) {
        nextMap[p.id] = "not-attended";
        count++;
      }
    });

    if (count === 0) {
      if (Platform.OS === "web")
        alert(
          "All 'Not Attending' RSVPs are already marked as Did Not Attend.",
        );
      else
        Alert.alert(
          "No updates",
          "All 'Not Attending' RSVPs are already marked as Did Not Attend.",
        );
      return;
    }

    await persistAttendanceMap(event, nextMap);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (Platform.OS === "web")
      alert(`Marked ${count} 'Not Attending' RSVPs as Did Not Attend.`);
    else
      Alert.alert(
        "Success",
        `Marked ${count} 'Not Attending' RSVPs as Did Not Attend.`,
      );
  };

  const finalizeAttendance = async () => {
    if (!event) return;
    const map = getAttendanceMap(event);
    const uncheckedCount = Object.values(map).filter(
      (value) => value === "unchecked",
    ).length;
    if (uncheckedCount === 0) {
      Alert.alert("Already finalized", "No unchecked participants remain.");
      return;
    }

    Alert.alert(
      "Finalize Attendance",
      `Mark all ${uncheckedCount} unchecked participants as "Did not attend"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Finalize",
          style: "destructive",
          onPress: async () => {
            try {
              const nextMap = { ...map };
              Object.keys(nextMap).forEach((name) => {
                if (nextMap[name] === "unchecked")
                  nextMap[name] = "not-attended";
              });
              await persistAttendanceMap(event, nextMap);
              Alert.alert(
                "Finalized",
                "Attendance is now finalized with only attended / did not attend states.",
              );
            } catch (error) {
              console.error("Failed to finalize attendance:", error);
              Alert.alert("Finalize failed", "Could not finalize attendance.");
            }
          },
        },
      ],
    );
  };

  const exportPdfReport = () => {
    if (!event) return;
    if (Platform.OS !== "web") {
      Alert.alert(
        "PDF Export",
        "PDF export is available on web. On mobile, use Export CSV and share it.",
      );
      return;
    }

    const map = getAttendanceMap(event);
    const rows = getActiveParticipants(event)
      .map((participant) => {
        const state =
          map[participant.id] || map[participant.name] || "unchecked";
        const label =
          state === "attended"
            ? "Attended"
            : state === "not-attended"
              ? "Did not attend"
              : "Unchecked";
        return `<tr><td>${participant.name}</td><td>${label}</td></tr>`;
      })
      .join("");

    const html = `
      <html>
      <head>
        <title>${event.name} Attendance Report</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, Arial, sans-serif; padding: 24px; }
          h1 { margin: 0 0 8px; }
          p { margin: 4px 0; color: #444; }
          table { width: 100%; border-collapse: collapse; margin-top: 18px; }
          th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
          th { background: #f5f5f5; }
        </style>
      </head>
      <body>
        <h1>${event.name} - Attendance Report</h1>
        <p>Event date: ${formatEventDate(event)}</p>
        <p>Attended: ${getCountByState("attended")} | Did not attend: ${getCountByState("not-attended")} | Unchecked: ${getCountByState("unchecked")}</p>
        <p>Generated: ${new Date().toLocaleString()}</p>
        <table>
          <thead><tr><th>Participant</th><th>Status</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </body>
      </html>
    `;
    const win = window.open("", "_blank");
    if (!win) {
      Alert.alert("Popup blocked", "Please allow popups to export PDF.");
      return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  };

  const archiveEventOnly = async () => {
    if (!event) return;
    const unchecked = getCountByState("unchecked");
    const proceedArchive = async (markUncheckedAsDidNotAttend: boolean) => {
      try {
        const currentMap = getAttendanceMap(event);
        const nextMap = { ...currentMap };
        if (markUncheckedAsDidNotAttend) {
          Object.keys(nextMap).forEach((name) => {
            if (nextMap[name] === "unchecked") nextMap[name] = "not-attended";
          });
        }
        const nextEventFromAttendance = await persistAttendanceMap(
          event,
          nextMap,
        );
        const archivedEvent = {
          ...nextEventFromAttendance,
          archived: true,
          finalized: true,
          finalizedDate:
            nextEventFromAttendance.finalizedDate ||
            new Date().toISOString().slice(0, 10),
          updatedAt: new Date().toISOString(),
        };
        setEvent(archivedEvent);
        await eventsLocalStorage.update(event.id, {
          archived: true,
          finalized: true,
          finalizedDate: archivedEvent.finalizedDate,
          updatedAt: archivedEvent.updatedAt,
          attendanceRecords: archivedEvent.attendanceRecords,
        } as Partial<Event>);
        if (Platform.OS === "web") {
          window.alert(
            "Event archived successfully. It now appears in the Archive tab.",
          );
          router.back();
          return;
        }
        Alert.alert("Archived", "Event archived successfully.", [
          {
            text: "Back to Attendance List",
            onPress: () => router.back(),
          },
        ]);
      } catch (error) {
        console.error("Failed to archive event:", error);
        Alert.alert("Archive failed", "Could not archive this event.");
      }
    };

    if (unchecked > 0) {
      if (Platform.OS === "web") {
        const proceed = window.confirm(
          `${unchecked} participant${unchecked === 1 ? "" : "s"} are still unchecked.\n\nClick OK to continue archiving, or Cancel to stop.`,
        );
        if (!proceed) return;
        const markUnchecked = window.confirm(
          'Click OK to mark unchecked participants as "Did not attend" before archiving.\nClick Cancel to archive as-is.',
        );
        await proceedArchive(markUnchecked);
        return;
      }
      Alert.alert(
        "Archive with unchecked participants?",
        `${unchecked} participant${unchecked === 1 ? "" : "s"} are still unchecked.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Archive + Mark Unchecked as Did Not Attend",
            style: "destructive",
            onPress: () => proceedArchive(true),
          },
          {
            text: "Archive As-Is",
            onPress: () => proceedArchive(false),
          },
        ],
      );
      return;
    }

    await proceedArchive(false);
  };

  const unarchiveEventOnly = async () => {
    if (!event) return;

    const runUnarchive = async () => {
      try {
        const updatedAt = new Date().toISOString();
        const unarchivedEvent = {
          ...event,
          archived: false,
          updatedAt,
        };
        setEvent(unarchivedEvent);
        await eventsLocalStorage.update(event.id, {
          archived: false,
          updatedAt,
        } as Partial<Event>);

        if (Platform.OS === "web") {
          window.alert(
            "Event unarchived successfully. It now appears in the Events tab.",
          );
          return;
        }

        Alert.alert("Unarchived", "Event moved back to active events.");
      } catch (error) {
        console.error("Failed to unarchive event:", error);
        Alert.alert("Unarchive failed", "Could not unarchive this event.");
      }
    };

    if (Platform.OS === "web") {
      const proceed = window.confirm("Move this event back to active events?");
      if (!proceed) return;
      await runUnarchive();
      return;
    }

    Alert.alert("Unarchive Event", "Move this event back to active events?", [
      { text: "Cancel", style: "cancel" },
      { text: "Unarchive", onPress: () => runUnarchive() },
    ]);
  };

  const visibleParticipants = useMemo(() => {
    if (!event) return [];
    const statusMap = getAttendanceMap(event);
    const mapped = event.participants
      .filter((participant) => !participant.deletedAt)
      .map((participant) => ({
        participant,
        state:
          statusMap[participant.id] ||
          statusMap[participant.name] ||
          "unchecked",
      }));

    const filteredByStatus = mapped.filter((row) => {
      if (participantView === "unchecked") return row.state === "unchecked";
      if (participantView === "attended") return row.state === "attended";
      if (participantView === "not-attended")
        return row.state === "not-attended";
      return true;
    });

    const normalizedSearch = searchTerm.trim().toLowerCase();
    const filtered = normalizedSearch
      ? filteredByStatus.filter((row) =>
          (row.participant.name || "").toLowerCase().includes(normalizedSearch),
        )
      : filteredByStatus;

    return filtered.sort((a, b) => {
      const rank = (state: AttendanceState) =>
        state === "unchecked" ? 0 : state === "attended" ? 1 : 2;
      if (rank(a.state) !== rank(b.state)) return rank(a.state) - rank(b.state);
      return a.participant.name.localeCompare(b.participant.name);
    });
  }, [event, participantView, searchTerm]);

  if (!event) {
    return (
      <ThemedView style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <IconSymbol name="chevron.left" size={24} color={tintColor} />
          </Pressable>
          <ThemedText type="title">Attendance</ThemedText>
        </View>
        <View style={styles.emptyContainer}>
          <ThemedText>Event not found.</ThemedText>
        </View>
      </ThemedView>
    );
  }

  const participantCount = event.participants.filter(
    (p) => !p.deletedAt,
  ).length;
  const preEventStage = eventIsInFuture(event);
  const attendanceStage = !preEventStage && hasAttendanceOutcomes(event);
  const totalAttended = getCountByState("attended");
  const totalNotAttended = getCountByState("not-attended");
  const totalUnchecked = getCountByState("unchecked");
  const attendedLabel = attendanceStage ? "attended" : "attending";
  const notAttendedLabel = attendanceStage ? "did not attend" : "not attending";
  const uncheckedLabel = attendanceStage ? "unchecked" : "no response";

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <IconSymbol name="chevron.left" size={24} color={tintColor} />
        </Pressable>
        <ThemedText type="title">Attendance: {event.name}</ThemedText>
      </View>

      <ScrollView style={styles.content}>
        <View style={[styles.card, { backgroundColor: cardBg }]}>
          <ThemedText style={styles.metaText}>
            Event date: {formatEventDate(event)}
          </ThemedText>
          <View style={styles.metaSummaryRow}>
            <Pressable onPress={() => setParticipantView("attended")}>
              <ThemedText style={[styles.metaText, styles.metaLink]}>
                {totalAttended}/{participantCount} {attendedLabel}
              </ThemedText>
            </Pressable>
            <ThemedText style={styles.metaText}>•</ThemedText>
            <Pressable onPress={() => setParticipantView("not-attended")}>
              <ThemedText style={[styles.metaText, styles.metaLink]}>
                {totalNotAttended} {notAttendedLabel}
              </ThemedText>
            </Pressable>
            <ThemedText style={styles.metaText}>•</ThemedText>
            <Pressable onPress={() => setParticipantView("unchecked")}>
              <ThemedText style={[styles.metaText, styles.metaLink]}>
                {totalUnchecked} {uncheckedLabel}
              </ThemedText>
            </Pressable>
          </View>

          <View style={styles.exportActions}>
            <Pressable
              style={[styles.exportButton, { backgroundColor: "#16a34a" }]}
              onPress={markAllAttendingAsAttended}
            >
              <ThemedText style={styles.exportButtonText}>
                Mark 'Attending' as Attended
              </ThemedText>
            </Pressable>
            <Pressable
              style={[styles.exportButton, { backgroundColor: "#dc2626" }]}
              onPress={markAllNotAttendingAsNotAttended}
            >
              <ThemedText style={styles.exportButtonText}>
                Mark 'Not Attending' as Did Not Attend
              </ThemedText>
            </Pressable>
            <Pressable
              style={[styles.exportButton, { backgroundColor: tintColor }]}
              onPress={exportReport}
            >
              <ThemedText style={styles.exportButtonText}>
                Export CSV
              </ThemedText>
            </Pressable>
            <Pressable
              style={[styles.exportButton, { backgroundColor: "#6b7280" }]}
              onPress={finalizeAttendance}
            >
              <ThemedText style={styles.exportButtonText}>
                Finalize Attendance
              </ThemedText>
            </Pressable>
            <Pressable
              style={[styles.printButton, { borderColor: tintColor }]}
              onPress={exportPdfReport}
            >
              <ThemedText
                style={[styles.printButtonText, { color: tintColor }]}
              >
                Export PDF
              </ThemedText>
            </Pressable>
            <Pressable
              style={[
                styles.exportButton,
                { backgroundColor: event.archived ? "#0f766e" : "#111827" },
              ]}
              onPress={event.archived ? unarchiveEventOnly : archiveEventOnly}
            >
              <ThemedText style={styles.exportButtonText}>
                {event.archived ? "Unarchive Event" : "Archive Event"}
              </ThemedText>
            </Pressable>
          </View>

          {preEventStage ? (
            <ThemedText style={[styles.metaText, { marginBottom: 12 }]}>
              RSVP stage — attendance marking unlocks on the event date ({formatEventDate(event)}).
            </ThemedText>
          ) : null}

          <View style={styles.viewControls}>
            {(
              [
                "all",
                "unchecked",
                "attended",
                "not-attended",
              ] as ParticipantView[]
            ).map((view) => (
              <Pressable
                key={view}
                onPress={() => setParticipantView(view)}
                style={[
                  styles.filterChip,
                  participantView === view && {
                    backgroundColor: `${tintColor}15`,
                    borderColor: tintColor,
                  },
                ]}
              >
                <ThemedText
                  style={[
                    styles.filterChipText,
                    participantView === view && { color: tintColor },
                  ]}
                >
                  {view === "all"
                    ? "All"
                    : view === "unchecked"
                      ? attendanceStage
                        ? "Unchecked"
                        : "No Response"
                      : view === "attended"
                        ? attendanceStage
                          ? "Attended"
                          : "Attending"
                        : attendanceStage
                          ? "Did Not Attend"
                          : "Not Attending"}
                </ThemedText>
              </Pressable>
            ))}
          </View>

          <TextInput
            style={[
              styles.searchInput,
              { color: textColor, backgroundColor: surfaceColor },
            ]}
            value={searchTerm}
            onChangeText={setSearchTerm}
            placeholder="Search participants (e.g. sc)"
            placeholderTextColor="#9ca3af"
            autoCapitalize="none"
            autoCorrect={false}
          />

          {visibleParticipants.length === 0 ? (
            <View style={styles.emptyContainer}>
              <ThemedText style={{ opacity: 0.5 }}>
                No participants in this filter
              </ThemedText>
            </View>
          ) : (
            <View style={styles.attendanceRows}>
              {visibleParticipants.map(({ participant, state }) => {
                const loadingKey = `${event.id}:${participant.id}`;
                const isUpdating = updatingKey === loadingKey;
                const attended = state === "attended";
                const notAttended = state === "not-attended";
                const secondaryActionLabel = preEventStage
                  ? "Open"
                  : notAttended
                    ? "Set Unchecked"
                    : attendanceStage
                      ? "Mark Not Attended"
                      : "Set Not Attending";

                return (
                  <View
                    key={participant.id}
                    style={[
                      styles.attendanceRow,
                      attended && styles.attendanceRowAttended,
                      notAttended && styles.attendanceRowNotAttended,
                      isUpdating && { opacity: 0.55 },
                    ]}
                  >
                    <Pressable
                      style={styles.attendedToggle}
                      onPress={() =>
                        preEventStage
                          ? openParticipant(participant.id)
                          : toggleAttended(participant.id)
                      }
                      disabled={isUpdating}
                    >
                      <IconSymbol
                        name={attended ? "checkmark.circle.fill" : "circle"}
                        size={20}
                        color={attended ? "#16a34a" : "#9ca3af"}
                      />
                      <View style={styles.attendanceNameWrap}>
                        <ThemedText style={styles.attendanceName}>
                          {participant.name}
                        </ThemedText>
                        <ThemedText style={styles.attendanceStateText}>
                          {attended
                            ? attendanceStage
                              ? "Attended"
                              : "Attending"
                            : notAttended
                              ? attendanceStage
                                ? "Did Not Attend"
                                : "Not Attending"
                              : attendanceStage
                                ? `Unchecked${participant.rsvpStatus ? ` (RSVP: ${participant.rsvpStatus === 'attending' ? 'Attending' : participant.rsvpStatus === 'not-attending' ? 'Not Attending' : 'No Response'})` : ''}`
                                : "No Response"}
                        </ThemedText>
                      </View>
                    </Pressable>

                    <Pressable
                      style={[
                        styles.notAttendedButton,
                        notAttended ? styles.notAttendedButtonActive : null,
                      ]}
                      onPress={() =>
                        preEventStage
                          ? openParticipant(participant.id)
                          : toggleNotAttended(participant.id)
                      }
                      disabled={isUpdating}
                    >
                      <ThemedText
                        style={[
                          styles.notAttendedButtonText,
                          notAttended
                            ? styles.notAttendedButtonTextActive
                            : null,
                        ]}
                      >
                        {secondaryActionLabel}
                      </ThemedText>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        <View style={{ height: insets.bottom + 80 }} />
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 12,
  },
  backButton: { padding: 4 },
  content: { flex: 1, paddingHorizontal: 20 },
  card: { padding: 16, borderRadius: 12, marginBottom: 12 },
  metaText: { fontSize: 13, opacity: 0.75, marginBottom: 4 },
  metaSummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 4,
  },
  metaLink: {
    textDecorationLine: "underline",
    opacity: 0.95,
  },
  exportActions: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 12,
    marginBottom: 16,
  },
  exportButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    borderRadius: 12,
    minWidth: 150,
  },
  exportButtonText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  printButton: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  printButtonText: { fontSize: 14, fontWeight: "600" },
  searchInput: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    fontSize: 14,
  },
  viewControls: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  filterChip: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6b7280",
  },
  attendanceRows: {
    gap: 8,
  },
  attendanceRow: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    backgroundColor: "#f8fafc",
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  attendanceRowAttended: {
    borderColor: "#16a34a",
    backgroundColor: "#f0fdf4",
  },
  attendanceRowNotAttended: {
    borderColor: "#dc2626",
    backgroundColor: "#fef2f2",
  },
  attendedToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    minHeight: 28,
  },
  attendanceNameWrap: {
    flex: 1,
    minWidth: 0,
  },
  attendanceName: {
    fontSize: 14,
    fontWeight: "600",
  },
  attendanceStateText: {
    fontSize: 11,
    fontWeight: "500",
    opacity: 0.65,
    marginTop: 2,
  },
  notAttendedButton: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: "#ffffff",
  },
  notAttendedButtonActive: {
    borderColor: "#dc2626",
    backgroundColor: "#fee2e2",
  },
  notAttendedButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6b7280",
  },
  notAttendedButtonTextActive: {
    color: "#991b1b",
  },
  emptyContainer: {
    paddingVertical: 24,
    alignItems: "center",
  },
});
