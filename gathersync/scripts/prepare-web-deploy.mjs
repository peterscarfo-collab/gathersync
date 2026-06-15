#!/usr/bin/env node
/**
 * One-command web deploy prep:
 * 1. Sync version from package.json → app.config.*
 * 2. Clean Expo web export (--clear avoids stale embedded version)
 * 3. Verify the bundle contains the expected version
 * 4. Create versioned + production zips for Netlify upload
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const version = pkg.version;
const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');

function syncAppConfigVersion() {
  for (const file of ['app.config.ts', 'app.config.js']) {
    const path = join(root, file);
    if (!existsSync(path)) continue;
    const content = readFileSync(path, 'utf8');
    const current = content.match(/version:\s*['"]([\d.]+)['"]/);
    if (!current) {
      console.warn(`[deploy:web] Warning: could not find version field in ${file}`);
      continue;
    }
    if (current[1] === version) {
      console.log(`[deploy:web] ${file} already at ${version}`);
      continue;
    }
    const updated = content.replace(/version:\s*['"][\d.]+['"]/, `version: "${version}"`);
    writeFileSync(path, updated);
    console.log(`[deploy:web] Synced ${file} → ${version}`);
  }
}

function exportWeb() {
  console.log(`[deploy:web] Exporting web bundle (v${version}, cache cleared)…`);
  execSync('npx expo export --platform web --clear', { cwd: root, stdio: 'inherit' });
}

function verifyBundleVersion() {
  const webJsDir = join(root, 'dist/_expo/static/js/web');
  if (!existsSync(webJsDir)) {
    throw new Error('dist/_expo/static/js/web not found — export may have failed');
  }
  const entryFiles = readdirSync(webJsDir).filter((f) => f.startsWith('entry-') && f.endsWith('.js'));
  if (entryFiles.length === 0) {
    throw new Error('No entry-*.js bundle found in dist');
  }

  for (const file of entryFiles) {
    const js = readFileSync(join(webJsDir, file), 'utf8');
    const match = js.match(/\\"version\\":\\"([\d.]+)\\"/);
    if (!match) {
      throw new Error(`Could not find embedded version in ${file}`);
    }
    if (match[1] !== version) {
      throw new Error(`Bundle version mismatch in ${file}: got ${match[1]}, expected ${version}`);
    }
  }
  console.log(`[deploy:web] Verified bundle embeds version ${version}`);
}

function createZips() {
  const versionedName = `gathersync-web-v${version}-${date}.zip`;
  const latestName = 'gathersync-web-production.zip';

  console.log(`[deploy:web] Packaging zips…`);
  execSync(`cd dist && zip -r ../${versionedName} .`, { cwd: root, stdio: 'inherit' });
  execSync(`cp ${versionedName} ${latestName}`, { cwd: root, stdio: 'inherit' });

  console.log('');
  console.log('[deploy:web] Ready for Netlify');
  console.log(`  Archive:  ${versionedName}`);
  console.log(`  Upload:   ${latestName}`);
  console.log(`  Version:  v${version}`);
  console.log('');
}

syncAppConfigVersion();
exportWeb();
verifyBundleVersion();
createZips();
