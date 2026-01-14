export function getApiBaseUrl() {
  // Web: use Netlify proxy (/api/* → Fly)
  if (Platform.OS === "web") return "";
  // Native apps must call Fly directly
  return "https://gathersync-api-deploy.fly.dev";
}

export function getLoginUrl() {
  return "https://api.gathersync.app/api/auth/google";
}
