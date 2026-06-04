# GatherSync ↔ BizoMedia — Letterbox CRM spec (build together)

**Problem:** `/admin/influencers` is built for **LinkedIn → GatherSync Pro** influencer outreach.  
**Letterbox / Golden Care** needs **brochure → BizoMedia demo → SMS → convert** — different fields, templates, and statuses.

**Goal:** One contact in GatherSync, &lt;10 min to demo-sent, no scrolling through irrelevant influencer UI.

**Repos:** GatherSync (CRM UI + webhooks) · BizoMedia / poemgenerator (video + invite + templates)

---

## What you did right (Golden Care)

From your screenshots — keep these:

| Field | Your value | ✓ |
|-------|------------|---|
| Name | Golden Care Massage & Acupuncture | ✓ |
| Track | **Prospect** (not Influencer) | ✓ |
| Phone | 0435060287 | ✓ |
| Email | Goldencare.Kareela@gmail.com | ✓ |
| Notes | Kareela Village, Sutherland Shire | ✓ |
| Status | Research → change to **Contacted** when SMS sent | ✓ |

**Ignore for letterbox (don’t waste time):**

- Import from LinkedIn, LinkedIn URL, Platform “LinkedIn + Skool”
- Niche **Mastermind facilitator** (wrong vertical — see Phase 1 below)
- Headline “Mastermind facilitator | Community builder”
- Gift offer **60 days Pro — GatherSync event** (wrong product for first touch)
- Default SMS/email about **GatherSync scheduling** (replace — see templates below)
- HeyGen intro video = GatherSync avatar MP4 (wrong — use **BizoMedia demo URL**)
- Group / frequency “AI Founders Monthly”, recurring group
- Connection sent / Full LinkedIn DM / MCP prompt (LinkedIn-only workflow)
- Tier A/B/C scoring (optional for letterbox)

---

## Today’s workaround (until GatherSync UI ships)

### Step A — GatherSync (minimal fields, ~2 min)

1. **Prospect** track, Status **Research**.
2. Name, phone, email, notes (suburb + offer e.g. “$15 off”).
3. **Do not** Regenerate SMS/email from GatherSync template — it pitches GatherSync, not the video demo.
4. Save once so you have a record (copy **contact id** from URL or DB if visible).

### Step B — BizoMedia (~8 min)

1. Create → brochure → analyze → generate (free, watermarked).
2. Public slug e.g. `golden-care-massage` → demo URL.

### Step C — Message (BizoMedia Admin, ~1 min)

1. `https://app.bizomediamarketing.com/?admin=1`
2. **Letterbox outreach** → demo URL → **Golden Care SMS** → Copy.
3. Send via your phone or email client to `0435060287` / `Goldencare.Kareela@gmail.com`.

### Step D — GatherSync (close the loop, ~1 min)

1. Status → **Contacted** (or **Follow-up 1** if you use that as “demo sent”).
2. Notes append: `BizoMedia demo: https://app.bizomediamarketing.com/golden-care-massage` + date SMS sent.
3. **Follow-up 1 planned** = today + 3 days.

### Step E — Convert (when they reply YES)

1. BizoMedia Admin → Invite → email, `letterbox-drop`, GatherSync contact ID, credits.
2. GatherSync Status → **BizoMedia Invited** (already in your list).
3. Sale amount when paid (e.g. 99 USD) — your revenue tracking already exists.

---

## Phase 1 — GatherSync: “Outreach mode” on same record

Add top-level toggle on add/edit influencer:

| Mode | Who | Shows |
|------|-----|--------|
| **Influencer** (default) | LinkedIn mastermind | Current form |
| **Letterbox / local business** | Brochure drops | Slim form below |

### Letterbox mode — fields only

**Identity**

- **Business name** * (trading name — e.g. Golden Care Massage & Acupuncture)
- **Contact name** * (person to greet — e.g. Golden, Sarah — **not** the mastermind “Name” field alone)
- Phone *
- Email
- Suburb / location (one line)
- Category: Health & wellness · Tradie · Restaurant · Retail · Other

> Today’s influencer form uses one **Name** field for the person/brand — letterbox mode must split **business** vs **contact** to match BizoMedia `businessName` + `contactName`.

**BizoMedia (new)**

- `bizomediaDemoUrl` (url)
- `bizomediaPublicSlug` (text)
- `bizomediaVideoId` (optional uuid)
- Button: **Open in BizoMedia** → `https://app.bizomediamarketing.com/?admin=1&inviteEmail={email}&gathersyncContactId={id}`
- Button: **Open Create (brochure)** → `https://app.bizomediamarketing.com/?view=create` (operator remembers to upload photos)

**Outreach (letterbox templates — not GatherSync Pro)**

