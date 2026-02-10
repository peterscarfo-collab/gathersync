import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';

export function SyncStatusBadge() {
  const [isOnline, setIsOnline] = useState(true);

  const successColor = useThemeColor({}, 'success');
  const warningColor = useThemeColor({}, 'warning');
  const surfaceColor = useThemeColor({}, 'surface');
  const textSecondaryColor = useThemeColor({}, 'textSecondary');

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: any) => {
      const online = state.isConnected && state.isInternetReachable !== false;
      setIsOnline(online);
    });

    return () => unsubscribe();
  }, []);

  const badgeColor = isOnline ? successColor : warningColor;
  const label = isOnline ? 'Live' : 'Offline';

  return (
    <View style={[styles.badge, { backgroundColor: surfaceColor, borderColor: badgeColor }]}>
      <View style={[styles.dot, { backgroundColor: badgeColor }]} />
      <ThemedText style={[styles.label, { color: textSecondaryColor }]}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
});
