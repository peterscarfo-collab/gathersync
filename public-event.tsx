// @ts-nocheck
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import * as Clipboard from "expo-clipboard";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  Linking,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { Event, Participant } from "@/types/models";
import { getMonthName } from "@/lib/calendar-utils";
import { getApiBaseUrl } from "@/constants/oauth";
import { db } from "@/lib/db";

export default function PublicEventScreen() {
  const params = useLocalSearchParams();
  const getParamString = (value: unknown): string => {
    if (Array.isArray(value)) return (value[0] || "").toString();
    return typeof value === "string" ? value : "";
  };
  const normalizeEventId = (raw: string): string => {
    if (!raw) return "";
    let decoded = raw;
    try {
      decoded = decodeURIComponent(raw);
    } catch {
      decoded = raw;
    }
    const trimmed = decoded.trim();
    if (!trimmed) return "";

    // Most robust path: extract UUID even if extra text is appended.
    const uuidMatch = trimmed.match(
      /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/
    );
    if (uuidMatch) return uuidMatch[0];

    // Fallback: first token before whitespace/query separators.
    return trimmed.split(/[\s&#?]/)[0] || "";
  };

  // Accept multiple key variants to be resilient to external/shared links.
  const rawEventId =
    getParamString((params as any).eventId) ||
    getParamString((params as any).eventid) ||
    getParamString((params as any).id);
  const eventId = normalizeEventId(rawEventId || "");
  const participantName =
    getParamString((params as any).name) ||
    getParamString((params as any).participantName);

  const [event, setEvent] = useState<Event | null>(null);
  // Calendar sizing — pixel-exact so it never blows up on wide screens.
  // 7 equal columns inside a 392px container → each cell is 56 × 48px.
  // 6 rows × (48 + 2px gap) = 300px grid + ~24px header ≈ 324px total.
  const CELL_W = 56;
  const CELL_H = 48;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState(participantName);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [rsvpStatus, setRsvpStatus] = useState<"attending" | "not-attending" | "no-response">(
    "no-response"
  );
  const [rsvpTouched, setRsvpTouched] = useState(false);
  const [notes, setNotes] = useState("");
  const [hasResponded, setHasResponded] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isNarrowScreen = width < 420;

  useEffect(() => {
    if (eventId) loadEvent();
    else setLoading(false);
  }, [eventId]);

  const normalizeEvent = (raw: any): Event | null => {
    if (!raw) return null;
    const participants = (raw.participants || [])
      .filter((p: any) => !p.deletedAt)
      .map((p: any) => ({
        id: p.id,
        name: p.name,
        phone: p.phone,
        email: p.email,
        availability: (p.availability || {}) as Record<string, boolean>,
        unavailableAllMonth: p.unavailableAllMonth,
        notes: p.notes,
        source: p.source,
        rsvpStatus: p.rsvpStatus,
        createdAt: typeof p.createdAt === 'string' ? p.createdAt : p.createdAt?.toISOString?.(),
        updatedAt: typeof p.updatedAt === 'string' ? p.updatedAt : p.updatedAt?.toISOString?.(),
      }));
    return {
      id: raw.id,
      name: raw.name,
      eventType: raw.eventType || 'flexible',
      month: raw.month,
      year: raw.year,
      fixedDate: raw.fixedDate,
      fixedTime: raw.fixedTime,
      teamLeader: raw.teamLeader,
      teamLeaderPhone: raw.teamLeaderPhone,
      teamLeaderEmail: raw.teamLeaderEmail,
      meetingType: raw.meetingType,
      venueName: raw.venueName,
      venueAddress: raw.venueAddress,
      venueContact: raw.venueContact,
      venuePhone: raw.venuePhone,
      meetingLink: raw.meetingLink,
      rsvpDeadline: raw.rsvpDeadline,
      meetingNotes: raw.meetingNotes,
      createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : raw.createdAt?.toISOString?.(),
      updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : raw.updatedAt?.toISOString?.(),
      participants,
    };
  };

  const applyLoadedEvent = (loadedEvent: Event) => {
    if (!loadedEvent) return;
    setEvent(loadedEvent);

    const extractSelectedDays = (participant: Participant) => {
      const availability = participant.availability || {};
      const days = Object.entries(availability)
        .filter(([, isAvailable]) => isAvailable)
        .map(([key]) => {
          if (/^\d+$/.test(key)) {
            const dayNumber = Number(key);
            return dayNumber >= 1 && dayNumber <= 31 ? dayNumber : null;
          }
          const match = key.match(/^(\d{4})-(\d{2})-(\d{2})$/);
          if (!match) return null;
          const year = Number(match[1]);
          const month = Number(match[2]);
          const day = Number(match[3]);
          if (year === loadedEvent.year && month === loadedEvent.month && day >= 1 && day <= 31) {
            return day;
          }
          return null;
        })
        .filter((day): day is number => day !== null);
      return Array.from(new Set(days)).sort((a, b) => a - b);
    };

    const applyParticipantSelection = (participant: Participant) => {
      setName(participant.name);
      setNotes(participant.notes || "");

      if (loadedEvent.eventType === "fixed") {
        const existingRsvp =
          participant.rsvpStatus === "attending" || participant.rsvpStatus === "not-attending"
            ? participant.rsvpStatus
            : "no-response";
        setRsvpStatus(existingRsvp);
        setRsvpTouched(existingRsvp !== "no-response");
        setSelectedDays([]);
        return;
      }

      setSelectedDays(extractSelectedDays(participant));
      setRsvpStatus("no-response");
      setRsvpTouched(false);
    };

    if (participantName) {
      const existingParticipant = loadedEvent.participants.find(
        (p) => p.name.toLowerCase() === participantName.toLowerCase()
      );
      if (existingParticipant) {
        applyParticipantSelection(existingParticipant);
      }
    }
  };

  const handleNameChipSelect = (participant: Participant) => {
    if (name === participant.name) {
      // Toggle off when tapping the already-selected participant.
      setName("");
      setNotes("");
      if (event?.eventType === "fixed") {
        setRsvpStatus("no-response");
        setRsvpTouched(false);
      } else {
        setSelectedDays([]);
      }
      return;
    }

    setName(participant.name);
    setNotes(participant.notes || "");
    if (event?.eventType === "fixed") {
      const existingRsvp =
        participant.rsvpStatus === "attending" || participant.rsvpStatus === "not-attending"
          ? participant.rsvpStatus
          : "no-response";
      setRsvpStatus(existingRsvp);
      setRsvpTouched(existingRsvp !== "no-response");
      setSelectedDays([]);
      return;
    }

    const availableDays = Object.entries(participant.availability || {})
      .filter(([, isAvailable]) => isAvailable)
      .map(([key]) => {
        if (/^\d+$/.test(key)) return Number(key);
        const match = key.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        return match ? Number(match[3]) : NaN;
      })
      .filter((day) => Number.isFinite(day) && day >= 1 && day <= 31);
    setSelectedDays(Array.from(new Set(availableDays)).sort((a, b) => a - b));
    setRsvpStatus("no-response");
    setRsvpTouched(false);
  };

  const loadEvent = async () => {
    if (!eventId) return;
    try {
      setLoading(true);
      const apiBase = getApiBaseUrl();
      const apiUrl = apiBase ? `${apiBase}/api/public/events/${eventId}` : `/api/public/events/${eventId}`;

      const response = await fetch(apiUrl);
      if (response.ok) {
        const loadedEvent = normalizeEvent(await response.json());
        if (loadedEvent) {
          applyLoadedEvent(loadedEvent);
          return;
        }
      }

      // Fallback: if API returned 404 and user may be logged in, try InstantDB
      const { data } = await db.queryOnce({
        events: {
          $: { where: { id: eventId } },
          participants: {},
        },
      });
      const instantEvent = data?.events?.[0];
      if (instantEvent && !instantEvent.deletedAt) {
        const mapped: Event = {
          id: instantEvent.id,
          name: instantEvent.name,
          eventType: instantEvent.eventType || 'flexible',
          month: instantEvent.month,
          year: instantEvent.year,
          fixedDate: instantEvent.fixedDate,
          fixedTime: instantEvent.fixedTime,
          teamLeader: instantEvent.teamLeader,
          teamLeaderPhone: instantEvent.teamLeaderPhone,
          teamLeaderEmail: instantEvent.teamLeaderEmail,
          meetingType: instantEvent.meetingType,
          venueName: instantEvent.venueName,
          venueAddress: instantEvent.venueAddress,
          venueContact: instantEvent.venueContact,
          venuePhone: instantEvent.venuePhone,
          meetingLink: instantEvent.meetingLink,
          rsvpDeadline: instantEvent.rsvpDeadline,
          meetingNotes: instantEvent.meetingNotes,
          createdAt: typeof instantEvent.createdAt === 'string' ? instantEvent.createdAt : instantEvent.createdAt?.toISOString?.(),
          updatedAt: typeof instantEvent.updatedAt === 'string' ? instantEvent.updatedAt : instantEvent.updatedAt?.toISOString?.(),
          participants: (instantEvent.participants || [])
            .filter((p: any) => !p.deletedAt)
            .map((p: any) => ({
              id: p.id,
              name: p.name,
              phone: p.phone,
              email: p.email,
              availability: (p.availability || {}) as Record<string, boolean>,
              unavailableAllMonth: p.unavailableAllMonth,
              notes: p.notes,
              source: p.source,
              rsvpStatus: p.rsvpStatus,
              createdAt: typeof p.createdAt === 'string' ? p.createdAt : p.createdAt?.toISOString?.(),
              updatedAt: typeof p.updatedAt === 'string' ? p.updatedAt : p.updatedAt?.toISOString?.(),
            })),
        };
        applyLoadedEvent(mapped);
        return;
      }

      setEvent(null);
    } catch (error) {
      console.error("[PublicEvent] Error loading event:", error);
      setEvent(null);
    } finally {
      setLoading(false);
    }
  };

  const handleDayToggle = (day: number) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const getPublicApiUrl = (path: string) => {
    const base = getApiBaseUrl();
    if (base) return `${base}${path}`;
    if (typeof window !== "undefined") return `${window.location.origin}${path}`;
    return path;
  };

  const handleSubmit = async () => {
    if (!event) return;

    setSubmitError(null);

    if (!name.trim()) {
      setSubmitError("Please enter your name.");
      return;
    }

    if (event.eventType === "flexible" && selectedDays.length === 0) {
      setSubmitError("Please select at least one day you're available.");
      return;
    }

    if (event.eventType === "fixed" && (!rsvpTouched || rsvpStatus === "no-response")) {
      setSubmitError("Please tap Attending or Not Attending before submitting.");
      return;
    }

    try {
      setSubmitting(true);

      const payload: {
        participantName: string;
        rsvpStatus?: string;
        availability?: Record<string, boolean>;
        notes?: string;
      } = {
        participantName: name.trim(),
      };

      if (event.eventType === "fixed") {
        // Fixed events now always require an explicit RSVP selection.
        payload.rsvpStatus = rsvpStatus;
      } else {
        const availability: Record<string, boolean> = {};
        selectedDays.forEach((day) => {
          const dateKey = `${event.year}-${String(event.month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          availability[dateKey] = true;
        });
        payload.availability = availability;
      }
      if (notes.trim()) payload.notes = notes.trim();

      const apiUrl = getPublicApiUrl(`/api/public/events/${event.id}/participants`);
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const responseText = await response.text();

      if (!response.ok) {
        throw new Error(responseText || `HTTP ${response.status}`);
      }

      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      // Optimistic update: reflect submitted selections in local event state so
      // that tapping a name chip again (or pressing "Update my response") still
      // shows the correct checked days without a server round-trip.
      setEvent((prev) => {
        if (!prev) return prev;
        const trimmedName = name.trim();
        if (prev.eventType === "flexible") {
          const newAvailability: Record<string, boolean> = {};
          selectedDays.forEach((day) => {
            const dateKey = `${prev.year}-${String(prev.month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            newAvailability[dateKey] = true;
          });
          const existingIdx = prev.participants.findIndex(
            (p) => p.name.toLowerCase() === trimmedName.toLowerCase()
          );
          const updatedParticipants =
            existingIdx >= 0
              ? prev.participants.map((p, i) =>
                  i === existingIdx ? { ...p, availability: newAvailability } : p
                )
              : [
                  ...prev.participants,
                  {
                    id: `optimistic-${Date.now()}`,
                    name: trimmedName,
                    availability: newAvailability,
                  } as typeof prev.participants[number],
                ];
          return { ...prev, participants: updatedParticipants };
        }
        return prev;
      });

      setHasResponded(true);
      setSubmitError(null);
      Alert.alert(
        "Response Submitted!",
        "Thank you for responding. The organizer has been notified.",
        [{ text: "OK" }]
      );
    } catch (error: any) {
      const errMsg = error?.message || "Failed to submit. Please check your connection and try again.";
      console.error("[PublicEvent] Submit error:", error);
      setSubmitError(errMsg);
      Alert.alert("Error", errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleImportToApp = async () => {
    if (!event) return;

    // Always use gathersync:// (never manus or other legacy schemes)
    const scheme = "gathersync";
    const importData = encodeURIComponent(JSON.stringify(event));
    const deepLink = `${scheme}://import-event?data=${importData}`;

    // On web: always open import in a new tab so people keep this page context.
    if (Platform.OS === "web") {
      try {
        if (typeof window !== "undefined") {
          const importUrl = `${window.location.origin}/import-event?data=${importData}`;
          const opened = window.open(importUrl, "_blank", "noopener,noreferrer");
          if (opened) {
            setActionMessage("Opened GatherSync import in a new tab. Keep this page open.");
            return;
          }
          // Popup blocked: continue in this tab instead of exposing low-level fallback options.
          window.location.href = importUrl;
          return;
        }
      } catch (error) {
        console.error("[PublicEvent] Failed to open import screen:", error);
      }
      setActionMessage("Could not open GatherSync import right now. Please try again.");
      return;
    }

    try {
      const canOpen = await Linking.canOpenURL(deepLink);
      if (canOpen) {
        await Linking.openURL(deepLink);
      } else {
        Alert.alert(
          "App Not Installed",
          "GatherSync app is required to import events. Would you like to download it?",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Download", onPress: handleDownloadApp },
          ]
        );
      }
    } catch (error) {
      console.error("[PublicEvent] Error opening deep link:", error);
      Alert.alert(
        "Import Failed",
        "Could not open GatherSync app. Please make sure it's installed."
      );
      setActionMessage("Import failed. Please ensure the app is installed.");
    }
  };

  const getEventDetailsText = () => {
    if (!event) return "";
    const formatAuDate = (value?: string) => {
      if (!value) return "";
      const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!match) return value;
      const year = Number(match[1]);
      const month = Number(match[2]) - 1;
      const day = Number(match[3]);
      const date = new Date(year, month, day);
      const dd = String(date.getDate()).padStart(2, "0");
      const mm = String(date.getMonth() + 1).padStart(2, "0");
      const yyyy = String(date.getFullYear());
      return `${dd}/${mm}/${yyyy}`;
    };
    const formatAuTime = (value?: string) => {
      if (!value) return "";
      const match = value.match(/^(\d{1,2}):(\d{2})$/);
      if (!match) return value;
      let hour = Number(match[1]);
      const minute = Number(match[2]);
      const suffix = hour >= 12 ? "PM" : "AM";
      hour = hour % 12 || 12;
      if (minute === 0) return `${hour}${suffix}`;
      return `${hour}:${String(minute).padStart(2, "0")}${suffix}`;
    };
    const eventDate =
      event.eventType === "fixed"
        ? `${formatAuDate(event.fixedDate)}${event.fixedTime ? ` at ${formatAuTime(event.fixedTime)}` : ""}`
        : `${getMonthName(event.month)} ${event.year}`;
    const meetingTypeLabel =
      event.meetingType === "virtual"
        ? "Virtual"
        : event.meetingType === "in-person"
          ? "In Person"
          : event.meetingType === "hybrid"
            ? "Hybrid"
            : undefined;
    const participants = (event.participants || []).filter((participant) => !participant.deletedAt);
    const toAttendLabel = (participant: Participant) => {
      if (event.eventType === "fixed") {
        if (participant.rsvpStatus === "attending") return "Yes";
        if (participant.rsvpStatus === "not-attending") return "No";
        return "No Response";
      }
      const anyAvailable = Object.values(participant.availability || {}).some(Boolean);
      return anyAvailable ? "Yes" : "No Response";
    };
    const participantRows = participants.map((participant) => ({
      name: participant.name || "-",
      phone: participant.phone || "-",
      email: participant.email || "-",
      attending: toAttendLabel(participant),
    }));
    const participantHeader = ["Participant", "Phone", "Email", "Attending"];
    const colWidths = participantHeader.map((header, idx) =>
      Math.max(
        header.length,
        ...participantRows.map((row) =>
          idx === 0
            ? row.name.length
            : idx === 1
              ? row.phone.length
              : idx === 2
                ? row.email.length
                : row.attending.length
        )
      )
    );
    const formatRow = (cells: string[]) =>
      `${cells[0].padEnd(colWidths[0])}  ${cells[1].padEnd(colWidths[1])}  ${cells[2].padEnd(colWidths[2])}  ${cells[3].padEnd(colWidths[3])}`;
    const participantsTable = [
      formatRow(participantHeader),
      `${"-".repeat(colWidths[0])}  ${"-".repeat(colWidths[1])}  ${"-".repeat(colWidths[2])}  ${"-".repeat(colWidths[3])}`,
      ...participantRows.map((row) => formatRow([row.name, row.phone, row.email, row.attending])),
    ].join("\n");
    const publicUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}/public-event?eventId=${event.id}`
        : "";

    return [
      "GatherSync Event Details",
      "========================",
      "",
      `Event        : ${event.name}`,
      `When         : ${eventDate}`,
      meetingTypeLabel ? `Meeting Type: ${meetingTypeLabel}` : null,
      event.teamLeader ? `Team Leader  : ${event.teamLeader}` : null,
      event.teamLeaderEmail ? `Leader Email : ${event.teamLeaderEmail}` : null,
      event.teamLeaderPhone ? `Leader Phone : ${event.teamLeaderPhone}` : null,
      event.venueName ? `Venue        : ${event.venueName}` : null,
      event.venueAddress ? `Address      : ${event.venueAddress}` : null,
      event.venueContact ? `Venue Contact: ${event.venueContact}` : null,
      event.venuePhone ? `Venue Phone  : ${event.venuePhone}` : null,
      event.meetingLink ? `Meeting Link : ${event.meetingLink}` : null,
      publicUrl ? `Public RSVP   : ${publicUrl}` : null,
      "",
      `Participants (${participants.length})`,
      "----------------",
      participants.length > 0 ? participantsTable : "No participants listed.",
      event.meetingNotes ? `\nNotes\n-----\n${event.meetingNotes}` : null,
    ]
      .filter(Boolean)
      .join("\n");
  };

  const handleDownloadEventDetails = () => {
    if (!event) return;
    const details = getEventDetailsText();
    const filename = `${event.name.replace(/[^a-z0-9]/gi, "_")}_details.txt`;

    if (typeof document !== "undefined" && typeof Blob !== "undefined") {
      try {
        const blob = new Blob([details], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.style.display = "none";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 500);
        setActionMessage("Event details saved to your device.");
      } catch (e) {
        console.error("[PublicEvent] Download details failed:", e);
        setActionMessage("Could not save details on this browser.");
      }
    } else {
      Alert.alert("Save Details", "Saving details is currently available on web.");
    }
  };

  const handleDownloadApp = () => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const webAppUrl = `${window.location.origin}/`;
      try {
        const opened = window.open(webAppUrl, "_blank", "noopener,noreferrer");
        if (!opened) {
          window.location.href = webAppUrl;
        }
      } catch (error) {
        window.location.href = webAppUrl;
      }
      Alert.alert(
        "Opening GatherSync",
        "Opened GatherSync. Tap Log In to create or access your account."
      );
      return;
    }

    const message =
      "GatherSync is currently in beta on web. " +
      "Email hello@gathersync.app to request mobile app access.";
    Alert.alert("Beta Access", message, [
      { text: "OK" },
      {
        text: "Copy Email",
        onPress: async () => {
          await Clipboard.setStringAsync("hello@gathersync.app");
          Alert.alert("Copied!", "hello@gathersync.app copied to clipboard");
        },
      },
    ]);
  };

  if (!eventId) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Text style={styles.errorText}>Invalid link</Text>
        <Text style={styles.errorSubtext}>
          This event link appears to be invalid or incomplete. Please ask the organizer to share the correct link.
        </Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading event...</Text>
      </View>
    );
  }

  if (!event) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Text style={styles.errorText}>Event not found</Text>
        <Text style={styles.errorSubtext}>
          This event may have been deleted or the link is invalid.{"\n\n"}
          If you're the organizer: Open the event in the app while online so it can sync, then try the link again.
        </Text>
      </View>
    );
  }

  const daysInMonth = new Date(event.year, event.month, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const fixedRsvpReady = event.eventType !== "fixed" || (rsvpTouched && rsvpStatus !== "no-response");
  const selectedDaySummary = selectedDays
    .slice()
    .sort((a, b) => a - b)
    .map((day) => {
      const date = new Date(event.year, event.month - 1, day);
      const weekday = date.toLocaleDateString("en-US", { weekday: "short" });
      return `${weekday} ${day}`;
    })
    .join(", ");
  const meetingTypeDisplay =
    event.meetingType === "virtual"
      ? "Virtual"
      : event.meetingType === "in-person"
        ? "In Person"
        : event.meetingType === "hybrid"
          ? "Hybrid"
          : null;
  const formatAuDate = (value?: string) => {
    if (!value) return "";
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return value;
    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    const day = Number(match[3]);
    const date = new Date(year, month, day);
    const dd = String(date.getDate()).padStart(2, "0");
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const yyyy = String(date.getFullYear());
    return `${dd}/${mm}/${yyyy}`;
  };
  const formatAuTime = (value?: string) => {
    if (!value) return "";
    const match = value.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return value;
    let hour = Number(match[1]);
    const minute = Number(match[2]);
    const suffix = hour >= 12 ? "PM" : "AM";
    hour = hour % 12 || 12;
    if (minute === 0) return `${hour}${suffix}`;
    return `${hour}:${String(minute).padStart(2, "0")}${suffix}`;
  };

  return (
    <ScrollView
      style={styles.scrollView}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[
        styles.scrollContent,
        {
          paddingTop: Math.max(insets.top, 20) + 20,
          paddingBottom: Math.max(insets.bottom, 20) + 20,
        },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>GatherSync</Text>
        <Text style={styles.tagline}>Find the perfect time, together</Text>
      </View>

      {/* Event Card */}
      <View style={[styles.eventCard, isNarrowScreen && styles.cardCompact]}>
        <Text style={styles.eventName}>{event.name}</Text>
        {event.eventType === "fixed" && event.fixedDate ? (
          <Text style={styles.eventDate}>
            {formatAuDate(event.fixedDate)}
            {event.fixedTime ? ` at ${formatAuTime(event.fixedTime)}` : ""}
          </Text>
        ) : (
          <Text style={styles.eventDate}>
            {getMonthName(event.month)} {event.year}
          </Text>
        )}

        {meetingTypeDisplay ? <Text style={styles.eventMeta}>Meeting Type: {meetingTypeDisplay}</Text> : null}

        {(event.teamLeader || event.teamLeaderPhone || event.teamLeaderEmail) && (
          <View style={styles.venueInfo}>
            <Text style={styles.venueLabel}>👤 Team Leader</Text>
            {event.teamLeader ? <Text style={styles.venueName}>{event.teamLeader}</Text> : null}
            {event.teamLeaderEmail ? <Text style={styles.venueDetail}>{event.teamLeaderEmail}</Text> : null}
            {event.teamLeaderPhone ? <Text style={styles.venueDetail}>{event.teamLeaderPhone}</Text> : null}
          </View>
        )}

        {(event.venueName || event.venueAddress || event.venueContact || event.venuePhone) && (
          <View style={styles.venueInfo}>
            <Text style={styles.venueLabel}>📍 Venue</Text>
            {event.venueName ? <Text style={styles.venueName}>{event.venueName}</Text> : null}
            {event.venueAddress ? <Text style={styles.venueDetail}>{event.venueAddress}</Text> : null}
            {event.venueContact ? <Text style={styles.venueDetail}>Contact: {event.venueContact}</Text> : null}
            {event.venuePhone ? <Text style={styles.venueDetail}>Phone: {event.venuePhone}</Text> : null}
          </View>
        )}

        {event.meetingType === "virtual" && event.meetingLink && (
          <View style={styles.venueInfo}>
            <Text style={styles.venueLabel}>🔗 Meeting Link</Text>
            <Text style={styles.venueDetail} selectable>{event.meetingLink}</Text>
          </View>
        )}

        {event.meetingNotes && (
          <View style={[styles.venueInfo, { marginTop: 8 }]}>
            <Text style={styles.venueLabel}>📝 Notes</Text>
            <Text style={styles.venueDetail}>{event.meetingNotes}</Text>
          </View>
        )}
      </View>

      {/* Response Section */}
      {!hasResponded ? (
        <View style={[styles.responseSection, isNarrowScreen && styles.cardCompact]}>
          <View style={styles.accountNotice}>
            <Text style={styles.accountNoticeTitle}>Response vs account</Text>
            <Text style={styles.accountNoticeText}>
              Submitting this form saves your response for the organizer. It does not automatically create a full
              GatherSync account.
            </Text>
          </View>
          <Text style={styles.sectionTitle}>
            {event.eventType === "fixed" ? "RSVP to this event" : "Mark your availability"}
          </Text>
          <Text style={styles.sectionSubtitle}>
            {event.eventType === "fixed"
              ? "Let the organizer know if you can attend"
              : "Select all days you're available"}
          </Text>

          {/* Name Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Your Name</Text>
            {event.participants.length > 0 && !participantName ? (
              <View style={styles.participantChips}>
                <Text style={styles.participantChipsHint}>Tap if you&apos;re on the list:</Text>
                <Text style={styles.participantChipsNote}>
                  Click a name to load their current availability selections.
                </Text>
                <View style={styles.participantChipsRow}>
                  {event.participants
                    .filter((p) => !p.deletedAt)
                    .map((p) => (
                      <Pressable
                        key={p.id}
                        style={[styles.participantChip, name === p.name && styles.participantChipSelected]}
                        onPress={() => handleNameChipSelect(p)}
                      >
                        <Text style={[styles.participantChipText, name === p.name && styles.participantChipTextSelected]}>
                          {p.name}
                        </Text>
                      </Pressable>
                    ))}
                </View>
                {name && event.eventType === "flexible" ? (
                  <Text style={styles.participantSelectionStatus}>
                    {selectedDays.length > 0
                      ? `Loaded for ${name}: ${selectedDaySummary}`
                      : `No saved day selections found yet for ${name}.`}
                  </Text>
                ) : null}
              </View>
            ) : null}
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder={event.participants.length > 0 ? "Or enter your name" : "Enter your name"}
              placeholderTextColor="#999"
              autoCapitalize="words"
            />
          </View>

          {/* Optional Notes */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Notes (optional)</Text>
            <TextInput
              style={[styles.input, styles.notesInput]}
              value={notes}
              onChangeText={setNotes}
              placeholder="e.g. Date doesn't suit, can't make it, or any message for the organizer"
              placeholderTextColor="#999"
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Fixed Event RSVP */}
          {event.eventType === "fixed" && (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Will you attend?</Text>
              <Text style={styles.rsvpRequiredHint}>Required: choose one option before submitting.</Text>
              <View style={[styles.rsvpButtons, isNarrowScreen && styles.stackedButtons]}>
                <Pressable
                  style={[
                    styles.rsvpButton,
                    rsvpStatus === "attending" && styles.rsvpButtonActive,
                  ]}
                  onPress={() => {
                    setRsvpTouched(true);
                    setRsvpStatus("attending");
                  }}
                >
                  <Text
                    style={[
                      styles.rsvpButtonText,
                      rsvpStatus === "attending" && styles.rsvpButtonTextActive,
                    ]}
                  >
                    Attending
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.rsvpButton,
                    rsvpStatus === "not-attending" && styles.rsvpButtonActive,
                  ]}
                  onPress={() => {
                    setRsvpTouched(true);
                    setRsvpStatus("not-attending");
                  }}
                >
                  <Text
                    style={[
                      styles.rsvpButtonText,
                      rsvpStatus === "not-attending" && styles.rsvpButtonTextActive,
                    ]}
                  >
                    Not Attending
                  </Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* Flexible Event Calendar */}
          {event.eventType === "flexible" && (
            <View style={styles.calendarSection}>
              {/* Heading */}
              <Text style={styles.calendarMonthHeading}>
                {getMonthName(event.month)} {event.year}
              </Text>
              <Text style={styles.calendarContext}>Tap each day you&apos;re available</Text>

              {/* Fixed-width calendar box — never stretches on wide screens */}
              <View style={styles.calendarOuter}>
                <View style={[styles.calendar, { width: CELL_W * 7 }]}>
                  {/* Weekday headers */}
                  <View style={styles.calendarHeaderRow}>
                    {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                      <View key={i} style={[styles.calendarHeaderCell, { width: CELL_W }]}>
                        <Text style={styles.calendarHeaderText}>{d}</Text>
                      </View>
                    ))}
                  </View>
                  {/* Day grid */}
                  <View style={styles.calendarGrid}>
                    {Array.from({ length: new Date(event.year, event.month - 1, 1).getDay() }).map((_, i) => (
                      <View key={`empty-${i}`} style={[styles.dayButton, { width: CELL_W, height: CELL_H }]} />
                    ))}
                    {days.map((day) => {
                      const isSelected = selectedDays.includes(day);
                      return (
                        <Pressable
                          key={day}
                          style={[styles.dayButton, { width: CELL_W, height: CELL_H }, isSelected && styles.dayButtonSelected]}
                          onPress={() => handleDayToggle(day)}
                        >
                          <Text style={[styles.dayText, isSelected && styles.dayTextSelected]}>{day}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              </View>

              {/* Participant Selections — visible immediately below calendar */}
              {selectedDays.length > 0 && (
                <View style={styles.selectionSummary}>
                  <Text style={styles.selectionSummaryLabel}>Your selections:</Text>
                  <Text style={styles.selectionSummaryDays}>{selectedDaySummary}</Text>
                </View>
              )}
            </View>
          )}

          {/* Submit Button */}
          <Pressable
            style={[
              styles.submitButton,
              (!fixedRsvpReady || submitting) && styles.submitButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={submitting || !fixedRsvpReady}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitButtonText}>Submit Response</Text>
            )}
          </Pressable>
          {submitError ? (
            <Text style={styles.submitErrorText}>{submitError}</Text>
          ) : null}
        </View>
      ) : (
        <View style={styles.responseSection}>
          <Text style={styles.successTitle}>✓ Response Submitted</Text>
          <Text style={styles.successText}>
            Thank you for responding! The organizer has been notified.
          </Text>
          <Text style={styles.accountStatusText}>
            You&apos;ve submitted a response. To create or access your GatherSync account, tap Open GatherSync and log
            in with a verification code.
          </Text>
          {event.eventType === "fixed" && (
            <Text style={styles.successDetail}>
              Your RSVP: <Text style={styles.successBold}>{rsvpStatus === "attending" ? "Attending" : "Not Attending"}</Text>
            </Text>
          )}
          {event.eventType === "flexible" && selectedDays.length > 0 && (
            <Text style={styles.successDetail}>
              You&apos;re available on:{"\n"}
              <Text style={styles.successBold}>{selectedDaySummary}</Text>
            </Text>
          )}
          {notes.trim() ? (
            <Text style={[styles.successDetail, { marginTop: 8 }]}>
              Your note: <Text style={styles.successBold}>{notes.trim()}</Text>
            </Text>
          ) : null}
          <Pressable
            style={[styles.updateResponseButton]}
            onPress={() => setHasResponded(false)}
          >
            <Text style={styles.updateResponseText}>Update my response</Text>
          </Pressable>
        </View>
      )}

      {/* Download & App CTA - always visible, response or not */}
      <View style={[styles.ctaSection, isNarrowScreen && styles.cardCompact]}>
        <Text style={styles.ctaTitle}>Open GatherSync</Text>
        <Text style={styles.ctaText}>
          Use Log In to create or access your account, then import this event in one step.
        </Text>
        <Pressable style={[styles.accountPrimaryButton]} onPress={handleDownloadApp}>
          <Text style={styles.accountPrimaryButtonText}>Open GatherSync / Log In</Text>
        </Pressable>
        {actionMessage ? <Text style={styles.actionMessageText}>{actionMessage}</Text> : null}
        <View style={[styles.primaryActionsRow, isNarrowScreen && styles.stackedButtons]}>
          <Pressable style={[styles.compactButton, styles.importButton]} onPress={handleImportToApp}>
            <Text style={styles.importButtonText}>Import Event to My App</Text>
          </Pressable>
          <Pressable style={[styles.compactButton, styles.downloadEventButton]} onPress={handleDownloadEventDetails}>
            <Text style={styles.downloadEventButtonText}>Save Details</Text>
          </Pressable>
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>Powered by GatherSync</Text>
        <Text style={styles.footerSubtext}>gathersync.app</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: "#f5f5f7",
  },
  scrollContent: {
    padding: 20,
  },
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f7",
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#666",
  },
  errorText: {
    fontSize: 20,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  errorSubtext: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: 32,
  },
  logo: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#007AFF",
    marginBottom: 4,
  },
  tagline: {
    fontSize: 14,
    color: "#666",
  },
  eventCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  eventName: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1c1c1e",
    marginBottom: 8,
  },
  eventDate: {
    fontSize: 16,
    color: "#666",
    marginBottom: 16,
  },
  eventMeta: {
    fontSize: 14,
    color: "#374151",
    marginBottom: 12,
    fontWeight: "500",
  },
  venueInfo: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#e5e5ea",
  },
  venueLabel: {
    fontSize: 12,
    color: "#666",
    marginBottom: 4,
  },
  venueName: {
    fontSize: 16,
    fontWeight: "500",
    color: "#1c1c1e",
    marginBottom: 4,
  },
  venueDetail: {
    fontSize: 14,
    color: "#4b5563",
    marginTop: 2,
  },
  responseSection: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  cardCompact: {
    padding: 16,
    borderRadius: 14,
  },
  accountNotice: {
    backgroundColor: "#eef2ff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#c7d2fe",
  },
  accountNoticeTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#3730a3",
    marginBottom: 4,
  },
  accountNoticeText: {
    fontSize: 13,
    color: "#4338ca",
    lineHeight: 18,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#1c1c1e",
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: "#666",
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#1c1c1e",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#f5f5f7",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: "#1c1c1e",
    borderWidth: 1,
    borderColor: "#e5e5ea",
  },
  notesInput: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  participantChips: {
    marginBottom: 12,
  },
  participantChipsHint: {
    fontSize: 12,
    color: "#666",
    marginBottom: 4,
  },
  participantChipsNote: {
    fontSize: 12,
    color: "#4b5563",
    marginBottom: 8,
  },
  participantSelectionStatus: {
    marginTop: 8,
    fontSize: 12,
    color: "#374151",
    lineHeight: 17,
  },
  participantChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  participantChip: {
    backgroundColor: "#f5f5f7",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e5e5ea",
  },
  participantChipSelected: {
    backgroundColor: "#007AFF",
    borderColor: "#007AFF",
  },
  participantChipText: {
    fontSize: 14,
    color: "#1c1c1e",
    fontWeight: "500",
  },
  participantChipTextSelected: {
    color: "#fff",
  },
  rsvpButtons: {
    flexDirection: "row",
    gap: 12,
  },
  stackedButtons: {
    flexDirection: "column",
  },
  rsvpRequiredHint: {
    fontSize: 13,
    color: "#b45309",
    marginBottom: 10,
    fontWeight: "500",
  },
  rsvpButton: {
    flex: 1,
    backgroundColor: "#f5f5f7",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#e5e5ea",
  },
  rsvpButtonActive: {
    backgroundColor: "#007AFF",
    borderColor: "#007AFF",
  },
  rsvpButtonText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#1c1c1e",
  },
  rsvpButtonTextActive: {
    color: "#fff",
  },
  calendarSection: {
    marginBottom: 24,
  },
  calendarOuter: {
    // Centers the fixed-width calendar box; no flex-stretch allowed
    alignItems: "center",
    alignSelf: "center",
    maxWidth: "100%",
    marginTop: 8,
  },
  calendar: {
    // Width is set inline as CELL_W * 7 so it is always pixel-exact
    overflow: "hidden",
  },
  calendarMonthHeading: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 2,
    textAlign: "center",
  },
  calendarHeaderRow: {
    flexDirection: "row",
    marginBottom: 3,
  },
  calendarHeaderCell: {
    // Width set inline as CELL_W
    alignItems: "center",
    paddingVertical: 3,
  },
  calendarHeaderText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#9ca3af",
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  calendarContext: {
    fontSize: 11,
    color: "#9ca3af",
    marginBottom: 4,
    letterSpacing: 0.2,
    textAlign: "center",
  },
  dayButton: {
    // Width + height set inline from CELL_W / CELL_H constants
    borderRadius: 6,
    backgroundColor: "#f5f5f7",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e5e5ea",
    marginBottom: 2,
  },
  selectionSummary: {
    marginTop: 10,
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#eff6ff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    alignSelf: "center",
    maxWidth: "100%",
  },
  selectionSummaryLabel: {
    fontSize: 11,
    color: "#3b82f6",
    fontWeight: "600",
    marginBottom: 2,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  selectionSummaryDays: {
    fontSize: 14,
    color: "#1d4ed8",
    fontWeight: "600",
    textAlign: "center",
  },
  dayButtonSelected: {
    backgroundColor: "#007AFF",
    borderColor: "#007AFF",
  },
  dayWeekText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#6b7280",
    lineHeight: 12,
  },
  dayText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1c1c1e",
    lineHeight: 15,
  },
  dayTextSelected: {
    color: "#fff",
  },
  submitButton: {
    backgroundColor: "#007AFF",
    borderRadius: 12,
    padding: 18,
    alignItems: "center",
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitErrorText: {
    color: "#dc2626",
    fontSize: 14,
    marginTop: 12,
    textAlign: "center",
  },
  submitButtonText: {
    fontSize: 17,
    fontWeight: "600",
    color: "#fff",
  },
  successTitle: {
    fontSize: 24,
    fontWeight: "600",
    color: "#34c759",
    marginBottom: 12,
    textAlign: "center",
  },
  successText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginBottom: 16,
  },
  accountStatusText: {
    fontSize: 14,
    color: "#374151",
    textAlign: "center",
    marginBottom: 16,
    lineHeight: 20,
  },
  successDetail: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
  },
  successBold: {
    fontWeight: "600",
    color: "#1c1c1e",
  },
  updateResponseButton: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  updateResponseText: {
    fontSize: 14,
    color: "#007AFF",
    fontWeight: "500",
  },
  ctaSection: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  ctaTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#1c1c1e",
    marginBottom: 8,
  },
  ctaText: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginBottom: 12,
  },
  accountPrimaryButton: {
    width: "100%",
    borderRadius: 12,
    backgroundColor: "#1d4ed8",
    paddingVertical: 14,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  accountPrimaryButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
    textAlign: "center",
  },
  actionMessageText: {
    fontSize: 13,
    color: "#0a7a33",
    textAlign: "center",
    marginBottom: 12,
  },
  primaryActionsRow: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
    marginBottom: 10,
  },
  compactButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  downloadEventButton: {
    backgroundColor: "#007AFF",
  },
  downloadEventButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
    textAlign: "center",
  },
  importButton: {
    backgroundColor: "#5856d6",
  },
  importButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
    textAlign: "center",
  },
  footer: {
    alignItems: "center",
    paddingTop: 24,
  },
  footerText: {
    fontSize: 12,
    color: "#999",
    marginBottom: 4,
  },
  footerSubtext: {
    fontSize: 12,
    color: "#999",
  },
});
