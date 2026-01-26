import { Platform } from "react-native";

const IS_WEB = Platform.OS === "web";

/**
 * Get base URL - use BASE_URL, fallback to Fly.io app name
 */
function getBaseUrl(): string {
  // Priority: BASE_URL > Fly.io app name > EXPO_PUBLIC_API_BASE_URL
  if (process.env.BASE_URL) {
    return process.env.BASE_URL;
  }
  
  // Fallback to Fly.io app name if available
  if (process.env.FLY_APP_NAME) {
    return `https://${process.env.FLY_APP_NAME}.fly.dev`;
  }
  
  // Use EXPO_PUBLIC_API_BASE_URL if set
  if (process.env.EXPO_PUBLIC_API_BASE_URL) {
    return process.env.EXPO_PUBLIC_API_BASE_URL;
  }
  
  // No fallback - return empty string (will cause error if used)
  console.error("[OAuth] BASE_URL is not set! Set BASE_URL environment variable or FLY_APP_NAME.");
  return "";
}

/**
 * API base:
 * - Web: use same-origin so Caddy (localhost:8081) or Netlify can proxy /api/*
 * - Native: use BASE_URL with Fly.io fallback
 */
export function getApiBaseUrl(): string {
  if (IS_WEB) {
    return "";
  }
  
  return getBaseUrl();
}

/**
 * OAuth server base (same as API server)
 */
export function getOAuthServerUrl(): string {
  return getApiBaseUrl();
}

/**
 * Get OAuth portal URL from environment variables
 */
function getOAuthPortalUrl(): string {
  const portalUrl = 
    process.env.EXPO_PUBLIC_OAUTH_PORTAL_URL ||
    process.env.VITE_OAUTH_PORTAL_URL ||
    "";
  
  if (!portalUrl) {
    console.warn("[OAuth] OAuth portal URL not configured. Set EXPO_PUBLIC_OAUTH_PORTAL_URL or VITE_OAUTH_PORTAL_URL");
  }
  
  return portalUrl;
}

/**
 * Get App ID from environment variables
 */
function getAppId(): string {
  const appId = 
    process.env.EXPO_PUBLIC_APP_ID ||
    process.env.VITE_APP_ID ||
    "";
  
  if (!appId) {
    console.warn("[OAuth] App ID not configured. Set EXPO_PUBLIC_APP_ID or VITE_APP_ID");
  }
  
  return appId;
}

/**
 * Constructs the OAuth login URL for Manus authentication
 * - Web: redirects to /api/oauth/callback on the same origin
 * - Native: redirects to deep link or mobile callback endpoint
 */
export function getLoginUrl(): string {
  const portalUrl = getOAuthPortalUrl();
  const appId = getAppId();
  
  if (!portalUrl) {
    console.error("[OAuth] Missing OAuth portal URL. Set EXPO_PUBLIC_OAUTH_PORTAL_URL");
    return "";
  }

  // Construct redirect URI
  // For web: use same-origin callback endpoint
  // For native: use mobile callback endpoint
  const apiBase = getApiBaseUrl();
  const redirectUri = IS_WEB
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/api/oauth/callback`
    : `${apiBase}/api/oauth/callback`;

  // Encode redirect URI in state parameter (base64)
  const state = btoa(redirectUri);

  // Construct OAuth authorization URL
  // For local Google OAuth testing, appId may be optional
  const params = new URLSearchParams({
    redirect_uri: redirectUri,
    state: state,
    response_type: "code",
    scope: "openid email profile",
  });

  // Only add project_id if appId is provided (required for Manus OAuth)
  if (appId) {
    params.set("project_id", appId);
  }

  return `${portalUrl}?${params.toString()}`;
}
