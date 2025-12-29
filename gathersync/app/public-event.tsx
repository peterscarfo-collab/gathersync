import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { Event, Participant } from "@/types/models";
import { getMonthName } from "@/lib/calendar-utils";
import { getApiBaseUrl } from "@/constants/oauth";

export default function PublicEventScreen() {
  const params = useLocalSearchParams();
  const eventId = params.eventId as string;
  const participantName = (params.name as string) || "";

  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState(participantName);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [rsvpStatus, setRsvpStatus] = useState<"attending" | "not-attending" | "no-response">(
    "no-response"
  );
  const [hasResponded, setHasResponded] = useState(false);

  const insets = useSafeAreaInsets();

  useEffect(() => {
    loadEvent();
  }, [eventId]);

  const loadEvent = async () => {
    try {
      setLoading(true);
      console.log("[PublicEvent] Loading event:", eventId);
      console.log("[PublicEvent] API Base URL:", getApiBaseUrl());

      const response = await fetch(`${getApiBaseUrl()}/api/public/events/${eventId}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const loadedEvent: Event = await response.json();
      console.log("[PublicEvent] Loaded event:", loadedEvent);
      if (loadedEvent) {
        setEvent(loadedEvent);
        // Check if participant already exists (only if name parameter was provided)
        if (participantName) {
          const existingParticipant = loadedEvent.participants.find(
            (p) => p.name.toLowerCase() === participantName.toLowerCase()
          );
          if (existingParticipant) {
            // Load their existing response
            if (loadedEvent.eventType === "fixed") {
              setRsvpStatus(existingParticipant.rsvpStatus || "no-response");
            } else {
              const availableDays = Object.keys(existingParticipant.availability)
                .filter((day) => existingParticipant.availability[day])
                .map(Number);
              setSelectedDays(availableDays);
            }
            // Don't set hasResponded yet - let them update their response
          }
        }
      }
    } catch (error) {
      console.error("[PublicEvent] Error loading event:", error);
      Alert.alert("Error", "Failed to load event. Please try again.");
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

  const handleSubmit = async () => {
    if (!event) return;

    if (!name.trim()) {
      Alert.alert("Name Required", "Please enter your name to continue.");
      return;
    }

    if (event.eventType === "flexible" && selectedDays.length === 0) {
      Alert.alert("Selection Required", "Please select at least one day you're available.");
      return;
    }

    try {
      setSubmitting(true);

      // Update participant via public REST API
      const payload: {
        participantName: string;
        rsvpStatus?: string;
        availability?: Record<string, boolean>;
      } = {
        participantName: name.trim(),
      };

      if (event.eventType === "fixed") {
        payload.rsvpStatus = rsvpStatus;
      } else {
        const availability: Record<string, boolean> = {};
        selectedDays.forEach((day) => {
          availability[day.toString()] = true;
        });
        payload.availability = availability;
      }

      const response = await fetch(`${getApiBaseUrl()}/api/public/events/${event.id}/participants`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      setHasResponded(true);
      Alert.alert(
        "Response Submitted!",
        "Thank you for responding. The organizer has been notified.",
        [{ text: "OK" }]
      );
    } catch (error) {
      console.error("[PublicEvent] Error submitting response:", error);
      Alert.alert("Error", "Failed to submit your response. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleImportToApp = async () => {
    if (!event) return;

    // Create deep link to import event
    const scheme = "manus20251216190030"; // From app.config.ts
    const importData = encodeURIComponent(JSON.stringify(event));
    const deepLink = `${scheme}://import-event?data=${importData}`;

    try {
      const canOpen = await Linking.canOpenURL(deepLink);
      if (canOpen) {
        // App is installed - open it
        await Linking.openURL(deepLink);
      } else {
        // App not installed - prompt to download
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
    }
  };

  const handleDownloadApp = () => {
    // TODO: Replace with actual App Store/Play Store links
    const appStoreUrl = "https://apps.apple.com/app/gathersync/id123456789";
    const playStoreUrl = "https://play.google.com/store/apps/details?id=com.gathersync";

    Alert.alert(
      "Download GatherSync",
      "Get the full app to create your own events and manage group scheduling.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "App Store", onPress: () => Linking.openURL(appStoreUrl) },
        { text: "Play Store", onPress: () => Linking.openURL(playStoreUrl) },
      ]
    );
  };

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
          This event may have been deleted or the link is invalid.
        </Text>
      </View>
    );
  }

  const daysInMonth = new Date(event.year, event.month, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  return (
    <ScrollView
      style={styles.scrollView}
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
      <View style={styles.eventCard}>
        <Text style={styles.eventName}>{event.name}</Text>
        {event.eventType === "fixed" && event.fixedDate ? (
          <Text style={styles.eventDate}>
            {event.fixedDate}
            {event.fixedTime ? ` at ${event.fixedTime}` : ""}
          </Text>
        ) : (
          <Text style={styles.eventDate}>
            {getMonthName(event.month)} {event.year}
          </Text>
        )}

        {event.venueName && (
          <View style={styles.venueInfo}>
            <Text style={styles.venueLabel}>📍 Venue</Text>
            <Text style={styles.venueName}>{event.venueName}</Text>
          </View>
        )}
      </View>

      {/* Response Section */}
      {!hasResponded ? (
        <View style={styles.responseSection}>
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
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Enter your name"
              placeholderTextColor="#999"
              autoCapitalize="words"
            />
          </View>

          {/* Fixed Event RSVP */}
          {event.eventType === "fixed" && (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Will you attend?</Text>
              <View style={styles.rsvpButtons}>
                <Pressable
                  style={[
                    styles.rsvpButton,
                    rsvpStatus === "attending" && styles.rsvpButtonActive,
                  ]}
                  onPress={() => setRsvpStatus("attending")}
                >
                  <Text
                    style={[
                      styles.rsvpButtonText,
                      rsvpStatus === "attending" && styles.rsvpButtonTextActive,
                    ]}
                  >
                    ✓ Attending
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.rsvpButton,
                    rsvpStatus === "not-attending" && styles.rsvpButtonActive,
                  ]}
                  onPress={() => setRsvpStatus("not-attending")}
                >
                  <Text
                    style={[
                      styles.rsvpButtonText,
                      rsvpStatus === "not-attending" && styles.rsvpButtonTextActive,
                    ]}
                  >
                    ✗ Not Attending
                  </Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* Flexible Event Calendar */}
          {event.eventType === "flexible" && (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Available Days</Text>
              <View style={styles.calendar}>
                {days.map((day) => {
                  const isSelected = selectedDays.includes(day);
                  return (
                    <Pressable
                      key={day}
                      style={[styles.dayButton, isSelected && styles.dayButtonSelected]}
                      onPress={() => handleDayToggle(day)}
                    >
                      <Text style={[styles.dayText, isSelected && styles.dayTextSelected]}>
                        {day}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {/* Submit Button */}
          <Pressable
            style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitButtonText}>Submit Response</Text>
            )}
          </Pressable>
        </View>
      ) : (
        <View style={styles.responseSection}>
          <Text style={styles.successTitle}>✓ Response Submitted</Text>
          <Text style={styles.successText}>
            Thank you for responding! The organizer has been notified.
          </Text>
          {event.eventType === "fixed" && (
            <Text style={styles.successDetail}>
              Your RSVP: <Text style={styles.successBold}>{rsvpStatus === "attending" ? "Attending" : "Not Attending"}</Text>
            </Text>
          )}
          {event.eventType === "flexible" && selectedDays.length > 0 && (
            <Text style={styles.successDetail}>
              You're available on: <Text style={styles.successBold}>{selectedDays.length} days</Text>
            </Text>
          )}
        </View>
      )}

      {/* App Download CTA */}
      <View style={styles.ctaSection}>
        <Text style={styles.ctaTitle}>Get the GatherSync App</Text>
        <Text style={styles.ctaText}>
          Import this event to your app and manage your schedule with ease
        </Text>
        <Pressable style={styles.importButton} onPress={handleImportToApp}>
          <Text style={styles.importButtonText}>📥 Import to My App</Text>
        </Pressable>
        <Pressable style={styles.downloadButton} onPress={handleDownloadApp}>
          <Text style={styles.downloadButtonText}>Download App</Text>
        </Pressable>
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
  venueInfo: {
    paddingTop: 16,
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
  rsvpButtons: {
    flexDirection: "row",
    gap: 12,
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
  calendar: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  dayButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#f5f5f7",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e5e5ea",
  },
  dayButtonSelected: {
    backgroundColor: "#007AFF",
    borderColor: "#007AFF",
  },
  dayText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#1c1c1e",
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
  successDetail: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
  },
  successBold: {
    fontWeight: "600",
    color: "#1c1c1e",
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
    marginBottom: 20,
  },
  importButton: {
    backgroundColor: "#007AFF",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    marginBottom: 12,
  },
  importButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  downloadButton: {
    backgroundColor: "#34c759",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  downloadButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
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
