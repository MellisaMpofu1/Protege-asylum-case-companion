import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ErrorState, Loading } from "@/components/protege/ui";
import { POLICY_VERSION, useI18n } from "@/lib/i18n";
import { AuthCard } from "./auth";

export const Route = createFileRoute("/invite/$token")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Your invitation — Protege" },
      { name: "description", content: "Accept your Protege invitation." },
      { property: "og:title", content: "Your invitation — Protege" },
      { property: "og:description", content: "Accept your Protege invitation." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: InvitePage,
});

type Inv = {
  state: "valid" | "invalid" | "expired" | "revoked" | "used";
  role?: string;
  org_name?: string;
  email_hint?: string;
};

function InvitePage() {
  const { token } = Route.useParams();
  const { t } = useI18n();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const inv = useQuery({
    queryKey: ["invite", token],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("lookup_invitation", { _token: token });
      if (error) throw error;
      return data as unknown as Inv;
    },
  });
  const [session, setSession] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setSession(data.user?.email ?? null));
  }, []);
  const [email, setEmail] = useState("");
  const [ack, setAck] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (inv.isLoading || session === undefined)
    return (
      <AuthCard title={t("inv_title")}>
        <Loading />
      </AuthCard>
    );
  if (inv.error)
    return (
      <AuthCard title={t("inv_title")}>
        <ErrorState error={inv.error} onRetry={() => inv.refetch()} />
      </AuthCard>
    );
  const d = inv.data!;
  if (d.state !== "valid") {
    const k =
      d.state === "expired"
        ? "inv_expired"
        : d.state === "revoked"
          ? "inv_revoked"
          : d.state === "used"
            ? "inv_used"
            : "inv_invalid";
    return (
      <AuthCard title={t("inv_title")}>
        <p role="alert">{t(k)}</p>
      </AuthCard>
    );
  }

  async function accept() {
    setBusy(true);
    setErr(null);
    const { data, error } = await supabase.rpc("accept_invitation", { _token: token });
    if (!error) await supabase.rpc("acknowledge_policy", { _version: POLICY_VERSION });
    setBusy(false);
    if (error) {
      const m = error.message;
      return setErr(
        /mismatch/.test(m) ? t("inv_mismatch")
        : /staff_account|applicant_account|already_applicant/.test(m) ? t("inv_role_conflict")
        : /expired/.test(m) ? t("inv_expired")
        : /not_pending/.test(m) ? t("inv_used")
        : t("error_generic"),
      );
    }
    await qc.resetQueries();
    const role = (data as { role?: string })?.role ?? d.role;
    navigate({ to: role === "applicant" ? "/home" : role === "practitioner" ? "/work" : "/admin", replace: true });
  }

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: false, emailRedirectTo: `${window.location.origin}/invite/${token}` },
    });
    setBusy(false);
    // Same message whether or not the account exists, so addresses cannot be probed.
    if (error && /rate|security purposes/i.test(error.message)) return setErr(t("link_rate_limited"));
    setMsg(t("link_sent"));
  }

  async function switchAccount() {
    qc.clear();
    await supabase.auth.signOut();
    setSession(null);
  }

  return (
    <AuthCard title={t("inv_title")}>
      <p className="mb-1 text-sm text-muted-foreground">{t("inv_for")}</p>
      <p className="mb-4 font-semibold">
        {d.org_name} · {d.email_hint}
      </p>
      <p className="mb-4 text-sm">{t("policy_text")}</p>
      <label className="mb-4 flex items-start gap-2 text-sm">
        <Checkbox
          checked={ack}
          onCheckedChange={(v) => setAck(v === true)}
          aria-label={t("policy_ack", { v: POLICY_VERSION })}
        />
        <span>{t("policy_ack", { v: POLICY_VERSION })}</span>
      </label>
      {session ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{t("inv_signed_in_as", { e: session })}</p>
          <Button className="w-full" disabled={!ack || busy} onClick={accept}>
            {t("inv_accept")}
          </Button>
          <Button variant="link" className="px-0" onClick={switchAccount}>{t("inv_not_you")}</Button>
        </div>
      ) : (
        <form onSubmit={sendLink} className="space-y-3">
          <p className="text-sm text-muted-foreground">{t("inv_link_intro")}</p>
          <div className="space-y-1.5">
            <Label htmlFor="e">{t("email")}</Label>
            <Input id="e" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={busy || !email}>
            {t("email_me_link")}
          </Button>
        </form>
      )}
      {err && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {err}
        </p>
      )}
      {msg && (
        <p role="status" className="mt-3 text-sm text-success">
          {msg}
        </p>
      )}
    </AuthCard>
  );
}
