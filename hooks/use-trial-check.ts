import { useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { useAuth } from './use-auth';

/**
 * Hook to check and expire trials on app launch
 * Call this in the root layout to ensure trials are checked when app starts
 */
export function useTrialCheck() {
  const { isAuthenticated, user } = useAuth();
  const checkExpiredTrials = trpc.trial.checkExpiredTrials.useMutation();

  useEffect(() => {
    // Only check if user is authenticated and trialing
    if (!isAuthenticated || !user) return;
    if ((user as any).subscriptionStatus !== 'trialing') return;

    // Check if trial has expired
    checkExpiredTrials.mutate(undefined, {
      onSuccess: (result) => {
        if (result.expired) {
          console.log('[Trial] Trial has expired, user downgraded to free tier');
        }
      },
      onError: (error) => {
        console.error('[Trial] Failed to check trial expiration:', error);
      },
    });
  }, [isAuthenticated, user?.id, (user as any)?.subscriptionStatus]);
}
