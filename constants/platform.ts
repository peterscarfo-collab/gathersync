import { Platform } from "react-native";

/**
 * Check if we're running on web platform
 */
export const IS_WEB = Platform.OS === "web";

/**
 * Check if we're running on localhost (for local development)
 */
export function isLocalhost(): boolean {
  if (!IS_WEB || typeof window === "undefined") {
    return false;
  }

  const hostname = window.location.hostname;
  return hostname === "localhost" || hostname === "127.0.0.1";
}
