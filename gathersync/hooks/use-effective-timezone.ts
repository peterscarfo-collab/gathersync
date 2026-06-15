import { useCallback, useEffect, useState } from 'react';

import { getDeviceTimeZone } from '@/lib/calendar-utils';
import { getEffectiveTimeZone, getTimezoneOverride, setTimezoneOverride } from '@/lib/user-preferences';

export function useEffectiveTimeZone() {
  const [timeZone, setTimeZone] = useState(getDeviceTimeZone());
  const [override, setOverride] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [effective, savedOverride] = await Promise.all([
      getEffectiveTimeZone(),
      getTimezoneOverride(),
    ]);
    setTimeZone(effective);
    setOverride(savedOverride);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const saveOverride = useCallback(
    async (next: string | null) => {
      await setTimezoneOverride(next);
      await refresh();
    },
    [refresh],
  );

  return {
    timeZone,
    override,
    deviceTimeZone: getDeviceTimeZone(),
    loading,
    refresh,
    saveOverride,
  };
}
