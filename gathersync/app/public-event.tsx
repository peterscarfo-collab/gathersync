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
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { Event, Participant } from "@/types/models";
import { getMonthName } from "@/lib/calendar-utils";
import { getApiBaseUrl } from "@/constants/oauth";
import {
  getTwinLinkLabel,
  resolveHostProfile,
} from "@/lib/public-event-utils";

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
                .filter((dateStr) => existingParticipant.availability[dateStr])
                .map(dateStr => {
                  const parts = dateStr.split('-');
                  if (parts.length === 3) return parseInt(parts[2], 10);
                  return parseInt(dateStr, 10);
                })
                .filter(d => !isNaN(d));
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

  const handleRsvpSelect = async (status: "attending" | "not-attending") => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setRsvpStatus(status);
    
    // Auto-submit if we already have their name
    if (name.trim()) {
      await submitResponse(status, selectedDays);
    }
  };

  const submitResponse = async (
    currentRsvpStatus: "attending" | "not-attending" | "no-response",
    currentSelectedDays: number[]
  ) => {
    if (!event) return;

    if (!name.trim()) {
      Alert.alert("Name Required", "Please enter your name to continue.");
      return;
    }

    if (event.eventType === "flexible" && currentSelectedDays.length === 0) {
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
        payload.rsvpStatus = currentRsvpStatus;
      } else {
        const availability: Record<string, boolean> = {};
        currentSelectedDays.forEach((day) => {
          const dateStr = `${event.year}-${String(event.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          availability[dateStr] = true;
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
      
      // Only show alert if they manually clicked submit (not auto-submit)
      if (!participantName || event.eventType === "flexible") {
        Alert.alert(
          "Response Submitted!",
          "Thank you for responding. The organizer has been notified.",
          [{ text: "OK" }]
        );
      }
    } catch (error) {
      console.error("[PublicEvent] Error submitting response:", error);
      Alert.alert("Error", "Failed to submit your response. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = () => submitResponse(rsvpStatus, selectedDays);


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
  const hostProfile = resolveHostProfile(event);
  const attendingCount = event.participants.filter((p) => p.rsvpStatus === "attending").length;
  const webContainer = Platform.OS === "web" ? styles.webContainer : undefined;

  const openUrl = (url: string) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    Linking.openURL(url);
  };

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={[
        styles.scrollContent,
        webContainer,
        {
          paddingTop: Math.max(insets.top, 20) + 12,
          paddingBottom: Math.max(insets.bottom, 20) + 20,
        },
      ]}
    >
      {/* Compact branding */}
      <View style={styles.header}>
        <Image
          source={require("@/assets/images/icon.png")}
          style={{ width: 36, height: 36, borderRadius: 10, marginBottom: 8 }}
        />
        <Text style={styles.logoSmall}>GatherSync</Text>
      </View>

      {/* Event hero */}
      <View style={styles.eventCard}>
        {event.meetingType && (
          <View
            style={[
              styles.typeBadge,
              event.meetingType === "virtual" && styles.typeBadgeVirtual,
            ]}
          >
            <Text style={styles.typeBadgeText}>
              {event.meetingType === "virtual" ? "Virtual" : "In person"}
            </Text>
          </View>
        )}
        <Text style={styles.eventName}>{event.name}</Text>
        {event.eventType === "fixed" && event.fixedDate ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center" }}>
            <Text style={styles.eventDatePrimary}>
              {new Date(event.fixedDate + "T12:00:00").toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </Text>
            {event.fixedTime && (
              <Text style={styles.eventTimePrimary}>
                {(() => {
                  const [hours, minutes] = event.fixedTime.split(":").map(Number);
                  const ampm = hours >= 12 ? "PM" : "AM";
                  const displayHours = hours % 12 || 12;
                  return `${displayHours}:${String(minutes).padStart(2, "0")} ${ampm}`;
                })()}
              </Text>
            )}
          </View>
        ) : (
          <Text style={styles.eventDatePrimary}>
            {getMonthName(event.month)} {event.year}
          </Text>
        )}

        {event.teamLeader && (
          <Text style={styles.hostedBy}>
            Hosted by <Text style={styles.hostedByName}>{event.teamLeader}</Text>
          </Text>
        )}

        {event.venueName && (
          <View style={styles.detailBlock}>
            <Text style={styles.detailLabel}>Venue</Text>
            <Text style={styles.detailValue}>{event.venueName}</Text>
          </View>
        )}

        {event.rsvpDeadline && (
          <View style={styles.detailBlock}>
            <Text style={styles.detailLabel}>RSVP by</Text>
            <Text style={styles.detailValue}>{event.rsvpDeadline}</Text>
          </View>
        )}

        {event.meetingNotes && (
          <View style={[styles.detailBlock, styles.notesBlock]}>
            <Text style={styles.notesText}>{event.meetingNotes}</Text>
          </View>
        )}
      </View>

      {/* Host Digital Twin — prominent CTA */}
      {hostProfile && (
        <View style={styles.hostCard}>
          <Text style={styles.hostEyebrow}>Meet your host</Text>
          <Text style={styles.hostName}>{hostProfile.name}</Text>
          {hostProfile.subtitle ? (
            <Text style={styles.hostSubtitle}>{hostProfile.subtitle}</Text>
          ) : null}
          <Text style={styles.hostBlurb}>
            Watch a quick intro before you RSVP — learn what to expect and who is hosting.
          </Text>
          <Pressable
            style={styles.hostButton}
            onPress={() => openUrl(hostProfile.digitalTwinUrl)}
          >
            <Text style={styles.hostButtonText}>
              {getTwinLinkLabel(hostProfile.digitalTwinUrl)}
            </Text>
          </Pressable>
        </View>
      )}

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
          {participantName ? (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Responding as</Text>
              <View style={[styles.input, { backgroundColor: '#e5e5ea', borderColor: '#d1d1d6' }]}>
                <Text style={{ fontSize: 16, color: '#1c1c1e', fontWeight: '500' }}>{name}</Text>
              </View>
            </View>
          ) : (
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
          )}

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
                  onPress={() => handleRsvpSelect("attending")}
                  disabled={submitting}
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
                  onPress={() => handleRsvpSelect("not-attending")}
                  disabled={submitting}
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
              {submitting && (
                <ActivityIndicator style={{ marginTop: 16 }} color="#007AFF" />
              )}
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

          {/* Submit Button (Only show for flexible events or if name is missing) */}
          {(!participantName || event.eventType === "flexible") && (
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
          )}
        </View>
      ) : (
        <View style={styles.responseSection}>
          <Text style={styles.successTitle}>✓ Response Submitted</Text>
          <Text style={styles.successText}>
            Thank you for responding! The organizer has been notified.
          </Text>
          {event.eventType === "fixed" && (
            <>
              <Text style={styles.successDetail}>
                Your RSVP: <Text style={styles.successBold}>{rsvpStatus === "attending" ? "Attending" : "Not Attending"}</Text>
              </Text>
              {rsvpStatus === "attending" && event.meetingType === "virtual" && event.meetingLink && (
                <View style={styles.infoCallout}>
                  <Text style={styles.infoCalloutTitle}>Meeting link</Text>
                  <Pressable onPress={() => openUrl(event.meetingLink!)}>
                    <Text style={styles.infoCalloutLink}>{event.meetingLink}</Text>
                  </Pressable>
                </View>
              )}
              {hostProfile && (
                <View style={[styles.infoCallout, { marginTop: 16 }]}>
                  <Text style={styles.infoCalloutTitle}>Thanks for RSVPing!</Text>
                  <Text style={styles.infoCalloutBody}>
                    Want to know more about {hostProfile.name} before the event?
                  </Text>
                  <Pressable
                    style={[styles.hostButton, { marginTop: 12 }]}
                    onPress={() => openUrl(hostProfile.digitalTwinUrl)}
                  >
                    <Text style={styles.hostButtonText}>
                      {getTwinLinkLabel(hostProfile.digitalTwinUrl)}
                    </Text>
                  </Pressable>
                </View>
              )}
            </>
          )}
          {event.eventType === "flexible" && selectedDays.length > 0 && (
            <>
              <Text style={styles.successDetail}>
                You're available on: <Text style={styles.successBold}>{selectedDays.length} days</Text>
              </Text>
              {hostProfile && (
                <View style={[styles.infoCallout, { marginTop: 16 }]}>
                  <Text style={styles.infoCalloutTitle}>Learn about your host</Text>
                  <Pressable
                    style={[styles.hostButton, { marginTop: 12 }]}
                    onPress={() => openUrl(hostProfile.digitalTwinUrl)}
                  >
                    <Text style={styles.hostButtonText}>
                      {getTwinLinkLabel(hostProfile.digitalTwinUrl)}
                    </Text>
                  </Pressable>
                </View>
              )}
            </>
          )}
        </View>
      )}

      {/* Attendees List */}
      {event.eventType === "fixed" && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            Attending{attendingCount > 0 ? ` (${attendingCount})` : ""}
          </Text>
          {event.participants.filter(p => p.rsvpStatus === "attending").length === 0 ? (
            <Text style={styles.emptyText}>No attendees yet.</Text>
          ) : (
            <View style={styles.attendeesList}>
              {event.showAttendeeNames === false ? (
                <Text style={styles.attendeeCountText}>
                  {event.participants.filter(p => p.rsvpStatus === "attending").length} people attending
                </Text>
              ) : (
                event.participants
                  .filter(p => p.rsvpStatus === "attending")
                  .map(p => (
                    <View key={p.id} style={styles.attendeeItem}>
                      <Text style={styles.attendeeName}>{p.name}</Text>
                      {event.showAttendeeEmails && p.email && (
                        <Text style={{ fontSize: 14, color: '#666', marginTop: 2 }}>{p.email}</Text>
                      )}
                      {event.showAttendeePhones && p.phone && (
                        <Text style={{ fontSize: 14, color: '#666', marginTop: 2 }}>{p.phone}</Text>
                      )}
                    </View>
                  ))
              )}
            </View>
          )}
        </View>
      )}

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
  webContainer: {
    maxWidth: 480,
    width: "100%",
    alignSelf: "center",
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
    marginBottom: 20,
  },
  logoSmall: {
    fontSize: 13,
    fontWeight: "600",
    color: "#8e8e93",
    letterSpacing: 0.3,
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
  typeBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#e8f4fd",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 12,
  },
  typeBadgeVirtual: {
    backgroundColor: "#f0ebff",
  },
  typeBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#007AFF",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  eventDatePrimary: {
    fontSize: 17,
    fontWeight: "600",
    color: "#1c1c1e",
    marginBottom: 4,
  },
  eventTimePrimary: {
    fontSize: 17,
    fontWeight: "600",
    color: "#007AFF",
    marginBottom: 8,
  },
  hostedBy: {
    fontSize: 15,
    color: "#666",
    marginTop: 8,
    marginBottom: 4,
  },
  hostedByName: {
    fontWeight: "600",
    color: "#1c1c1e",
  },
  detailBlock: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#e5e5ea",
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#8e8e93",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 16,
    color: "#1c1c1e",
    fontWeight: "500",
  },
  notesBlock: {
    backgroundColor: "#f9f9fb",
    marginTop: 16,
    padding: 14,
    borderRadius: 10,
    borderTopWidth: 0,
  },
  notesText: {
    fontSize: 15,
    color: "#444",
    lineHeight: 22,
  },
  hostCard: {
    backgroundColor: "#1a2744",
    borderRadius: 16,
    padding: 22,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  hostEyebrow: {
    fontSize: 12,
    fontWeight: "600",
    color: "#8eb4ff",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  hostName: {
    fontSize: 22,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 4,
  },
  hostSubtitle: {
    fontSize: 14,
    color: "#b8c9e8",
    marginBottom: 12,
  },
  hostBlurb: {
    fontSize: 14,
    color: "#d0daf0",
    lineHeight: 20,
    marginBottom: 16,
  },
  hostButton: {
    backgroundColor: "#007AFF",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: "center",
  },
  hostButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  featuredRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  featuredSubtitle: {
    fontSize: 13,
    color: "#666",
    marginTop: 2,
  },
  featuredButton: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  featuredButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 13,
  },
  infoCallout: {
    marginTop: 16,
    padding: 16,
    backgroundColor: "#f0f8ff",
    borderRadius: 12,
  },
  infoCalloutTitle: {
    fontWeight: "600",
    color: "#1c1c1e",
    marginBottom: 6,
    fontSize: 15,
  },
  infoCalloutBody: {
    color: "#666",
    fontSize: 14,
    lineHeight: 20,
  },
  infoCalloutLink: {
    color: "#007AFF",
    textDecorationLine: "underline",
    fontSize: 14,
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
  attendeesList: {
    marginTop: 8,
    gap: 8,
  },
  attendeeItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  attendeeName: {
    fontSize: 16,
    color: "#1c1c1e",
    fontWeight: "500",
  },
  attendeeCountText: {
    fontSize: 16,
    color: "#007AFF",
    fontWeight: "600",
    textAlign: "center",
    paddingVertical: 12,
  },
  emptyText: {
    fontSize: 15,
    color: "#8e8e93",
    fontStyle: "italic",
    textAlign: "center",
    paddingVertical: 16,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1c1c1e",
    marginBottom: 12,
  },
});
