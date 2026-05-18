import * as Linking from "expo-linking";
import * as ReactNative from "react-native";

const bundleId = "space.manus.gathersync.t20251216190030";
const timestamp = bundleId.split(".").pop()?.replace(/^t/, "") ?? "";
const schemeFromBundleId = `manus${timestamp}`;

const env = {
  portal: process.env.EXPO_PUBLIC_OAUTH_PORTAL_URL ?? "",
  server: process.env.EXPO_PUBLIC_OAUTH_SERVER_URL ?? "",
  appId: process.env.EXPO_PUBLIC_APP_ID ?? "60c16f5e-9cfa-4e25-bd1e-a68d1cdcb925",
  ownerId: process.env.EXPO_PUBLIC_OWNER_OPEN_ID ?? "",
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? "",
  deepLinkScheme: schemeFromBundleId,
};

export const APP_ID = env.appId;
export const API_BASE_URL = env.apiBaseUrl;

export function getApiBaseUrl(): string {
  if (ReactNative.Platform.OS === "web" && typeof window !== "undefined" && window.location) {
    const { protocol, hostname } = window.location;
    
    // 1. Bulletproof Production Check: If we are on the live site, ALWAYS use the production API
    if (hostname.includes("gathersync.app") || hostname.includes("netlify.app")) {
      return "https://gathersync-api.onrender.com";
    }

    // 2. Localhost Check: If we are on localhost, ALWAYS use localhost API
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return "http://localhost:3000";
    }

    const apiHostname = hostname.replace(/^8081-/, "3000-");
    if (apiHostname !== hostname) {
      return `${protocol}//${apiHostname}`;
    }
  }

  // 3. Fallback to Environment Variable
  if (API_BASE_URL) {
    return API_BASE_URL.replace(/\/$/, "");
  }

  return "https://gathersync-api.onrender.com";
}

const encodeState = (value: string) => {
  if (typeof globalThis.btoa === "function") {
    return globalThis.btoa(value);
  }
  return value;
};

export function getLoginUrl() {
  const redirectUri = Linking.createURL("oauth/callback", { scheme: env.deepLinkScheme });
  
  let baseUrl = getApiBaseUrl();
  
  const url = new URL(`${baseUrl}/api/auth/google`);
  
  url.searchParams.set("appId", APP_ID);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", encodeState(redirectUri));

  return url.toString();
}

export const SESSION_TOKEN_KEY = "app_session_token";
export const USER_INFO_KEY = "manus-runtime-user-info";