/**
 * Utilities for determining participant response status and RSVP counts
 */

import type { Participant, Event } from '@/types/models';

/** Active participants (excludes soft-deleted) */
export function getActiveParticipants(event: Event): Participant[] {
  return (event.participants || []).filter(p => !p.deletedAt);
}

type AttendanceOutcome = 'attending' | 'not-attending' | 'no-response';

function getLatestAttendanceStatuses(event: Event): Record<string, string> | null {
  const records = (event as any)?.attendanceRecords;
  if (!Array.isArray(records) || records.length === 0) return null;

  const latest = [...records].sort(
    (a: any, b: any) => new Date(b?.date || 0).getTime() - new Date(a?.date || 0).getTime()
  )[0];

  if (!latest || typeof latest.statuses !== 'object' || latest.statuses === null) {
    return null;
  }

  return latest.statuses as Record<string, string>;
}

export function hasRecordedAttendance(event: Event): boolean {
  const statuses = getLatestAttendanceStatuses(event);
  if (!statuses) return false;
  return Object.values(statuses).some((value) => value === 'attended' || value === 'not-attended');
}

/**
 * Attendance is ground truth when present.
 * RSVP remains the fallback intent when attendance is missing.
 */
export function getEffectiveAttendanceStatus(participant: Participant, event: Event): AttendanceOutcome {
  const statuses = getLatestAttendanceStatuses(event);
  if (statuses) {
    const byId = participant.id ? statuses[participant.id] : undefined;
    const byName = participant.name ? statuses[participant.name] : undefined;
    const value = byId ?? byName;
    if (value === 'attended') return 'attending';
    if (value === 'not-attended') return 'not-attending';
  }

  if (participant.rsvpStatus === 'attending') return 'attending';
  if (participant.rsvpStatus === 'not-attending') return 'not-attending';
  return 'no-response';
}

/** RSVP counts for fixed events - use consistently for event card and event detail */
export function getRsvpCounts(event: Event): {
  attending: Participant[];
  notAttending: Participant[];
  noResponse: Participant[];
} {
  const active = getActiveParticipants(event);
  return {
    attending: active.filter((participant) => getEffectiveAttendanceStatus(participant, event) === 'attending'),
    notAttending: active.filter((participant) => getEffectiveAttendanceStatus(participant, event) === 'not-attending'),
    noResponse: active.filter((participant) => getEffectiveAttendanceStatus(participant, event) === 'no-response'),
  };
}
import { getDaysInMonth } from './calendar-utils';

export type ParticipantStatus = 'responded' | 'partial' | 'no-response' | 'attending' | 'not-attending';

/**
 * Get the response status for a participant
 */
export function getParticipantStatus(
  participant: Participant,
  event: Event
): ParticipantStatus {
  // If marked as unavailable all month, they've responded
  if (participant.unavailableAllMonth) {
    return 'responded';
  }

  // Count how many days they've marked
  const totalDays = getDaysInMonth(event.month, event.year);
  const markedDays = Object.keys(participant.availability).length;

  if (markedDays === 0) {
    return 'no-response';
  } else if (markedDays < totalDays) {
    return 'partial';
  } else {
    return 'responded';
  }
}

/**
 * Get status badge info (icon, color, label)
 */
export function getStatusBadge(status: ParticipantStatus): {
  icon: string;
  color: string;
  label: string;
} {
  switch (status) {
    case 'attending':
      return {
        icon: '✓',
        color: '#10B981', // green
        label: 'Attending',
      };
    case 'not-attending':
      return {
        icon: '✕',
        color: '#EF4444', // red
        label: 'Not Attending',
      };
    case 'responded':
      return {
        icon: '✓',
        color: '#10B981', // green
        label: 'Responded',
      };
    case 'partial':
      return {
        icon: '◐',
        color: '#F59E0B', // orange
        label: 'Partial',
      };
    case 'no-response':
    default:
      return {
        icon: '?',
        color: '#6B7280', // gray
        label: 'No Response',
      };
  }
}
