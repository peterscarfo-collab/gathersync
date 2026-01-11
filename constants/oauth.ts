export function getApiBaseUrl() {
  return (
    process.env.EXPO_PUBLIC_API_BASE_URL ||
    "https://gathersync-api-deploy.fly.dev"
  );
}

export function getLoginUrl() {
  return `${getApiBaseUrl()}/api/auth/google`;
}
