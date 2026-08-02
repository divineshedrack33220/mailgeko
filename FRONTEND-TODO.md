# Frontend — not-yet-implemented features

Checklist of frontend UI that is still stubbed (shows a "coming soon" toast,
hardcoded data, or static values). Grouped by screen. `Backend?` marks whether an
existing API can support it today:

- **Yes** → frontend-only work (wire to an existing endpoint)
- **No** → needs backend work first (new endpoint / storage / provider)

## Remaining (all need backend work)

- [ ] **Compose a 1:1 email** — `contacts/[id]/page.tsx:234` — Backend? No (no
      direct-send endpoint; the engine sends through campaigns)
- [ ] **AI Studio generation history** — `ai/page.tsx:361` — Backend? No (only
      `POST /api/v1/ai/subject`; no history table/endpoint)
- [ ] **AI Studio brand voice chooser** — `ai/page.tsx:474` — Backend? No
- [ ] **Draft a template from a prompt** — `templates/page.tsx:163` — Backend? No
      (no template-generation endpoint)
- [ ] **Workspace slug** — hardcoded `acme.mailgeko.dev` (`settings/page.tsx`) — Backend? No
      (no subdomain infra)

## Done

- [x] **Google / GitHub sign-in** — native OAuth in Go; buttons on login/register
      redirect to `/api/v1/auth/oauth/{google,github}`, callback handled at `/oauth/callback`.
- [x] **Profile photo + workspace logo upload** — `POST /api/v1/me/avatar` and
      `POST /api/v1/workspace/logo` (Cloudinary); sidebar/topbar/settings show them.
- [x] **Bulk tag selected contacts** — `contacts/page.tsx` → `POST /api/v1/contacts/bulk/tags`.
- [x] **Bulk add selected to a list** — `contacts/page.tsx` → `POST /api/v1/lists/{id}/contacts`.
- [x] **Row menu "Manage tags"** — `contacts/page.tsx`.
- [x] **Contact detail: add to list / edit profile / manage tags / add tag chip** — all wired.
- [x] **Per-campaign analytics breakdown** — `campaigns/[id]/page.tsx` → `GET /api/v1/analytics/campaigns/{id}`.
- [x] **Email preview** — `campaigns/[id]/page.tsx` renders `htmlContent` in an iframe.
- [x] **Automations: choose a template** — template-library dialog; **tag picker** — fetches `/api/v1/tags`.
- [x] **View contacts in a list** — `/lists/{id}` page uses `GET /api/v1/contacts?listId=`.
- [x] **Sending defaults** (from-name / from-email / reply-to) — `PATCH /api/v1/workspace`.
- [x] **Draft a template from a prompt** — `templates/new/page.tsx` → `POST /api/v1/templates/generate`.
- [x] **Two-factor authentication** — setup/enable/disable/recovery codes + login challenge
      (`POST /api/v1/auth/2fa/*`); `settings/security/page.tsx` + login page.
- [x] **Session management** (list/revoke/revoke-all) — `GET/DELETE /api/v1/auth/sessions`;
      sessions recorded in Redis at every sign-in.
- [x] **Member reminders** — `POST /api/v1/workspace/members/{id}/remind` + resend invite
      actually emails the member via the workspace sender; team page dropdown wired.

## Notes

- Billing "Update payment method" toast (`settings/billing/page.tsx:226`) is **intentional** — it
  redirects to the Stripe portal; not a gap.
- AI Studio "Got it — we'll tune the output" (`ai/page.tsx:295`) is a feedback ack, not a stub.
- Auth landing testimonial "Head of Growth, Northwind" (`(auth)/layout.tsx:41`) is static
  marketing copy — keep or replace, but not an unimplemented feature.
- Dashboard, campaigns list, reports, and the sidebar are fully API-driven (verified).

## Suggested order

1. **1:1 email** — contact detail → send a one-off to a single contact (new direct-send endpoint).
2. **AI Studio history + brand voice** — store/recall generated subjects; persistence table + endpoints.
3. **Template from prompt** — reuse the AI client for a template-generation endpoint.
4. **Security** — 2FA + session list/revoke (TOTP via the existing session store).
5. **Member reminders** — scheduled re-send of an invitation.
