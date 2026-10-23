const KNOWN = new Set([
  "appointment_created",
  "appointment_rescheduled",
  "appointment_updated",
  "appointment_cancelled",
  "appointment_response",
  "new_message",
  "case_update",
  "applicant_update",
  "document_requested",
  "action_assigned",
  "action_reported",
  "help_request",
  "help_response",
  "status_updated",
  "demo_hist_renewal",
  "demo_hist_interview",
  "demo_hist_followup",
  "status_correction",
]);

/** Translation key for a stored notification type; unknown types fall back to the generic text. */
export function notificationText(key: string): string {
  return KNOWN.has(key) ? `n_${key}` : "notif_generic";
}

/** Only same-app relative paths are followed from a notification. */
export function safeLink(link: string | null | undefined): string {
  if (!link || !/^\/(?!\/)[A-Za-z0-9/_#-]*$/.test(link)) return "/notifications";
  return link;
}
