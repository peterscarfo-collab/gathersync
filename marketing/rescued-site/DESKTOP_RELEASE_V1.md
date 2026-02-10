# GatherSync Marketing Desktop Release (v1)

Release date: 2026-02-10
Primary URL: `https://app.gathersync.app`
Scope: Desktop-first release candidate for the standalone marketing site.

## Finalized Items

- [x] Isolated marketing code in `marketing/rescued-site/`.
- [x] Production URL references updated to `app.gathersync.app`.
- [x] Pricing finalized:
  - Free
  - Lite Version: `$4.99/month` or `$49/year` (save `$10`)
  - Pro Version: `$7.99/month` or `$79/year` (save `$16`)
- [x] Legal pages created and linked:
  - `privacy-policy.html`
  - `terms-of-service.html`
- [x] Contact flow implemented (desktop-safe `mailto:` fallback path).
- [x] Link sanity check passed (no missing local targets).

## Desktop QA Checks Completed

- [x] Navigation anchor flow (`Features`, `Pricing`, `Download`, `Contact`)
- [x] Hero CTA visibility and clickability
- [x] Pricing cards readable and consistent
- [x] Download CTA points to production app URL
- [x] Legal links resolve to local legal documents
- [x] Footer branding and copyright copy

## Known Follow-up (Post-release)

- Mobile-specific refinement pass (spacing, typography, tap targets)
- Replace "coming soon" app-store destinations with live store URLs when available
- Optional legal review before broad public promotion
