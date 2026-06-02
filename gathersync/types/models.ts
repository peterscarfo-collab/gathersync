/**
 * Core data models for GatherSync
 */

export interface Participant {
  id: string;
  name: string;
  availability: Record<string, boolean>; // Key: YYYY-MM-DD, Value: available
  unavailableAllMonth: boolean;
  notes?: string; // Optional notes about the participant
  source?: 'manual' | 'contacts' | 'ai'; // How the participant was added
  phone?: string; // Phone number (from contacts or manual entry)
  email?: string; // Email address (from contacts or manual entry)
  designation?: string; // Title or Designation (e.g. Director, Treasurer)
  organization?: string; // Company or Organization
  leadSource?: string; // Lead source (e.g. Letterbox, Trade Show, Referral)
  rsvpStatus?: 'attending' | 'not-attending' | 'no-response'; // RSVP status for fixed events
  digitalTwinUrl?: string; // Optional URL to GetBizCard digital twin
  deletedAt?: string; // ISO date string when participant was soft-deleted
}

export interface Event {
  id: string;
  userId?: number;
  isInvited?: boolean;
  name: string;
  eventType: 'flexible' | 'fixed'; // Type of event
  month: number; // 1-12
  year: number;
  fixedDate?: string; // YYYY-MM-DD for fixed events
  fixedTime?: string; // HH:MM for fixed events
  participants: Participant[];
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
  reminderDaysBefore?: number; // Optional: days before best day to send reminder
  reminderScheduled?: boolean; // Whether reminder notification is scheduled
  reminderMessage?: string; // Custom reminder message to send to participants
  archived?: boolean; // Whether event is archived
  finalized?: boolean; // Whether event date has been finalized
  finalizedDate?: string; // The finalized date (YYYY-MM-DD)
  teamLeader?: string; // Name of the team leader or organizer
  teamLeaderPhone?: string; // Phone number of the team leader
  meetingType?: 'in-person' | 'virtual'; // Type of meetingeting
  venueName?: string; // Name of venue for in-person meetings
  venueAddress?: string; // Full address of venue from Google Maps
  venueContact?: string; // Contact person at venue
  venuePhone?: string; // Phone number for venue
  meetingLink?: string; // Zoom/virtual meeting link
  rsvpDeadline?: string; // When headcount needs to be confirmed (e.g., "Monday before")
  meetingNotes?: string; // Additional meeting details
  hideAttendeeNames?: boolean; // Legacy privacy setting
  showAttendeeNames?: boolean; // Privacy setting: if true, show names on public page
  showAttendeeEmails?: boolean; // Privacy setting: if true, show emails on public page
  showAttendeePhones?: boolean; // Privacy setting: if true, show phones on public page
  digitalTwinUrl?: string; // Optional URL to GetBizCard digital twin
  quorumType?: 'number' | 'percentage'; // Minimum attendance requirement type
  quorumValue?: number; // Minimum attendance requirement value
  attendanceRecords?: AttendanceRecord[]; // Attendance tracking for completed events
  deletedAt?: string; // ISO date string when event was soft-deleted
  /** When App Email was last sent — used to default follow-up sends to UPDATE mode */
  lastInvitationSentAt?: string;
}

export interface EventSnapshot {
  id: string;
  eventId: string;
  name: string;
  savedAt: string; // ISO date string
  event: Event; // Full event state
}

export interface GroupTemplate {
  id: string;
  name: string;
  participantNames: string[];
  createdAt: string; // ISO date string
}

export type RecurrencePattern = 'weekly' | 'biweekly' | 'monthly' | 'custom';

