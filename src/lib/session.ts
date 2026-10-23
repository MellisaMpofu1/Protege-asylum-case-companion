import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { TKey } from "@/lib/i18n";

export type Membership = {
  org_id: string;
  role: "admin" | "practitioner";
  org_name: string;
  is_demo: boolean;
};
export type AppCtx = {
  user_id: string;
  profile: {
    display_name: string | null;
    ui_locale: "en" | "pt-PT";
    preferred_language: string | null;
    needs_language_assistance: boolean;
    email_notifications: boolean;
    policy_version: string | null;
  } | null;
  memberships: Membership[];
  case: { id: string; org_id: string; label: string; is_demo: boolean; org_name: string } | null;
  unread: number;
  onboarded: boolean;
  consents: Record<string, boolean>;
};

export const ctxQuery = {
  queryKey: ["ctx"] as const,
  queryFn: async (): Promise<AppCtx> => {
    await supabase.rpc("ensure_profile");
    const { data, error } = await supabase.rpc("my_context");
    if (error) throw error;
    return data as unknown as AppCtx;
  },
  staleTime: 30_000,
};

export function useAppCtx() {
  return useQuery(ctxQuery);
}

export function roles(ctx: AppCtx | undefined) {
  const m = ctx?.memberships ?? [];
  return {
    isApplicant: !!ctx?.case,
    isPractitioner: m.some((x) => x.role === "practitioner"),
    isAdmin: m.some((x) => x.role === "admin"),
    adminOrgs: m.filter((x) => x.role === "admin"),
    isDemo: !!ctx?.case?.is_demo || m.some((x) => x.is_demo),
    portal: portalOf(ctx),
  };
}

export type Portal = "staff" | "applicant" | "none";
/** Portal comes only from server-returned memberships / case ownership. Staff wins; the DB forbids holding both. */
export function portalOf(ctx: AppCtx | undefined | null): Portal {
  if (!ctx) return "none";
  if ((ctx.memberships ?? []).length > 0) return "staff";
  return ctx.case ? "applicant" : "none";
}

const STAFF_PREFIXES = ["/work", "/admin"];
const APPLICANT_PREFIXES = ["/home", "/case", "/documents", "/appointments", "/renewal", "/support", "/rights", "/life"];
const under = (path: string, p: string) => path === p || path.startsWith(p + "/");

/** Whether a signed-in context may open a path. Fails closed for unknown context. */
export function canOpen(ctx: AppCtx | undefined | null, path: string): boolean {
  const portal = portalOf(ctx);
  const m = ctx?.memberships ?? [];
  if (under(path, "/admin")) return m.some((x) => x.role === "admin");
  if (under(path, "/work")) return m.some((x) => x.role === "practitioner");
  if (APPLICANT_PREFIXES.some((p) => under(path, p))) return portal === "applicant";
  if (STAFF_PREFIXES.some((p) => under(path, p))) return false;
  return !!ctx; // /notifications, /settings
}

export function homeFor(ctx: AppCtx | undefined | null): string {
  const m = ctx?.memberships ?? [];
  if (m.some((x) => x.role === "practitioner")) return "/work";
  if (m.length) return "/admin";
  return ctx?.case ? "/home" : "/settings";
}

/** Map backend errors to user-safe messages that never reveal other cases. */
export function errorKey(e: unknown): TKey {
  const msg = (e as { message?: string })?.message ?? String(e ?? "");
  if (/version_conflict/.test(msg)) return "error_conflict";
  if (/forbidden|permission|not_authenticated/.test(msg)) return "error_forbidden";
  if (/Failed to fetch|NetworkError|network/i.test(msg)) return "error_network";
  if (/title_required|message_required|reason_required|date_required/.test(msg)) return "required";
  return "error_generic";
}

const ALLOWED_EVENTS = new Set([
  "login",
  "onboarding_started",
  "onboarding_completed",
  "dashboard_viewed",
  "timeline_viewed",
  "action_viewed",
  "document_viewed",
  "upload_attempted",
  "upload_completed",
  "upload_failed",
  "appointment_viewed",
  "renewal_viewed",
  "support_viewed",
  "help_requested",
  "action_reported",
]);

function device(): string {
  if (typeof window === "undefined") return "desktop";
  const w = window.innerWidth;
  return w < 640 ? "mobile" : w < 1024 ? "tablet" : "desktop";
}

/** Allowlisted, pseudonymous analytics only — never names, emails, case text or document names. */
export function logEvent(event: string, objectId?: string) {
  if (!ALLOWED_EVENTS.has(event)) return;
  let session = sessionStorage.getItem("protege.sid");
  if (!session) {
    session = crypto.randomUUID().slice(0, 12);
    sessionStorage.setItem("protege.sid", session);
  }
  void supabase.rpc("log_event", {
    _event: event,
    _object: objectId as string,
    _session: session,
    _device: device(),
  });
}
