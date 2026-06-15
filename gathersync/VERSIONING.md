# GatherSync Versioning & Release Process

Professional releases keep you in control as the product grows. This matches the approach used on BizOMedia marketing: **numbered releases + written release notes + named deploy artifacts**.

## Single source of truth

| File | Purpose |
|------|---------|
| `package.json` → `"version"` | npm / scripts / zip filenames |
| `app.config.ts` → `version` | Expo / mobile / web bundle |
| `CHANGELOG.md` | What shipped in each version (customer + internal) |
| `constants/version.ts` | Reads version at runtime (About screen) |

**Rule:** When you cut a release, update all three version fields and add a `CHANGELOG.md` section in the same commit.

## Version numbers (SemVer)

- **1.0.0** — First stable baseline
- **1.1.0** — Conference events (Phase 1)
- **1.2.0** — Conference attendee registration (Phase 2, planned)
- **1.1.1** — Example patch (sync bugfix only)

## Release checklist

### 1. Decide the bump
- New feature users can see → **MINOR** (1.1.0 → 1.2.0)
- Bugfix only → **PATCH** (1.1.0 → 1.1.1)
- Breaking change → **MAJOR** (1.x → 2.0.0)

### 2. Update files
```bash
# Edit version in package.json and app.config.ts (and app.config.js if used)
# Add section to CHANGELOG.md under [X.Y.Z] — date
```

### 3. Commit & tag (when ready)
```bash
git add package.json app.config.ts CHANGELOG.md
git commit -m "Release v1.1.0 — conference events Phase 1"
git tag v1.1.0
git push && git push --tags
```

### 4. Deploy API (Render)
Push to `main` — Render auto-deploys. Schema migrations run on server start.

### 5. Deploy web (Netlify)
```bash
cd ~/dev/gathersync/gathersync
pnpm run build:web:zip
```

Upload to [app.netlify.com](https://app.netlify.com):

- **Primary:** `gathersync-web-v1.1.0-20260615.zip` (dated, keep for archive)
- **Alias:** `gathersync-web-production.zip` (always latest build output)

Keep old zips in a folder (e.g. `releases/`) or cloud drive so you can roll back.

### 6. Verify
- About screen shows correct version
- Smoke-test the features listed in CHANGELOG for that version

## What to document each release

In `CHANGELOG.md`, under the version heading:

1. **Added** — new features
2. **Changed** — behavior changes
3. **Fixed** — bugs
4. **Deploy notes** — env vars, migrations, manual steps (if any)

For major prospects or investors, copy the section into a one-page **Release Notes** PDF later if needed.

## Naming deploy zips (like BizOMedia)

| Artifact | Example |
|----------|---------|
| Web | `gathersync-web-v1.1.0-20260615.zip` |
| API | Git tag `v1.1.0` on Render |
| Backup format | Already versioned in `lib/backup.ts` (`1.1`) |

## Long-term documentation

As the product matures, add (when useful):

- `docs/` — architecture, API, onboarding
- User manual (already exists — regenerate PDF when UI changes)
- `RELEASES/` — archived zip copies + PDF release notes

**Daily improvement is fine** — batch into **PATCH** releases weekly, or **MINOR** when a feature set is demo-ready (e.g. Conference Phase 2).
