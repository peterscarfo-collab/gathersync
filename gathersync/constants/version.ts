import pkg from '../package.json';

/** App version — single source: package.json (synced to app.config on deploy:web) */
export const APP_VERSION = pkg.version;

/** Shown on About screen and deploy logs */
export function getVersionLabel(): string {
  return `v${APP_VERSION}`;
}
