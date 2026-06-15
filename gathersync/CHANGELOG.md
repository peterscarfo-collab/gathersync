# GatherSync Changelog

All notable changes to GatherSync are documented here.

We use [Semantic Versioning](https://semver.org/): **MAJOR.MINOR.PATCH**

| Bump | When |
|------|------|
| **MAJOR** | Breaking changes (data format, API, login) |
| **MINOR** | New features (backward compatible) |
| **PATCH** | Bug fixes, copy, small UX tweaks |

Deploy labels: web builds are zipped as `gathersync-web-vX.Y.Z-YYYYMMDD.zip` (see `VERSIONING.md`).

---

## [1.1.1] — 2026-06-15

### Added
- **Session types** on conference schedule: talk, breakfast, lunch, dinner, coffee break, break
- **Speaker topic** field on talk sessions
- Schedule UI: type picker, topic field, meal/break defaults

---

## [1.1.0] — 2026-06-15

### Added
- **Conference event type** — multi-day date range, all-day, venue capacity, selection deadline
- **Session schedule (organizer)** — add/edit/delete sessions (title, day, time, speaker, room, capacity)
- Conference display on event cards and event detail
- Cloud sync for conference fields and `eventSessions` table
- Auto-migration for conference schema on API server start

### Fixed
- Events list could load before login finished, skipping cloud sync
- Event list now refreshes after background sync completes
- Event create uses retry queue for cloud push (not silent fire-and-forget)

### Docs / tests
- `lib/conference-utils.ts` + unit tests
- `VERSIONING.md` and this changelog

---

## [1.0.0] — 2025-12-16 (baseline)

Initial production GatherSync:

- Flexible events (find best day from availability)
- Fixed events (single date/time + RSVP)
- Participants, import, send messages (SMS / email)
- Cloud sync (local-first + TiDB)
- Admin tools, backup/restore, subscriptions (Stripe)
- Influencer pipeline CRM + LinkedIn paste import
- BizoMedia CRM webhook integration
- Meeting UPDATE email mode for changed invites

---

## Upcoming (planned)

### [1.2.0] — Conference Phase 2 (attendee registration)
- Attendees pick days and sessions from public link
- Validation: min 1 session, 1 per day, no time overlaps, capacity limits
- Organizer dashboard: headcounts by day/session, export

---

[1.1.0]: https://github.com/peterscarfo-collab/gathersync/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/peterscarfo-collab/gathersync/releases/tag/v1.0.0