export interface RecurringEventTemplate {
  id: string;
  name: string; // e.g., "Book Club", "Team Meeting"
  pattern: RecurrencePattern;
  dayOfWeek?: number; // 0-6 for weekly/biweekly (0 = Sunday)
  dayOfMonth?: number; // 1-31 for monthly
  weekOfMonth?: number; // 1-5 for monthly (e.g., "First Friday" = week 1, day 5)
  participantNames: string[];
  active: boolean;
  createdAt: string; // ISO date string
  lastGeneratedMonth?: string; // YYYY-MM format
  teamLeader?: string; // Name of person responsible for organizing
  meetingType?: 'in-person' | 'virtual'; // Type of meeting
  venueName?: string; // Name of venue for in-person meetings
  venueAddress?: string; // Full address of venue from Google Maps
  venueContact?: string; // Contact person at venue
  venuePhone?: string; // Phone number for venue
  meetingLink?: string; // Zoom/virtual meeting link
  rsvpDeadline?: string; // When headcount needs to be confirmed
  meetingNotes?: string; // Additional meeting details
  eventType?: 'flexible' | 'fixed'; // Inherited event type
  fixedTime?: string; // Inherited fixed time HH:MM
}

export interface DayAvailability {
  date: string; // YYYY-MM-DD
  availableCount: number;
  unavailableCount: number;
  noResponseCount: number;
  participants: {
    id: string;
    name: string;
    status: 'available' | 'unavailable' | 'no-response';
  }[];
}

export interface BestDay {
  date: string; // YYYY-MM-DD
  availableCount: number;
  percentage: number; // 0-100
}

export interface AttendanceRecord {
  date: string; // ISO date string when attendance was recorded
  attendees: string[]; // Names of participants who attended
  statuses?: Record<string, string>; // Map of participant ID or name to their attendance status ('attended', 'not-attended', 'unchecked')
}

export type InfluencerProspectType =
  | 'mastermind'
  | 'skool'
  | 'bni'
  | 'real_estate'
  | 'sales_team'
  | 'group_coach'
  | 'podcast'
  | 'meetup'
  | 'franchise'
  | 'ai_peer_group'
  | 'directory_prospect'
  | 'other';

export type InfluencerPriorityTier = 'A' | 'B' | 'C';

/** High-level outreach track — filter the pipeline without splitting storage */
export type OutreachTrack = 'influencer' | 'prospect';

export type InfluencerStatus =
  | 'research'
  | 'contacted'
  | 'follow_up_1'
  | 'follow_up_2'
  | 'interested'
  | 'lifetime_granted'
  | 'active'
  | 'declined'
  | 'not_a_fit';

export interface InfluencerProspect {
  id: string;
  name: string;
  platform?: string;
  handleUrl?: string;
  niche?: string;
  followersOrMembers?: string;
  recurringGroup: boolean;
  groupNameFrequency?: string;
  prospectType: InfluencerProspectType;
  /** Influencer = LinkedIn/HeyGen niche outreach; Prospect = directory / phone-first contacts */
  outreachTrack?: OutreachTrack;
  scoreOutOf25?: number;
  priorityTier: InfluencerPriorityTier;
  contactEmail?: string;
  contactPhone?: string;
  websiteUrl?: string;
  contactLinkedIn?: string;
  outreachDate?: string;
  /** When the full LinkedIn DM (video + links) was sent after they accepted */
  fullDmSentDate?: string;
  followUp1Date?: string;
  followUp2Date?: string;
  status: InfluencerStatus;
  lifetimeProGranted: boolean;
  grantDate?: string;
  onboardingCallDone: boolean;
  deliverableAgreed?: string;
  deliverableDone: boolean;
  referralLink?: string;
  signupsFromRef?: number;
  /** Revenue attributed to this prospect (subscription, lifetime, etc.) */
  saleAmount?: number;
  saleDate?: string;
  saleNotes?: string;
  /** What you offer this prospect — merged into scripts and DMs */
  giftOffer?: string;
  /** Editable HeyGen script saved per prospect */
  heyGenScriptDraft?: string;
  /** Editable LinkedIn first-touch message saved per prospect */
  linkedInDmDraft?: string;
  /** SMS / text message draft for directory prospects (phone-first outreach) */
  smsDraft?: string;
  /** HeyGen (or other) personalized intro video URL for LinkedIn outreach */
  personalVideoUrl?: string;
  notes?: string;
  participantDirectoryId?: string;
  addedToParticipantDirectoryAt?: string;
  createdAt: string;
  updatedAt: string;
}
