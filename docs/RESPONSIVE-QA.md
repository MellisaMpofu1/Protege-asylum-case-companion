# Responsive browser verification

Verified 7 October 2026 in Chromium against the running app, with no page-wide horizontal overflow or runtime errors at **360, 390, 768, 1024 and 1440px**.

## Coverage
- Public welcome, sign-in and invitation/account-access pages without private case content.
- Applicant home, case, documents, appointments, renewal, support, notifications and settings.
- Authenticated demo applicant, practitioner and administrator accounts; applicant navigation contains no staff links, practitioner navigation contains no applicant/admin links.
- Assigned staff caseload with populated data and contained horizontal table scrolling; all nine case tabs; all eight administration tabs and monitoring.
- Direct navigation and refresh on representative protected routes; menu opening, Escape dismissal and desktop sidebar collapse/expand.
- Case update form filled without submission; document-removal confirmation opened and cancelled without changing documents.
- Dialog bounds at all five widths; a 390 × 450 reduced-height viewport confirms the form scrolls within its dialog.
- Live viewport resizing of the same page/session, not separate mobile app rendering.
- Twelve regression tests pass, including viewport-independent role checks.

## Remaining verification limits
- A physical iOS/Android keyboard, Safari and phone rotation on real hardware have not been tested. Visual viewport resize/scroll handling and reduced-height Chromium checks are in place.
- Document lists, upload controls and confirmation dialogs were verified. Existing demo documents are samples with downloads disabled; rendering a real private PDF/image in the browser remains unverified. No sensitive documents were uploaded or cached for testing.
- The editor's embedded frame was not driven by automation; the same app was tested directly in full-page localhost browser contexts at the embedded frame's representative widths.
- No remaining layout defects were observed in the tested states. Existing email, malware scanning, translation and legal rollout dependencies are unchanged.