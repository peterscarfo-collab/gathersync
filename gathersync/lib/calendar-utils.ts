import type { Event, Participant, DayAvailability, BestDay } from '@/types/models';

/**
 * Get number of days in a month
 */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Get the first day of the month (0 = Sunday, 6 = Saturday)
 */
export function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month - 1, 1).getDay();
}

/**
 * Format date as YYYY-MM-DD
 */
export function formatDate(year: number, month: number, day: number): string {
  const m = month.toString().padStart(2, '0');
  const d = day.toString().padStart(2, '0');
  return `${year}-${m}-${d}`;
}

/**
 * Parse YYYY-MM-DD to date components
 */
export function parseDate(dateStr: string): { year: number; month: number; day: number } {
  const normalized = normalizeCalendarDate(dateStr);
  const [year, month, day] = normalized.split('-').map(Number);
  return { year, month, day };
}

/** Strip YYYY-MM-DD from ISO or date-only strings. */
export function normalizeCalendarDate(dateStr: string): string {
  const match = dateStr.match(/^(\d{4}-\d{2}-\d{2})/);
  if (!match) {
    throw new Error(`Invalid calendar date: ${dateStr}`);
  }
  return match[1];
}

/** Device/browser IANA timezone (e.g. Australia/Sydney). */
export function getDeviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/** Today's calendar date (YYYY-MM-DD) in the given IANA timezone. */
export function getTodayCalendarDate(timeZone?: string): string {
  const tz = timeZone || getDeviceTimeZone();
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    const year = parts.find((part) => part.type === 'year')?.value;
    const month = parts.find((part) => part.type === 'month')?.value;
    const day = parts.find((part) => part.type === 'day')?.value;
    if (year && month && day) {
      return `${year}-${month}-${day}`;
    }
  } catch {
    // fall through
  }
  const now = new Date();
  return formatDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

