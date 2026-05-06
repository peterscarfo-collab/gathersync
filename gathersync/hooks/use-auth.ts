import * as Api from "@/lib/api";
import * as Auth from "@/lib/auth";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";

type UseAuthOptions = {
  autoFetch?: boolean;
};

export function useAuth(options?: UseAuthOptions) {
  const { autoFetch = true } = options ?? {};
  const [user, setUser] = useState<Auth.User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchUser = useCallback(async () => {
    console.log("[useAuth] fetchUser called");
    try {
      setLoading(true);
      setError(null);

      // Check for session token first
      console.log("[useAuth] Checking for session token...");
      const sessionToken = await Auth.getSessionToken();
      console.log(
        "[useAuth] Session token:",
        sessionToken ? `present (${sessionToken.substring(0, 20)}...)` : "missing",
      );
      if (!sessionToken) {
        console.log("[useAuth] No session token, setting user to null");
        setUser(null);
        await Auth.clearUserInfo();
        return;
      }

      // Fetch fresh user data from API
      console.log("[useAuth] Fetching user from API...");
      const apiUser = await Api.getMe();
      console.log("[useAuth] API user response:", apiUser);

      if (apiUser) {
        const userInfo: Auth.User = {
          id: apiUser.id,
          openId: apiUser.openId,
          name: apiUser.name,
          email: apiUser.email,
          loginMethod: apiUser.loginMethod,
          lastSignedIn: new Date(apiUser.lastSignedIn),
          // Include subscription fields from API
          subscriptionTier: (apiUser as any).subscriptionTier,
          subscriptionStatus: (apiUser as any).subscriptionStatus,
          subscriptionSource: (apiUser as any).subscriptionSource,
          isLifetimePro: (apiUser as any).isLifetimePro,
          trialStartDate: (apiUser as any).trialStartDate,
          trialEndDate: (apiUser as any).trialEndDate,
          trialUsed: (apiUser as any).trialUsed,
          eventsCreatedThisMonth: (apiUser as any).eventsCreatedThisMonth,
        };
        setUser(userInfo);
        // Update cache with fresh data
        await Auth.setUserInfo(userInfo);
        console.log("[useAuth] User set from API:", userInfo);
      } else {
        console.log("[useAuth] No authenticated user from API");
        setUser(null);
        await Auth.clearUserInfo();
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to fetch user");
      console.error("[useAuth] fetchUser error:", error);
      setError(error);
      setUser(null);
    } finally {
      setLoading(false);
      console.log("[useAuth] fetchUser completed, loading:", false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await Api.logout();
    } catch (err) {
      console.error("[Auth] Logout API call failed:", err);
      // Continue with logout even if API call fails
    } finally {
      await Auth.removeSessionToken();
      await Auth.clearUserInfo();
      setUser(null);
      setError(null);
    }
  }, []);

  const isAuthenticated = useMemo(() => Boolean(user), [user]);

  useEffect(() => {
    console.log("[useAuth] useEffect triggered, autoFetch:", autoFetch);
    if (autoFetch) {
      // Check for cached user info first for faster initial load
      Auth.getUserInfo().then((cachedUser) => {
        console.log("[useAuth] Cached user check:", cachedUser);
        if (cachedUser) {
          console.log("[useAuth] Setting cached user immediately");
          setUser(cachedUser);
          setLoading(false);
        } else {
          // No cached user, check session token
          fetchUser();
        }
      });
    } else {
      console.log("[useAuth] autoFetch disabled, setting loading to false");
      setLoading(false);
    }
  }, [autoFetch, fetchUser]);

  useEffect(() => {
    console.log("[useAuth] State updated:", {
      hasUser: !!user,
      loading,
      isAuthenticated,
      error: error?.message,
    });
  }, [user, loading, isAuthenticated, error]);

  return {
    user,
    loading,
    error,
    isAuthenticated,
    refresh: fetchUser,
    logout,
  };
}
