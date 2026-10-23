# Protege refinement: two portals, invitations, appointments, messages

Decisions: staff account stays mellisampofu04@gmail.com (the brief's spelling is a typo). Emails use the default sender for now, which has strict sending limits. No custom domain yet.

## 1. Accounts and invitations
- Keep the existing admin's password login, roles and case grants unchanged.
- Admin invitation screen: **Invite Applicant** (creates or picks one synthetic workspace) and **Invite Caseworker** (choose the cases to assign explicitly). Neither gives admin rights.
- Sending runs only when the admin clicks it. A server function sends a one-time sign-in email through the built-in sign-in service. It records "provider accepted" or "sending failed". It never records "delivered".
- Invitation list shows pending, accepted, expired, revoked and sending failed, with Resend and Revoke.
- Acceptance checks the signed-in email, then the role, organisation and case on the server. It is idempotent with no duplicate rows. A wrong account gets a clear message. Revoked invitations are blocked even if a sign-in link was already sent.
- ncube9562@gmail.com: if the account exists, repair it to applicant only with one workspace. Otherwise it gets created when the invitation is accepted. Nothing is sent automatically.

## 2. Passwordless sign-in
- The sign-in page gets an "Email me a sign-in link" option (one-time, expiring) next to password login. Open sign-up stays blocked: links go only to invited or existing accounts.
- Return addresses are limited to the app's own sign-in callback page.

## 3. Applicant portal (six pillars)
Menu: Home, My Case, My Documents (includes Renewal), My Appointments, My Support (contacts, help, messages), My Rights, My Life in Portugal, Notifications, Settings.
- My Rights and My Life in Portugal reuse the reviewed information cards, filtered by category. If nothing has been reviewed yet, they show an honest empty state.
- Home shows the latest update, next action, upcoming appointment and support contact.

## 4. Staff portal
- Case view gets: create, edit, reschedule and cancel appointments (title, Lisbon date and time, location or link, preparation steps, documents); applicant-visible updates; document requests; messages. Every save asks staff to choose "Visible to applicant" or "Internal note".
- Appointments are labelled "Recorded by your caseworker — not an official AIMA booking."

## 5. Appointment flow
Saving, rescheduling or cancelling notifies only that applicant in the app. The notification opens the right appointment. The applicant can choose "Acknowledge" or "Request change". The caseworker sees the response, and assigned staff get a notification.

## 6. Messages and notifications
- One simple conversation per case, between the applicant and assigned staff, with unread counts. No internal notes appear in it.
- Notifications and messages update live and refetch when the connection comes back. The badge and the list use the same count.

## 7. Security
- Separate applicant and staff page groups, each with its own layout and guard. A neutral loading screen shows until permissions arrive.
- All new tables are read-only to the browser and filtered by case. All writes go through the existing kind of checked server-side steps.
- Sign-out clears cached data and live connections.

## 8. Verification
Run the build and tests. Check permissions on the server as test identities: unassigned caseworker, applicant reaching staff data, wrong-account invite, revoked or expired invite. Browser-test the appointment and message flow with demo accounts at mobile and desktop widths. Real inbox receipt for ncube and other participants still needs your manual confirmation. Each check is reported as PASS, FAIL or NOT TESTED.

## Technical notes
- New tables: `case_messages` and `appointment_responses`. New columns: `appointments.status`/`timezone`/`cancelled_at`, `invitations.send_status`/`sent_at`/`last_error`, `resources.category`.
- New functions: send/resend via `createServerFn`, using the admin client's `signInWithOtp` with `shouldCreateUser` only for a valid pending invite. The function checks the admin role first through the user's own permissions. A rate limit is stored in the database.
- Realtime goes on `notifications` and `case_messages`, with RLS-filtered subscriptions.
- Route groups are `_authenticated/_applicant` and `_authenticated/_staff`. The existing paths stay the same.
