// constants/oauth.ts

export function getApiBaseUrl() {
  // Web in production: use your API domain
  if (typeof window !== "undefined") return "https://api.gathersync.app";

  // Fallback (native / dev)
  return process.env.EXPO_PUBLIC_API_BASE_URL || "https://api.gathersync.app";
}

export function getLoginUrl() {
  // Login always starts at the backend OAuth endpoint
  const base = getApiBaseUrl().replace(/\/$/, "");
  return `${base}/api/auth/google`;
}
