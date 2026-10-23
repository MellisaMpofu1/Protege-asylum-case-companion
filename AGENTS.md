<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Responsive browser layouts use one shared AppShell and viewport-driven CSS; role navigation always comes from session roles, never device size. Why: embedded and full-page views must share access controls and data.
- All writes go through security-definer SQL functions that check auth.uid(); clients have SELECT-only grants under RLS. Why: permissions enforced in one place, auditable.
- Case access = applicant ownership or an explicit case_grants row; org membership alone never grants case data. Why: brief requires per-case authorisation.
- Documents live in a private bucket with no client policies; upload/retrieval only via server functions in src/lib/documents.functions.ts. Why: signature checks and short signed links.
- Reminders are scheduled by DB triggers into reminder_outbox and processed by an hourly pg_cron job. Why: idempotent, survives retries.
- UI strings live in src/lib/i18n.tsx (en, pt-PT). Why: single reviewable translation source.
- Applicant pages live under src/routes/_authenticated/_applicant and staff pages under _staff; each layout redirects by server-returned portal before child data loads. Why: portal separation is enforced by route, not menu.
- Invitation emails are sent only by server functions in src/lib/invitations.functions.ts after the database authorises the caller; send status records provider acceptance, never delivery. Why: honest delivery reporting and no client access to privileged auth calls.
- Cross-portal in-app notifications are created by SQL functions/triggers (notify_applicant, notify_case_staff), and clients subscribe via realtime under RLS. Why: recipients are derived from case ownership and grants in one place.
- Application status lives in append-only case_status_history, written only via record_application_status (assigned staff; Approved needs a decision reference + linked correspondence). Why: preserves history and never infers approval.
- Applicant-only demo history lives in applicant_demo_fixtures (per-applicant rows, stable text ids, RLS to owner only); sample PDFs are public fictional assets. Why: keeps demo content out of staff, monitoring and reminder paths.
