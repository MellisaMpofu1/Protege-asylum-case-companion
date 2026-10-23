# Protege — operator setup notes

Technical notes for the project owner. Not shown to applicants.

## First administrator (one-time)
1. A single-use bootstrap code is stored (hashed) in `bootstrap_codes`. The code was delivered privately to the project owner.
2. Open `/bootstrap`, create an account, confirm the email, sign in, enter the organisation name and code.
3. The code cannot be reused. To issue a new one, insert a new SHA-256 hash into `bootstrap_codes` from a trusted backend session. There is no public admin signup.

## Accounts and invitations
- Administrators invite practitioners, admins and applicants (Administration → Invitations). Links are single-use, expire after 7 days, and are bound to the invited email.
- Invitation emails are not sent automatically yet; share links over a secure channel.
- Case access is granted per case (Cases & access). Organisation membership never grants case access.

## Demo data (development only)
`SEED_ALLOW=dev DEMO_ACCOUNTS_OUT=<file> python3 scripts/seed_demo.py Protege_Simulated_Users_200.xlsx`
- Idempotent (deterministic IDs + ON CONFLICT). Maps the workbook's PGU/PGC cohort IDs into "DEMO — Protege Simulation NGO" (200 workspaces) and a second "DEMO — Isolation Test Organisation".
- Creates four demo auth accounts with random passwords (admin, practitioner with 40 assigned cases, applicant on PGC0001, isolation-org practitioner). `RESET_PASSWORDS=1` rotates them.
- Sample documents are metadata-only (no file). Demo reminders never leave the app.
- Reset: delete the two demo organisations (cascade) from a trusted session after temporarily removing their memberships.

## Reminders
- Created automatically only from practitioner-confirmed action dates, confirmed appointments, and reviewed renewal preparation dates. Changing a date cancels the old reminder and schedules a new one (idempotency key per target + date).
- Hourly job `protege-process-reminders` runs `process_reminders(200)`; in-app notifications only. Messages are generic.
- Email channel: not configured. Requires a sending domain/provider before enabling; until then nothing is claimed as sent.

## Documents
- Private bucket `case-documents`, no client storage policies. Uploads go through a server function that checks file signatures (PDF/JPEG/PNG), size ≤ 10 MB and rejects PDFs with active content.
- Retrieval: authorisation via the caller's permissions, then a 60-second signed link. A link already issued stays valid until it expires (max 60 s); revocation is not instant.
- **Rollout blocker:** no malware scanning yet. Do not accept real applicant documents until scanning is added.

## Translations and content
- English and European Portuguese strings live in `src/lib/i18n.tsx`. They must be reviewed by a qualified translator before real use. Staff screens are currently English-only.
- Information cards must be reviewed and published by an administrator; cards older than 180 days are flagged for re-review.

## Tests
- `bunx vitest run` — date-only/timezone, metrics, upload validation.
- `supabase/tests/permissions.sql` — backend permission tests (cross-case, cross-org, self-promotion, review-only verification, concurrency, reminders, demo exclusion). Run as a privileged database session; it rolls back.

## Pending / owner decisions
- Controller/processor roles, legal basis and retention periods (deletion requests are reviewed manually; no automatic deletion).
- Backups: rely on Lovable Cloud backups; document restore procedure with your hosting owner.
- No "GDPR compliant" claim is made. Malware scanning, email provider, translation review and closed beta remain before rollout.

## Terms, privacy and consent
- Versions live in `consent_documents`; bump a version only for a material change — users are then asked again. Choices are append-only in `consent_records` (user, purpose, version, choice, server time).
- Required: terms + privacy-notice acknowledgement, enforced by database triggers on help requests, documents, timeline entries and profile details. Optional: pseudonymous usage analytics (`log_event` records nothing without consent).
- Legal texts in `src/lib/legal.tsx` are DRAFTS. Blockers before real applicants: controller/operator identity and contacts, legal bases, retention, hosting region/transfers, complaint contact, legal review.