- SMS (editable) — default from API or embedded template list (see BizoMedia `lib/letterbox-outreach-templates.ts`)
- Email subject + body (editable)
- Buttons: **Copy SMS** · **Copy email** · **Regenerate from BizoMedia template**

**Status (letterbox subset)**

Hide LinkedIn statuses when in letterbox mode. Use:

| Status | Maps to today’s GS status |
|--------|---------------------------|
| Brochure logged | Research |
| Demo ready | Research |
| Demo sent | Contacted |
| Replied | Interested |
| Won — BizoMedia live | BizoMedia Invited |
| Lost | Declined / Not a Fit |

**Follow-ups**

- Demo sent date (today button)
- Follow-up 1 / 2 dates (keep existing date UX — it works)

**Hide in letterbox mode**

Gift offer, LinkedIn import, niche mastermind chips, HeyGen GatherSync intro, group/frequency, connection/DM tracking, MCP prompt.

---

## Phase 2 — Webhooks (automation)

### BizoMedia → GatherSync (implement on GatherSync)

| Event | When | GatherSync action |
|-------|------|-------------------|
| `bizomedia.prospect.demo_ready` | Operator clicks “Demo sent” in BizoMedia OR pastes URL in GS | Set `bizomediaDemoUrl`, status Demo sent, log activity |
| `bizomedia.invite.created` | BizoMedia Admin Create account | Status BizoMedia Invited, store `bizomediaUserId` |

**`demo_ready` payload (BizoMedia to add):**

```json
{
  "event": "bizomedia.prospect.demo_ready",
  "at": "ISO-8601",
  "contactId": "gathersync-contact-uuid",
  "email": "Goldencare.Kareela@gmail.com",
  "businessName": "Golden Care Massage & Acupuncture",
  "demoUrl": "https://app.bizomediamarketing.com/golden-care-massage",
  "publicSlug": "golden-care-massage",
  "outreachSource": "letterbox-drop",
  "smsCopy": "…optional pre-rendered SMS…"
}
```

**Endpoint:** `POST /api/crm/bizomedia-invite` (same route, different `event` field) or `POST /api/crm/bizomedia-events`.

### GatherSync → BizoMedia (optional later)

- Prefill invite from contact record (already via URL params).

---

## Phase 3 — BizoMedia (this repo)

| Item | Status |
|------|--------|
| Letterbox SMS/email templates | ✅ `lib/letterbox-outreach-templates.ts` + Admin UI |
| Brochure → draft | ✅ Flyer wizard |
| Credit: no charge for PDF-only | ✅ |
| **“Mark demo sent → sync CRM”** button | 🔲 POST `demo_ready` webhook |
| Deep link return: `?gathersyncContactId=` after create | 🔲 |

---

## Phase 4 — Pipeline list view

GatherSync **Pipeline** filter: `Track = Prospect` + `Mode = Letterbox` + status column.

CSV export already mentioned in UI — ensure columns include `bizomediaDemoUrl`, demo sent date, sale amount.

---

## Golden Care — corrected record (copy into Notes until UI ships)

```
OUTREACH: letterbox-drop | BizoMedia (not GatherSync Pro first touch)
Demo URL: https://app.bizomediamarketing.com/golden-care-massage
Offer: $15 off first visit | Health / massage | Kareela Village
Next: SMS BizoMedia demo → FU +3d → on YES $99 setup + invite
```

**SMS to use (not GatherSync scheduling template):**

See BizoMedia Admin → Golden Care SMS, or `LETTERBOX-PROSPECTING-SYSTEM.md`.

---

## Division of work

| Owner | Next task |
|-------|-----------|
| **GatherSync** | Letterbox mode toggle + slim form + letterbox statuses + webhook handler for both events |
| **BizoMedia** | `demo_ready` webhook sender + “Sync to GatherSync” on dashboard after demo |
| **You (ops)** | Use workaround above for Golden Care today; don’t Regenerate GatherSync templates for letterbox |

---

## Success = system works

- [ ] New letterbox contact in &lt;2 min (no LinkedIn fields)
- [ ] Demo URL stored on contact (field, not buried in notes)
- [ ] One-click Copy SMS (BizoMedia pitch, not GatherSync)
- [ ] Follow-up dates drive daily work
- [ ] YES → invite syncs status to BizoMedia Invited automatically
- [ ] Sale $99 logged in existing sale fields

---

## Related

- `LETTERBOX-PROSPECTING-SYSTEM.md` — operator rhythm & $100/day
- `GATHERSYNC-CRM-BIZOMEDIA.md` — invite webhook
- `lib/letterbox-outreach-templates.ts` — message source of truth (can be copied into GatherSync)
