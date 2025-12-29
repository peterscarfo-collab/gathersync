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
  rsvpStatus?: 'attending' | 'not-attending' | 'no-response'; // RSVP status for fixed events
  deletedAt?: string; // ISO date string when participant was soft-deleted
}

export interface Event {
  id: string;
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
  attendanceRecords?: AttendanceRecord[]; // Attendance tracking for completed events
  deletedAt?: string; // ISO date string when event was soft-deleted
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
}
