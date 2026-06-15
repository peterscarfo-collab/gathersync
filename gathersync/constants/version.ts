import Constants from 'expo-constants';

/** App version — keep in sync with package.json and app.config.ts */
export const APP_VERSION =
  Constants.expoConfig?.version ?? Constants.manifest2?.extra?.expoClient?.version ?? '1.1.0';

/** Shown on About screen and deploy logs */
export function getVersionLabel(): string {
  return `v${APP_VERSION}`;
}
