import { homeFor, type AppCtx } from "@/lib/session";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wordmark } from "@/components/protege/ui";
import { useI18n } from "@/lib/i18n";
import { LegalLinks } from "@/components/protege/Legal";
import { logEvent } from "@/lib/session";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Protege" },
      {
        name: "description",
        content: "Sign in to Protege, your asylum case companion in Portugal.",
      },
      { property: "og:title", content: "Sign in — Protege" },
      { property: "og:description", content: "Sign in to Protege." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

export function AuthCard({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-8">
      <div className="protege-content w-full max-w-md rounded-lg border bg-card p-5 sm:p-6">
        <Link to="/">
          <Wordmark className="w-full" />
        </Link>
        <h1 className="mb-5 mt-4 text-xl font-semibold">{title}</h1>
        {children}
      </div>
    </div>
  );
}

function AuthPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "forgot" | "link">("link");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    setBusy(true);
    try {
      if (mode === "in") {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        logEvent("login");
        const { data: ctx } = await supabase.rpc("my_context");
        void data;
        navigate({ to: homeFor(ctx as unknown as AppCtx) });
      } else if (mode === "link") {
        const { error } = await supabase.auth.signInWithOtp({
          email: email.trim(),
          options: { shouldCreateUser: false, emailRedirectTo: `${window.location.origin}/auth/callback` },
        });
        if (error && /rate|security purposes/i.test(error.message)) throw new Error("rate");
        // Same confirmation whether or not an account exists.
        setMsg(t("link_sent"));
      } else {
        await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        setMsg(t("reset_sent"));
      }
    } catch (e) {
      const m = (e as Error).message;
      setErr(
        /Invalid login/i.test(m)
          ? "Email or password is not correct."
          : m === "rate"
            ? t("link_rate_limited")
            : /fetch/i.test(m)
            ? t("error_network")
            : t("error_generic"),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthCard title={mode === "forgot" ? t("forgot") : t("auth_title")}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="email">{t("email")}</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        {mode === "link" && <p className="text-sm text-muted-foreground">{t("link_intro")}</p>}
        {mode === "in" && (
          <div className="space-y-1.5">
            <Label htmlFor="pw">{t("password")}</Label>
            <Input
              id="pw"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        )}
        {err && (
          <p role="alert" className="text-sm text-destructive">
            {err}
          </p>
        )}
        {msg && (
          <p role="status" className="text-sm text-success">
            {msg}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={busy || !email}>
          {busy ? t("loading") : mode === "in" ? t("sign_in") : mode === "link" ? t("email_me_link") : t("send_reset")}
        </Button>
      </form>
      <div className="mt-4 flex flex-col items-start">
        {mode !== "link" && (
          <Button variant="link" className="px-0" onClick={() => { setMode("link"); setMsg(null); setErr(null); }}>
            {t("use_link_instead")}
          </Button>
        )}
        {mode !== "in" && (
          <Button variant="link" className="px-0" onClick={() => { setMode("in"); setMsg(null); setErr(null); }}>
            {t("use_password")}
          </Button>
        )}
        {mode === "in" && (
          <Button variant="link" className="px-0" onClick={() => setMode("forgot")}>
            {t("forgot")}
          </Button>
        )}
      </div>
      <div className="mt-2"><Button asChild variant="link" className="px-0"><Link to="/access">{t("account_access")}</Link></Button></div>
      <p className="mt-6 text-xs text-muted-foreground">
        {t("invite_only")} {t("have_invite")}
      </p>
      <div className="mt-4"><LegalLinks /></div>
    </AuthCard>
  );
}