/** Compare YYYY-MM-DD strings (timezone-agnostic). */
export function compareCalendarDates(a: string, b: string): number {
  const left = normalizeCalendarDate(a);
  const right = normalizeCalendarDate(b);
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

export function isCalendarDateInFuture(dateStr: string, timeZone?: string): boolean {
  return compareCalendarDates(dateStr, getTodayCalendarDate(timeZone)) > 0;
}

export function isCalendarDateTodayOrPast(dateStr: string, timeZone?: string): boolean {
  return compareCalendarDates(dateStr, getTodayCalendarDate(timeZone)) <= 0;
}

/** Format YYYY-MM-DD for display without UTC midnight shifting the day. */
export function formatCalendarDate(dateStr: string, locale?: string): string {
  const { year, month, day } = parseDate(dateStr);
  return new Date(year, month - 1, day).toLocaleDateString(locale);
}

export function getEventPrimaryCalendarDate(event: Event): string | null {
  if (event.eventType === 'fixed' && event.fixedDate) {
    return normalizeCalendarDate(event.fixedDate);
  }
  if (event.eventType === 'conference' && event.startDate) {
    return normalizeCalendarDate(event.startDate);
  }
  return null;
}

export function formatEventCalendarDate(event: Event, locale?: string): string {
  const primary = getEventPrimaryCalendarDate(event);
  if (primary) return formatCalendarDate(primary, locale);
  return `${event.month}/${event.year}`;
}

/** True when the event day has not arrived yet in the chosen timezone. */
export function isEventInFuture(event: Event, timeZone?: string): boolean {
  const primary = getEventPrimaryCalendarDate(event);
  if (primary) {
    return isCalendarDateInFuture(primary, timeZone);
  }
  if (event.eventType === 'flexible' && event.year && event.month) {
    const today = getTodayCalendarDate(timeZone);
    const { year, month } = parseDate(today);
    if (event.year > year) return true;
    if (event.year === year && event.month > month) return true;
    return false;
  }
  return false;
}

/**
 * Get month name
 */
export function getMonthName(month: number): string {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return months[month - 1] || '';
}

/**
 * Calculate availability for a specific day
 */
export function getDayAvailability(
  event: Event,
  year: number,
  month: number,
  day: number
): DayAvailability {
  const dateStr = formatDate(year, month, day);
  // Filter out deleted participants
  const activeParticipants = event.participants.filter(p => !p.deletedAt);
  const participants = activeParticipants.map(p => {
    let status: 'available' | 'unavailable' | 'no-response';
    
    if (p.unavailableAllMonth) {
      status = 'unavailable';
    } else if (p.availability && dateStr in p.availability) {
      status = p.availability[dateStr] ? 'available' : 'unavailable';
    } else {
      status = 'no-response';
    }

    return {
      id: p.id,
      name: p.name,
      status,
    };
  });

  const availableCount = participants.filter(p => p.status === 'available').length;
  const unavailableCount = participants.filter(p => p.status === 'unavailable').length;
  const noResponseCount = participants.filter(p => p.status === 'no-response').length;

  return {
    date: dateStr,
    availableCount,
    unavailableCount,
    noResponseCount,
    participants,
  };
}

/**
 * Calculate the best day(s) for an event
 */
export function getBestDays(event: Event): BestDay[] {
  const daysInMonth = getDaysInMonth(event.year, event.month);
  const dayAvailabilities: BestDay[] = [];
  // Filter out deleted participants
  const activeParticipants = event.participants.filter(p => !p.deletedAt);

  for (let day = 1; day <= daysInMonth; day++) {
    const availability = getDayAvailability(event, event.year, event.month, day);
    const totalParticipants = activeParticipants.length;
    const percentage = totalParticipants > 0 
      ? (availability.availableCount / totalParticipants) * 100 
      : 0;

    dayAvailabilities.push({
      date: formatDate(event.year, event.month, day),
      availableCount: availability.availableCount,
      percentage,
    });
  }

  // Find the maximum availability count
  const maxCount = Math.max(...dayAvailabilities.map(d => d.availableCount));
  
  // Return all days with the maximum count
  return dayAvailabilities.filter(d => d.availableCount === maxCount && maxCount > 0);
}

/**
 * Get heatmap color based on availability percentage
 */
export function getHeatmapColor(
  percentage: number,
  colorScheme: 'light' | 'dark'
): string {
  if (percentage === 0) {
    return colorScheme === 'light' ? '#F1F5F9' : '#1E293B'; // Very light gray / dark gray
  }
  
  // Gradient from light to dark indigo based on percentage
  if (colorScheme === 'light') {
    if (percentage < 25) return '#E0E7FF'; // Very light indigo
    if (percentage < 50) return '#C7D2FE'; // Light indigo
    if (percentage < 75) return '#A5B4FC'; // Medium indigo
    return '#818CF8'; // Strong indigo
  } else {
    if (percentage < 25) return '#312E81'; // Dark indigo
    if (percentage < 50) return '#4338CA'; // Medium-dark indigo
    if (percentage < 75) return '#6366F1'; // Medium indigo
    return '#818CF8'; // Light indigo
  }
}

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get all dates in a range (inclusive)
 */
export function getDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  
  const startTime = new Date(start.year, start.month - 1, start.day).getTime();
  const endTime = new Date(end.year, end.month - 1, end.day).getTime();
  
  for (let time = startTime; time <= endTime; time += 24 * 60 * 60 * 1000) {
    const date = new Date(time);
    dates.push(formatDate(date.getFullYear(), date.getMonth() + 1, date.getDate()));
  }
  
  return dates;
}

/** Map flexible availability on a chosen date to fixed-event RSVP statuses. */
export function applyRsvpFromAvailability(
  participants: Participant[],
  selectedDateStr: string
): Participant[] {
  return participants.map(p => {
    if (p.deletedAt) return p;
    let isAvailable = false;
    let hasResponded = false;

    if (p.availability) {
      if (Array.isArray(p.availability)) {
        isAvailable = p.availability.includes(selectedDateStr);
        hasResponded = p.availability.length > 0;
      } else {
        isAvailable = p.availability[selectedDateStr] === true;
        hasResponded = Object.keys(p.availability).length > 0;
      }
    }

    if (isAvailable) return { ...p, rsvpStatus: 'attending' as const };
    if (hasResponded) return { ...p, rsvpStatus: 'not-attending' as const };
    return { ...p, rsvpStatus: 'no-response' as const };
  });
}
