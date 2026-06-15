#!/usr/bin/env node
/**
 * @deprecated Use `pnpm deploy:web` (scripts/prepare-web-deploy.mjs) instead.
 * Creates versioned + latest web deploy zips after `expo export --platform web`.
 * Output:
 *   gathersync-web-v{version}-{YYYYMMDD}.zip  (archive)
 *   gathersync-web-production.zip             (latest alias for Netlify)
 */
import { readFileSync } from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const version = pkg.version;
const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
const versionedName = `gathersync-web-v${version}-${date}.zip`;
const latestName = 'gathersync-web-production.zip';

console.log(`[build:web:zip] Packaging GatherSync ${version} (${date})…`);

execSync(`cd dist && zip -r ../${versionedName} .`, { cwd: root, stdio: 'inherit' });
execSync(`cp ${versionedName} ${latestName}`, { cwd: root, stdio: 'inherit' });

console.log(`[build:web:zip] Created ${versionedName}`);
console.log(`[build:web:zip] Updated ${latestName} (upload this to Netlify)`);
