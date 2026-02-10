export const ENV = {
  // InstantDB Configuration
  instantAppId: process.env.INSTANT_APP_ID ?? process.env.EXPO_PUBLIC_INSTANT_APP_ID ?? "",
  instantAdminToken: process.env.INSTANT_APP_ADMIN_TOKEN ?? "",
  
  // APP_ID is critical for session tokens - must match between creation and verification
  // Check APP_ID first (backend), then VITE_APP_ID (legacy), then fallback
  appId: process.env.APP_ID ?? process.env.VITE_APP_ID ?? process.env.EXPO_PUBLIC_APP_ID ?? "",
  // SESSION_SECRET is the primary secret for session management
  cookieSecret: process.env.SESSION_SECRET ?? process.env.COOKIE_SECRET ?? process.env.JWT_SECRET ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? process.env.BASE_URL ?? (process.env.FLY_APP_NAME ? `https://${process.env.FLY_APP_NAME}.fly.dev` : ""),
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
};

// Log critical environment variables at startup (without exposing secrets)
if (!ENV.instantAppId) {
  console.warn("[ENV] WARNING: INSTANT_APP_ID is not set! InstantDB operations will fail.");
  console.warn("[ENV] Set INSTANT_APP_ID environment variable.");
}
if (!ENV.instantAdminToken) {
  console.warn("[ENV] WARNING: INSTANT_APP_ADMIN_TOKEN is not set! Server-side database operations will fail.");
  console.warn("[ENV] Set INSTANT_APP_ADMIN_TOKEN environment variable.");
}
if (!ENV.appId) {
  console.warn("[ENV] WARNING: APP_ID is not set! Session tokens will fail verification.");
  console.warn("[ENV] Set APP_ID environment variable in Dockerfile or fly.toml secrets.");
}
if (!ENV.cookieSecret) {
  console.error("[ENV] ERROR: SESSION_SECRET is not set! Authentication will fail.");
  console.error("[ENV] Set SESSION_SECRET environment variable in Fly.io secrets.");
}
