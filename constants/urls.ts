export const APP_SCHEME =
  process.env.EXPO_PUBLIC_APP_SCHEME ?? "gathersync";

// Use environment variable or fallback based on NODE_ENV
const isProduction = process.env.NODE_ENV === "production";
export const WEB_BASE_URL =
  process.env.EXPO_PUBLIC_WEB_BASE_URL ?? 
  (isProduction ? "https://app.gathersync.app" : "http://127.0.0.1:8081");
