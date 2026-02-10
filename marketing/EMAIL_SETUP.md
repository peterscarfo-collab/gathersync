# GatherSync Email Setup Checklist

Use this checklist to set up production email for `@gathersync.app` and keep marketing/support communication reliable.

## 1) Mailbox Plan

Create these addresses first:

- `hello@gathersync.app` (primary public inbox)
- `support@gathersync.app` (customer support)
- `billing@gathersync.app` (subscription and payment issues)
- `legal@gathersync.app` (privacy/terms/data requests)
- `admin@gathersync.app` (vendor/platform/account notices)

Recommended early-stage setup:

- Use **one real inbox** (`hello@`) to start.
- Configure `support@`, `billing@`, and `legal@` as aliases/forwarders to `hello@`.
- Keep `admin@` as separate if possible for operational/security alerts.

## 2) Provider Setup (Namecheap Private Email or your email host)

- [ ] Activate email hosting for `gathersync.app`
- [ ] Create mailbox `hello@gathersync.app`
- [ ] Create aliases/forwarders: `support@`, `billing@`, `legal@`
- [ ] Create mailbox or forwarder for `admin@gathersync.app`
- [ ] Set mailbox password policy and recovery options
- [ ] Enable 2FA on admin account(s)

## 3) DNS Records (Required)

Add or verify the following records in DNS:

- [ ] **MX** records from your email provider
- [ ] **SPF** TXT record authorizing outbound senders
- [ ] **DKIM** TXT/CNAME records from provider
- [ ] **DMARC** TXT policy

Baseline DMARC starter (monitoring mode):

```txt
Host: _dmarc.gathersync.app
Type: TXT
Value: v=DMARC1; p=none; rua=mailto:admin@gathersync.app; ruf=mailto:admin@gathersync.app; fo=1; adkim=s; aspf=s
```

After stable delivery, tighten to quarantine/reject.

## 4) Test Matrix

Run these tests after DNS propagation:

- [ ] Send from personal Gmail to `hello@gathersync.app`
- [ ] Send from Outlook to `hello@gathersync.app`
- [ ] Reply from `hello@` back to both accounts
- [ ] Verify no SPF/DKIM/DMARC warnings in received headers
- [ ] Confirm forwarding works for `support@`, `billing@`, `legal@`
- [ ] Confirm `admin@` receives monitoring/security email

## 5) Website + Product Touchpoints

Update/verify these locations point to valid inboxes:

- [ ] Marketing pages (contact + beta tester callouts)
- [ ] Privacy Policy contact section
- [ ] Terms of Service contact section
- [ ] App support/help links
- [ ] Billing/help center templates

## 6) Later Hardening

Do these after initial launch:

- [ ] Move DMARC from `p=none` to `p=quarantine`, then `p=reject`
- [ ] Split aliases into dedicated mailboxes as volume grows
- [ ] Add shared inbox/workflow tooling for support triage
- [ ] Create `security@gathersync.app` for vulnerability disclosures

## Notes

- Current public contact used in marketing assets: `hello@gathersync.app`.
- Keep this file updated when mailbox ownership or policies change.
