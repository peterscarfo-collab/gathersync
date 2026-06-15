import type { ConferenceSession, Event, SessionKind } from '@/types/models';

export type { SessionKind };

export const SESSION_KIND_OPTIONS: {
  value: SessionKind;
  label: string;
  defaultTitle: string;
}[] = [
  { value: 'talk', label: 'Talk / session', defaultTitle: '' },
  { value: 'breakfast', label: 'Breakfast', defaultTitle: 'Breakfast' },
  { value: 'lunch', label: 'Lunch', defaultTitle: 'Lunch' },
  { value: 'dinner', label: 'Dinner', defaultTitle: 'Dinner' },
  { value: 'coffee', label: 'Coffee break', defaultTitle: 'Coffee break' },
  { value: 'break', label: 'Break', defaultTitle: 'Break' },
];

export function getSessionKindLabel(kind?: SessionKind): string {
  return SESSION_KIND_OPTIONS.find((o) => o.value === (kind ?? 'talk'))?.label ?? 'Session';
}

export function defaultTitleForKind(kind: SessionKind): string {
  return SESSION_KIND_OPTIONS.find((o) => o.value === kind)?.defaultTitle ?? '';
}

export function isTalkSession(kind?: SessionKind): boolean {
  return (kind ?? 'talk') === 'talk';
}

export function resolveSessionTitle(kind: SessionKind, title: string): string {
  const trimmed = title.trim();
  if (trimmed) return trimmed;
  const fallback = defaultTitleForKind(kind);
  if (fallback) return fallback;
  return 'Session';
}

/** Format YYYY-MM-DD for display */
export function formatConferenceDate(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** e.g. "Mon, Jun 26 – Wed, Jun 28, 2026" */
export function formatConferenceDateRange(startDate?: string, endDate?: string): string {
  if (!startDate) return '';
  if (!endDate || endDate === startDate) {
    return formatConferenceDate(startDate);
  }
  const start = new Date(startDate + 'T12:00:00');
  const end = new Date(endDate + 'T12:00:00');
  const sameYear = start.getFullYear() === end.getFullYear();
  const startPart = start.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
  const endPart = end.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  return `${startPart} – ${endPart}`;
}

/** List YYYY-MM-DD strings from start through end inclusive */
export function getConferenceDayList(startDate: string, endDate: string): string[] {
  const days: string[] = [];
  const cursor = new Date(startDate + 'T12:00:00');
  const end = new Date(endDate + 'T12:00:00');
  while (cursor <= end) {
    const y = cursor.getFullYear();
    const m = String(cursor.getMonth() + 1).padStart(2, '0');
    const d = String(cursor.getDate()).padStart(2, '0');
    days.push(`${y}-${m}-${d}`);
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

export function formatTime12h(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${String(minutes).padStart(2, '0')} ${ampm}`;
}

export function toDateInputValue(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseDateInput(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0);
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function sessionsOverlap(a: ConferenceSession, b: ConferenceSession): boolean {
  if (a.date !== b.date) return false;
  return timeToMinutes(a.startTime) < timeToMinutes(b.endTime) &&
    timeToMinutes(b.startTime) < timeToMinutes(a.endTime);
}

export function sortSessions(sessions: ConferenceSession[]): ConferenceSession[] {
  return [...sessions]
    .filter((s) => !s.deletedAt)
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      if (a.startTime !== b.startTime) return a.startTime.localeCompare(b.startTime);
      return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    });
}

export function activeSessionCount(event: Event): number {
  return (event.sessions ?? []).filter((s) => !s.deletedAt).length;
}

export function validateConferenceDates(
  startDate: string,
  endDate: string,
): string | null {
  if (!startDate || !endDate) return 'Start and end dates are required';
  if (endDate < startDate) return 'End date must be on or after start date';
  return null;
}

export function validateSession(
  session: Pick<ConferenceSession, 'title' | 'date' | 'startTime' | 'endTime'>,
  event: Event,
): string | null {
  if (!session.title.trim()) return 'Session title is required';
  if (!session.date) return 'Session date is required';
  if (!session.startTime || !session.endTime) return 'Start and end times are required';
  if (session.endTime <= session.startTime) return 'End time must be after start time';
  if (event.startDate && session.date < event.startDate) {
    return 'Session date is before the conference start';
  }
  if (event.endDate && session.date > event.endDate) {
    return 'Session date is after the conference end';
  }
  return null;
}
