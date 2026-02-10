import { db } from "@/lib/db";
import { setCurrentUser } from "@/lib/trpc";
import { useCallback, useEffect, useMemo } from "react";

type UseAuthOptions = {
  autoFetch?: boolean;
};

export function useAuthState(options?: UseAuthOptions) {
  const { autoFetch = true } = options ?? {};
  void autoFetch;
  
  // Use InstantDB's auth hook
  const { user: instantUser, isLoading, error: authError } = db.useAuth();

  // Pull the current user profile directly from InstantDB so subscription grants are
  // reflected in real-time without relying on extra server auth headers.
  const { data: profileData, isLoading: profileLoading } = db.useQuery(
    instantUser?.id
      ? {
          $users: {
            $: {
              where: {
                id: instantUser.id,
              },
            },
          },
        }
      : null
  );

  // Map authenticated user and merge profile fields from InstantDB ($users)
  const user = useMemo(() => {
    if (!instantUser) return null;

    const profile = (profileData as any)?.$users?.[0] ?? null;
    const base = {
      id: instantUser.id,
      email: instantUser.email || null,
      name: instantUser.email || null, // fallback until profile is loaded
      openId: instantUser.id,
      loginMethod: 'email' as const,
      lastSignedIn: new Date(),
    };

    if (!profile || typeof profile !== 'object') return base;

    const p = profile as Record<string, unknown>;
    return {
      ...base,
      name: (p.name as string) ?? base.name,
      role: p.role as string | undefined,
      subscriptionTier: p.subscriptionTier as string | undefined,
      subscriptionStatus: p.subscriptionStatus as string | undefined,
      subscriptionSource: p.subscriptionSource as string | undefined,
      isLifetimePro: p.isLifetimePro as boolean | undefined,
      trialUsed: p.trialUsed as boolean | undefined,
      trialStartDate: p.trialStartDate as Date | string | undefined,
      trialEndDate: p.trialEndDate as Date | string | undefined,
      subscriptionStartDate: p.subscriptionStartDate as Date | string | undefined,
      subscriptionEndDate: p.subscriptionEndDate as Date | string | undefined,
      eventsCreatedThisMonth: p.eventsCreatedThisMonth as number | undefined,
      grantedBy: p.grantedBy as string | undefined,
      grantedAt: p.grantedAt as Date | string | undefined,
    };
  }, [instantUser, profileData]);

  // Keep tRPC user header in sync for server routes that still use it.
  useEffect(() => {
    if (instantUser?.id) {
      setCurrentUser(instantUser.id, instantUser.email ?? null);
    } else {
      setCurrentUser(null, null);
    }
  }, [instantUser?.id, instantUser?.email]);

  const logout = useCallback(async () => {
    try {
      await db.auth.signOut();
      setCurrentUser(null, null);
    } catch (err) {
      console.error("[Auth] Logout failed:", err);
    }
  }, []);

  const refresh = useCallback(() => {
    // InstantDB subscriptions are live. Kept for API compatibility.
    console.log("[useAuth] Refresh called (InstantDB query is live)");
  }, []);

  const isAuthenticated = useMemo(() => Boolean(user), [user]);

  return {
    user,
    loading: isLoading || (Boolean(instantUser?.id) && profileLoading),
    error: authError as Error | null,
    isAuthenticated,
    refresh,
    logout,
  };
}
