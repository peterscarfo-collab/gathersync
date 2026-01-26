import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { SESSION_TOKEN_KEY, USER_INFO_KEY } from "@/constants/oauth";

export type User = {
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
  loginMethod: string | null;
  lastSignedIn: Date;
  subscriptionTier?: "free" | "pro" | "enterprise";
  subscriptionStatus?: "active" | "cancelled" | "expired" | "trialing";
  subscriptionSource?: "free" | "trial" | "promo" | "stripe" | "admin";
  isLifetimePro?: boolean;
  trialStartDate?: string | null;
  trialEndDate?: string | null;
  trialUsed?: boolean;
  eventsCreatedThisMonth?: number;
};

const WEB_TOKEN_KEY = "sessionToken"; // keep ONE simple key for web

export async function getSessionToken(): Promise<string | null> {
  try {
    if (Platform.OS === "web") {
      // For web, we rely on HTTP-only cookies sent automatically
      // We don't store or retrieve session tokens in localStorage
      console.log("[Auth] Web platform - relying on HTTP-only cookie");
      return "cookie-based"; // Return a placeholder to indicate cookie auth
    }

    console.log("[Auth] Getting session token (native)...");
    const token = await SecureStore.getItemAsync(SESSION_TOKEN_KEY);
    console.log(
      "[Auth] Native session token from SecureStore:",
      token ? `present (${token.substring(0, 20)}...)` : "missing",
    );
    return token;
  } catch (error) {
    console.error("[Auth] Failed to get session token:", error);
    return null;
  }
}

export async function setSessionToken(token: string): Promise<void> {
  try {
    if (Platform.OS === "web") {
      // For web, cookies are set by the server automatically
      // We don't need to manually store anything
      console.log("[Auth] Web platform - cookie will be set by server");
      return;
    }

    console.log("[Auth] Setting session token (native)...", token.substring(0, 20) + "...");
    await SecureStore.setItemAsync(SESSION_TOKEN_KEY, token);
    console.log("[Auth] Session token stored in SecureStore successfully");
  } catch (error) {
    console.error("[Auth] Failed to set session token:", error);
    throw error;
  }
}

export async function removeSessionToken(): Promise<void> {
  try {
    if (Platform.OS === "web") {
      // For web, cookies are managed by the server
      // The server will clear the cookie on logout
      console.log("[Auth] Web platform - cookie will be cleared by server");
      return;
    }

    console.log("[Auth] Removing session token (native)...");
    await SecureStore.deleteItemAsync(SESSION_TOKEN_KEY);
    console.log("[Auth] Session token removed from SecureStore successfully");
  } catch (error) {
    console.error("[Auth] Failed to remove session token:", error);
  }
}

export async function getUserInfo(): Promise<User | null> {
  try {
    console.log("[Auth] Getting user info...");

    const info =
      Platform.OS === "web"
        ? window.localStorage.getItem(USER_INFO_KEY)
        : await SecureStore.getItemAsync(USER_INFO_KEY);

    if (!info) {
      console.log("[Auth] No user info found");
      return null;
    }
    const user = JSON.parse(info);
    console.log("[Auth] User info retrieved:", user);
    return user;
  } catch (error) {
    console.error("[Auth] Failed to get user info:", error);
    return null;
  }
}

export async function setUserInfo(user: User): Promise<void> {
  try {
    console.log("[Auth] Setting user info...", user);

    if (Platform.OS === "web") {
      window.localStorage.setItem(USER_INFO_KEY, JSON.stringify(user));
      console.log("[Auth] User info stored in localStorage successfully");
      return;
    }

    await SecureStore.setItemAsync(USER_INFO_KEY, JSON.stringify(user));
    console.log("[Auth] User info stored in SecureStore successfully");
  } catch (error) {
    console.error("[Auth] Failed to set user info:", error);
  }
}

export async function clearUserInfo(): Promise<void> {
  try {
    if (Platform.OS === "web") {
      window.localStorage.removeItem(USER_INFO_KEY);
      return;
    }
    await SecureStore.deleteItemAsync(USER_INFO_KEY);
  } catch (error) {
    console.error("[Auth] Failed to clear user info:", error);
  }
}
