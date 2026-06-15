import AsyncStorage from '@react-native-async-storage/async-storage';

import { getDeviceTimeZone } from '@/lib/calendar-utils';

const TIMEZONE_KEY = '@gathersync_timezone';

/** Common Australian IANA zones for manual override when device TZ is wrong. */
export const AUSTRALIAN_TIMEZONES = [
  { id: 'Australia/Sydney', label: 'Sydney, Melbourne, Canberra' },
  { id: 'Australia/Brisbane', label: 'Brisbane' },
  { id: 'Australia/Adelaide', label: 'Adelaide' },
  { id: 'Australia/Darwin', label: 'Darwin' },
  { id: 'Australia/Perth', label: 'Perth' },
] as const;

export async function getTimezoneOverride(): Promise<string | null> {
  try {
    const value = await AsyncStorage.getItem(TIMEZONE_KEY);
    return value || null;
  } catch {
    return null;
  }
}

export async function setTimezoneOverride(timeZone: string | null): Promise<void> {
  if (timeZone) {
    await AsyncStorage.setItem(TIMEZONE_KEY, timeZone);
  } else {
    await AsyncStorage.removeItem(TIMEZONE_KEY);
  }
}

/** Saved override, or the device/browser timezone from Intl. */
export async function getEffectiveTimeZone(): Promise<string> {
  const override = await getTimezoneOverride();
  return override || getDeviceTimeZone();
}

export function formatTimeZoneLabel(timeZone: string): string {
  try {
    const short = new Intl.DateTimeFormat(undefined, {
      timeZone,
      timeZoneName: 'shortOffset',
    })
      .formatToParts(new Date())
      .find((part) => part.type === 'timeZoneName')?.value;
    return short ? `${timeZone} (${short})` : timeZone;
  } catch {
    return timeZone;
  }
}
