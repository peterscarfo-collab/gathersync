import { useEffect, useRef } from 'react';
import { Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { trpc } from '@/lib/trpc';
import { useAuth } from './auth-context';

const REMINDER_DAY_MARKERS = [14, 7, 3, 1];

function giftReminderKey(userId: string, marker: number, expiryIso: string) {
  return `@gathersync_gift_reminder:${userId}:${expiryIso}:${marker}`;
}

/**
 * Hook to enforce subscription windows on app launch:
 * - expires finished trials
 * - expires finished gifted access
 * - reminds gifted users before expiry (14/7/3/1 days)
 */
export function useTrialCheck() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();
  const checkExpiredTrials = trpc.trial.checkExpiredTrials.useMutation();
  const checkGiftedAccess = trpc.subscription.checkGiftedAccess.useMutation();
  const inFlightRef = useRef(false);

  useEffect(() => {
    // Only check if user is authenticated
    if (!isAuthenticated || !user) return;

    if (inFlightRef.current) return;
    inFlightRef.current = true;

    (async () => {
      try {
        // 1) Expire trial if needed
        if ((user as any).subscriptionStatus === 'trialing') {
          const trialResult = await checkExpiredTrials.mutateAsync();
          if (trialResult.expired) {
            console.log('[Trial] Trial has expired, user downgraded to free tier');
          }
        }

        // 2) Expire gifted subscription or remind when approaching expiry
        const giftedResult = await checkGiftedAccess.mutateAsync();
        if (!giftedResult.isGifted) return;

        const expiryIso = giftedResult.expiryDate
          ? new Date(giftedResult.expiryDate).toISOString()
          : null;
        if (!expiryIso) return;

        // Gift period ended: show upgrade prompt once per expiry timestamp
        if (giftedResult.expired) {
          const expiredKey = `@gathersync_gift_expired_prompt:${user.id}:${expiryIso}`;
          const alreadyShown = await AsyncStorage.getItem(expiredKey);
          if (!alreadyShown) {
            await AsyncStorage.setItem(expiredKey, '1');
            if (Platform.OS === 'web') {
              const goToPricing = window.confirm(
                'Your gifted Pro access has expired. Upgrade now to keep Pro features.'
              );
              if (goToPricing) router.push('/pricing' as any);
            } else {
              Alert.alert(
                'Gifted access expired',
                'Your gifted Pro access has expired. Upgrade now to keep Pro features.',
                [
                  { text: 'Later', style: 'cancel' },
                  { text: 'View Plans', onPress: () => router.push('/pricing' as any) },
                ]
              );
            }
          }
          return;
        }

        // Gift still active: notify at key intervals
        const daysRemaining = giftedResult.daysRemaining ?? null;
        if (daysRemaining === null) return;
        const marker = REMINDER_DAY_MARKERS.find((d) => d === daysRemaining);
        if (!marker) return;

        const reminderKey = giftReminderKey(user.id, marker, expiryIso);
        const alreadyShown = await AsyncStorage.getItem(reminderKey);
        if (alreadyShown) return;

        await AsyncStorage.setItem(reminderKey, '1');
        const msg = `Your gifted Pro access expires in ${marker} day${marker === 1 ? '' : 's'}. Upgrade now to avoid interruption.`;
        if (Platform.OS === 'web') {
          const goToPricing = window.confirm(msg);
          if (goToPricing) router.push('/pricing' as any);
        } else {
          Alert.alert('Gift access reminder', msg, [
            { text: 'Later', style: 'cancel' },
            { text: 'View Plans', onPress: () => router.push('/pricing' as any) },
          ]);
        }
      } catch (error) {
        console.error('[Subscription] Failed to run subscription checks:', error);
      } finally {
        inFlightRef.current = false;
      }
    })();
  }, [
    isAuthenticated,
    user?.id,
    (user as any)?.subscriptionStatus,
    (user as any)?.subscriptionSource,
    (user as any)?.subscriptionEndDate,
  ]);
}
