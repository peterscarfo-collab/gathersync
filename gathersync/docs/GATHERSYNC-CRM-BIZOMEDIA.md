# GatherSync ↔ BizoMedia — one CRM for influencer outreach

When you invite someone from **BizoMedia Admin → Invite user**, BizoMedia can:

1. Store **where they came from** (`outreachSource`, `gathersyncContactId`)
2. Save your **personal message** on the user record
3. **POST a webhook** to GatherSync (optional) so the contact moves to “Invited on BizoMedia”
4. Show **Copy full message** — paste into GatherSync inbox / email (Instant magic email is code-only)

## BizoMedia env (app Netlify)

```
GATHERSYNC_CRM_WEBHOOK_URL=https://app.gathersync.app/api/crm/bizomedia-invite
GATHERSYNC_CRM_WEBHOOK_SECRET=<same secret on GatherSync>
```

If unset, invite still works — use **Copy full message** and log manually in GatherSync.

## Webhook payload

```json
{
  "event": "bizomedia.invite.created",
  "at": "2026-06-02T12:00:00.000Z",
  "contactId": "gathersync-contact-uuid",
  "source": "gathersync-influencer",
  "email": "ivan@example.com",
  "bizomediaUserId": "instant-user-id",
  "businessName": "BBG Forum",
  "publicSlug": "bbg",
  "personalMessage": "Hi Ivan…",
  "magicCodeSent": true,
  "appUrl": "https://app.bizomediamarketing.com",
  "outreachCopy": "Full text with sign-in instructions…"
}
```

## GatherSync side

1. `POST /api/crm/bizomedia-invite` — `Authorization: Bearer` + `GATHERSYNC_CRM_WEBHOOK_SECRET`.
2. **`bizomedia.invite.created`** — match `contactId` or `email`; set `bizomedia_invited`, store `bizomediaUserId`, append notes.
3. **`bizomedia.prospect.created`** — upsert letterbox prospect (`outreachTrack: prospect`, source `letterbox-drop`); match `contactId` → email → phone → `businessName`; return `{ "contactId": "uuid" }`.
4. Deep link from GatherSync → BizoMedia admin invite (`gathersyncContactId` query param).
5. **Letterbox pipeline** — **`GATHERSYNC-LETTERBOX-CRM-SPEC.md`**, **`LETTERBOX-PROSPECTING-SYSTEM.md`**
6. **Planned:** `bizomedia.prospect.demo_ready` — demo URL synced to contact

### Suggested GatherSync stages (letterbox)

`brochure_received` → `demo_building` → `demo_sent` → `replied_interested` → `won_setup` → `won_recurring` | `lost`

## Schema push (BizoMedia Instant app)

Run from the **poemgenerator** repo (Instant reads `instant.schema.ts` in cwd):

```bash
cd ~/dev/poemgenerator
npx instant-cli push schema -a a95e1e6f-be2a-4f06-8f92-52de8e8e38fc
```

Or:

```bash
cd ~/dev/poemgenerator && npm run push-schema
```

Public pages (`/gathersync`, `/explore`) also need permissions:

```bash
cd ~/dev/poemgenerator && npm run push-perms
```

New `$users` fields: `outreachSource`, `gathersyncContactId`, `lastInviteMessage`, `invitedAt`.

Invite form **Save draft** uses `adminInviteDrafts` (keyed by email) — push schema + perms after deploy.

## Letterbox CRM UI (GatherSync repo)

The influencer add/edit form is the wrong shape for brochure prospects. Full joint spec:

**`GATHERSYNC-LETTERBOX-CRM-SPEC.md`** — letterbox mode, field list, webhooks, Golden Care workaround.
