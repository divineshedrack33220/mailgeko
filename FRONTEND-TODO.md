# Frontend — not-yet-implemented features

Checklist of frontend UI that is currently stubbed (shows a "coming soon" toast,
hardcoded data, or static values). Grouped by screen. `Backend?` marks whether an
existing API can support it today:

- **Yes** → frontend-only work (wire to an existing endpoint)
- **No** → needs backend work first (new endpoint / storage / provider)

## Auth — src/app/(auth)/

- [ ] **Google sign-in** — `login/page.tsx:130`, `register/page.tsx:183` — Backend? No (OAuth)
- [ ] **GitHub sign-in** — `login/page.tsx:136`, `register/page.tsx:189` — Backend? No (OAuth)

## Topbar — src/components/layout/topbar.tsx

- [x] **Notification center** — bell dropdown fetches `GET /api/v1/notifications` on open, shows real
      unread count badge, mark-as-read on click (navigates to link), "Mark all as read" (`POST
      /notifications/read-all`), empty/loading states. Backend generates notifications on campaign
      send/failure via engine hooks.

## Contacts list — src/app/(app)/contacts/page.tsx

- [ ] **Bulk tag selected contacts** (`:275`) — Backend? No (no bulk endpoint)
- [ ] **Bulk add selected to a list** (`:278`) — Backend? No (no bulk endpoint)
- [ ] **Row menu "Manage tags"** (`:432`) — Backend? Yes (PATCH /api/v1/contacts/{id} takes tags)

## Contact detail — src/app/(app)/contacts/[id]/page.tsx

- [ ] **Add to list** (`:123`) — Backend? Partial (POST /api/v1/lists/{id}/contacts exists, reverse direction)
- [ ] **Compose a 1:1 email** (`:126`) — Backend? No
- [ ] **Edit profile** (`:137`) — Backend? Yes (PATCH /api/v1/contacts/{id})
- [ ] **Manage tags** (`:140`) — Backend? Yes (same PATCH)
- [ ] **Add a tag** chip (`:212`) — Backend? Yes (same PATCH)

## Campaign detail — src/app/(app)/campaigns/[id]/page.tsx

- [ ] **Per-campaign breakdown** (`:373`) — Backend? Yes (GET /api/v1/analytics/campaigns/{id} exists, not wired)
- [ ] **Email preview** (`:472`) — Backend? Yes (client-side render of HTML)

## AI Studio — src/app/(app)/ai/page.tsx

- [ ] **Full generation history** (`:361`) — Backend? No (only POST /api/v1/ai/subject; no history endpoint)
- [ ] **Brand voice chooser** (`:474`) — Backend? No

## Automations — src/app/(app)/automations/

- [ ] **Choose a template from the library** (add-step) — `automations/page.tsx:140` — Backend? Yes (templates API + create-from-template)
- [ ] **Tag picker** (condition step) — `automations/[id]/page.tsx:912` — Backend? No (no tags endpoint)

## Templates — src/app/(app)/templates/page.tsx

- [ ] **Draft a template from a prompt** (`:163`) — Backend? No (no template-generation endpoint)

## Lists — src/app/(app)/lists/page.tsx

- [ ] **View contacts in a list** (`:275`) — Backend? No (list endpoint returns count only; contacts API has no list filter)

## Settings — src/app/(app)/settings/

- [ ] **Profile photo upload** — `settings/page.tsx:115,122` — Backend? No (no file storage)
- [ ] **Workspace logo upload** — `settings/page.tsx:189,192` — Backend? No (no file storage)
- [ ] **Sending defaults** (from-name / from-email) — `settings/page.tsx:272` — Backend? No
- [ ] **Workspace slug** — hardcoded `acme.mailgeko.dev` (`settings/page.tsx:211`) — Backend? No (no subdomain infra)
- [ ] **Two-factor authentication** — `settings/security/page.tsx:80,172` — Backend? No
- [ ] **Session management** (list/revoke) — `settings/security/page.tsx:209,239` — Backend? No
- [ ] **Member reminders** — `settings/team/page.tsx:307` — Backend? No

## Notes

- Billing "Update payment method" toast (`settings/billing/page.tsx:226`) is **intentional** — it
  redirects to the Stripe portal; not a gap.
- AI Studio "Got it — we'll tune the output" (`ai/page.tsx:295`) is a feedback ack, not a stub.
- Auth landing testimonial "Head of Growth, Northwind" (`(auth)/layout.tsx:41`) is static
  marketing copy — keep or replace, but not an unimplemented feature.
- Dashboard, campaigns list, reports, and the sidebar are fully API-driven (verified).

## Suggested order

1. **Frontend-only wins** (Backend? Yes): contact Manage/Edit/Add-tag, email preview,
   per-campaign breakdown, automation "choose template".
2. **Small backend additions**: bulk tag / bulk add-to-list, list-contacts view, tags picker,
   sending defaults, in-app notifications.
3. **New infrastructure**: OAuth (Google/GitHub), 2FA, session management, file uploads,
   template-from-prompt, AI history/brand voice, 1:1 email.
