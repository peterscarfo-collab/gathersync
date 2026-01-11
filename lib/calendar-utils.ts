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
  const [year, month, day] = dateStr.split('-').map(Number);
  return { year, month, day };
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
    } else if (dateStr in p.availability) {
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
