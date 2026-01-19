// constants/oauth.ts

export function getApiBaseUrl() {
  // Web in production: use your API domain
  if (typeof window !== "undefined") return "https://api.gathersync.app";

  // Fallback (native / dev)
  return process.env.EXPO_PUBLIC_API_BASE_URL || "https://api.gathersync.app";
}

export function getApiBaseUrl() {
  // WEB in production: use same-origin so Netlify can proxy /api/* and cookies work
  if (typeof window !== "undefined") return "";

  // Native / dev: call the API directly
  return process.env.EXPO_PUBLIC_API_BASE_URL || "https://api.gathersync.app";
}
