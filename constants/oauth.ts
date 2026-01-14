// constants/oauth.ts

export function getApiBaseUrl() {
  // This MUST be the API domain, not the app domain
  // (Your curl tests show api.gathersync.app is correct)
  return "https://api.gathersync.app";
}

export function getLoginUrl() {
  // This MUST be an absolute URL for web redirect
  return `${getApiBaseUrl()}/api/auth/google`;
}
