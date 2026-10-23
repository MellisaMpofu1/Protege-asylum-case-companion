import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Only these origins may receive sign-in callbacks. */
export function allowedOrigin(origin: string | undefined | null): string | null {
  if (!origin) return null;
  try {
    const u = new URL(origin);
    const ok =
      (u.protocol === "https:" && (u.hostname.endsWith(".lovable.app") || u.hostname.endsWith(".lovableproject.com"))) ||
      (u.protocol === "http:" && u.hostname === "localhost");
    return ok ? u.origin : null;
  } catch {
    return null;
  }
}

type SendResult = { ok: boolean; status: "provider_accepted" | "send_failed"; error?: string };

async function deliver(id: string, email: string, token: string, origin: string): Promise<SendResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const redirectTo = `${origin}/invite/${token}`;
  // New identity: invitation email. Existing identity: one-time sign-in link.
  let { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, { redirectTo });
  if (error && /already|registered|exists/i.test(error.message)) {
    ({ error } = await supabaseAdmin.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false, emailRedirectTo: redirectTo },
    }));
  }
  const ok = !error;
  if (error) console.error("invite send failed", error.message);
  await supabaseAdmin.rpc("record_invitation_send", { _id: id, _ok: ok, _err: error?.message ?? "" });
  return ok
    ? { ok, status: "provider_accepted" }
    : { ok, status: "send_failed", error: /rate/i.test(error!.message) ? "rate_limited" : "provider_error" };
}

function originFromRequest(): string {
  const o = allowedOrigin(getRequestHeader("origin")) ?? allowedOrigin(getRequestHeader("referer"));
  if (!o) throw new Error("forbidden_origin");
  return o;
}

export const sendInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        org: z.string().uuid(),
        email: z.string().email().max(254),
        role: z.enum(["applicant", "practitioner", "admin"]),
        caseId: z.string().uuid().nullable(),
        caseIds: z.array(z.string().uuid()).max(200),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const origin = originFromRequest();
    // Permission checks (org admin, case validity, rate limit) happen in the database as the caller.
    const { data: inv, error } = await context.supabase.rpc("create_invitation_v2", {
      _org: data.org,
      _email: data.email,
      _role: data.role,
      _case: data.caseId as string,
      _cases: data.caseIds,
    });
    if (error) throw new Error(error.message.match(/[a-z_]+$/)?.[0] ?? "error");
    const i = inv as { id: string; token: string; email: string };
    return deliver(i.id, i.email, i.token, origin);
  });

export const resendInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const origin = originFromRequest();
    const { data: inv, error } = await context.supabase.rpc("rotate_invitation_token", { _id: data.id });
    if (error) throw new Error(error.message.match(/[a-z_]+$/)?.[0] ?? "error");
    const i = inv as { id: string; token: string; email: string };
    return deliver(i.id, i.email, i.token, origin);
  });
