import * as Api from "@/lib/api";
import * as Auth from "@/lib/auth";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform } from "react-native";

type UseAuthOptions = {
  autoFetch?: boolean;
};

export function useAuthState(options?: UseAuthOptions) {
  const { autoFetch = true } = options ?? {};
  const [user, setUser] = useState<Auth.User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const hasNoSessionCookieRef = useRef(false);
  const hasInitializedRef = useRef(false);

  const fetchUser = useCallback(async (force = false) => {
    // If we've already detected no session cookie and this isn't a forced refresh, skip
    if (hasNoSessionCookieRef.current && !force) {
      console.log("[useAuth] Skipping fetchUser - no session cookie detected and not forced");
      return;
    }

    console.log("[useAuth] fetchUser called", { force, hasNoSessionCookie: hasNoSessionCookieRef.current });
    try {
      setLoading(true);
      setError(null);
      hasNoSessionCookieRef.current = false;

      // Web platform: use cookie-based auth, fetch user from API
      if (Platform.OS === "web") {
        console.log("[useAuth] Web platform: fetching user from API...");
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
          // Cache user info in localStorage for faster subsequent loads
          await Auth.setUserInfo(userInfo);
          console.log("[useAuth] Web user set from API:", userInfo);
        } else {
          console.log("[useAuth] Web: No authenticated user from API");
          setUser(null);
          await Auth.clearUserInfo();
          hasNoSessionCookieRef.current = true;
        }
        return;
      }

      // Native platform: use token-based auth
      console.log("[useAuth] Native platform: checking for session token...");
      const sessionToken = await Auth.getSessionToken();
      console.log(
        "[useAuth] Session token:",
        sessionToken ? `present (${sessionToken.substring(0, 20)}...)` : "missing",
      );
      if (!sessionToken) {
        console.log("[useAuth] No session token, setting user to null");
        setUser(null);
        return;
      }

      // Fetch fresh user data from API (includes subscription fields)
      console.log("[useAuth] Native: fetching user from API...");
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
        console.log("[useAuth] Native user set from API:", userInfo);
      } else {
        console.log("[useAuth] Native: No authenticated user from API");
        setUser(null);
        await Auth.clearUserInfo();
        hasNoSessionCookieRef.current = true;
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
      hasNoSessionCookieRef.current = true; // Mark as no session after logout
    }
  }, []);

  const refresh = useCallback(() => {
    // Force refresh by resetting the no-session-cookie flag
    hasNoSessionCookieRef.current = false;
    hasInitializedRef.current = false; // Allow re-initialization
    fetchUser(true);
  }, [fetchUser]);

  const isAuthenticated = useMemo(() => Boolean(user), [user]);

  useEffect(() => {
    // Only run once on mount or when autoFetch changes, not on every render
    if (hasInitializedRef.current) {
      return;
    }

    console.log("[useAuth] useEffect triggered, autoFetch:", autoFetch, "platform:", Platform.OS, "hasNoSessionCookie:", hasNoSessionCookieRef.current);
    
    // Don't auto-fetch if we've already detected no session cookie
    if (hasNoSessionCookieRef.current && Platform.OS === "web") {
      console.log("[useAuth] Skipping auto-fetch - no session cookie already detected");
      setLoading(false);
      hasInitializedRef.current = true;
      return;
    }
    
    if (autoFetch) {
      hasInitializedRef.current = true;
      if (Platform.OS === "web") {
        // Web: fetch user from API directly (user will login manually if needed)
        console.log("[useAuth] Web: fetching user from API...");
        fetchUser();
      } else {
        // Native: check for cached user info first for faster initial load
        Auth.getUserInfo().then((cachedUser) => {
          console.log("[useAuth] Native cached user check:", cachedUser);
          if (cachedUser) {
            console.log("[useAuth] Native: setting cached user immediately");
            setUser(cachedUser);
            setLoading(false);
          } else {
            // No cached user, check session token
            fetchUser();
          }
        });
      }
    } else {
      console.log("[useAuth] autoFetch disabled, setting loading to false");
      setLoading(false);
      hasInitializedRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFetch]); // Only depend on autoFetch, fetchUser is stable

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
    refresh,
    logout,
  };
}
