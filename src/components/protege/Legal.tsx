import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CONSENT_TEXT, PRIVACY, TERMS } from "@/lib/legal";
import { LOCALES, useI18n } from "@/lib/i18n";
import { Wordmark } from "./ui";

export function LegalDoc({ kind }: { kind: "terms" | "privacy" }) {
  const { locale, setLocale } = useI18n();
  const d = (kind === "terms" ? TERMS : PRIVACY)[locale];
  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <Link to="/auth" aria-label="Protege — sign in">
          <Wordmark />
        </Link>
        <select
          aria-label="Language / Idioma"
          className="rounded-md border bg-card p-2 text-sm"
          value={locale}
          onChange={(e) => setLocale(e.target.value as typeof locale)}
        >
          {LOCALES.map((l) => (
            <option key={l.code} value={l.code}>{l.label}</option>
          ))}
        </select>
      </div>
      <h1 className="text-2xl font-semibold">{d.title}</h1>
      <p role="note" className="mt-3 rounded-md border border-pink/40 bg-accent p-3 text-sm">{d.draft}</p>
      {d.sections.map((s) => (
        <section key={s.h} className="mt-5">
          <h2 className="font-semibold">{s.h}</h2>
          <p className="mt-1 text-sm leading-relaxed">{s.p}</p>
        </section>
      ))}
    </main>
  );
}

export function LegalLinks() {
  const { locale } = useI18n();
  const c = CONSENT_TEXT[locale];
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
      <Link to="/terms" target="_blank" className="text-violet underline underline-offset-4">{c.read_terms}</Link>
      <Link to="/privacy" target="_blank" className="text-violet underline underline-offset-4">{c.read_privacy}</Link>
    </div>
  );
}

export function Onboarding() {
  const { locale } = useI18n();
  const c = CONSENT_TEXT[locale];
  const qc = useQueryClient();
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!terms || !privacy) return setErr(c.must);
    setBusy(true);
    const { error } = await supabase.rpc("record_consents", {
      _choices: { terms: true, privacy_notice: true, usage_analytics: analytics },
    });
    setBusy(false);
    if (error) return setErr(error.message);
    await qc.invalidateQueries({ queryKey: ["ctx"] });
  }
  return (
    <form onSubmit={submit} className="mx-auto max-w-xl space-y-5 rounded-xl border bg-card p-6" aria-labelledby="ob-h">
      <h1 id="ob-h" className="text-xl font-semibold">{c.heading}</h1>
      <p className="text-sm">{c.intro}</p>
      <LegalLinks />
      <label className="flex items-start gap-3 text-sm">
        <Checkbox checked={terms} onCheckedChange={(v) => setTerms(v === true)} aria-required="true" className="mt-0.5" />
        <span>{c.terms}</span>
      </label>
      <label className="flex items-start gap-3 text-sm">
        <Checkbox checked={privacy} onCheckedChange={(v) => setPrivacy(v === true)} aria-required="true" className="mt-0.5" />
        <span>{c.privacy}</span>
      </label>
      <fieldset className="rounded-lg border p-4">
        <legend className="px-1 text-sm font-semibold">{c.optional}</legend>
        <label className="flex items-start gap-3 text-sm">
          <Checkbox checked={analytics} onCheckedChange={(v) => setAnalytics(v === true)} className="mt-0.5" />
          <span>
            {c.analytics}
            <br />
            <span className="text-xs text-muted-foreground">{c.analytics_help}</span>
          </span>
        </label>
      </fieldset>
      {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
      <Button type="submit" disabled={busy}>{c.continue}</Button>
    </form>
  );
}

export function ConsentSettings() {
  const { locale, fInstant } = useI18n();
  const c = CONSENT_TEXT[locale];
  const qc = useQueryClient();
  const hist = useQuery({
    queryKey: ["consents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consent_records")
        .select("id,purpose,version,choice,recorded_at")
        .order("recorded_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const ctx = qc.getQueryData<{ consents?: Record<string, boolean> }>(["ctx"]);
  const on = !!ctx?.consents?.["usage_analytics"];
  const [busy, setBusy] = useState(false);
  async function toggle(v: boolean) {
    setBusy(true);
    await supabase.rpc("record_consents", { _choices: { usage_analytics: v } });
    await Promise.all([qc.invalidateQueries({ queryKey: ["ctx"] }), qc.invalidateQueries({ queryKey: ["consents"] })]);
    setBusy(false);
  }
  const label = (p: string) => (p === "terms" ? TERMS[locale].title : p === "privacy_notice" ? PRIVACY[locale].title : c.analytics);
  return (
    <div className="space-y-4">
      <LegalLinks />
      <label className="flex items-start gap-3 text-sm">
        <Checkbox checked={on} disabled={busy} onCheckedChange={(v) => toggle(v === true)} className="mt-0.5" />
        <span>
          {c.analytics}
          <br />
          <span className="text-xs text-muted-foreground">{c.analytics_help}</span>
        </span>
      </label>
      <div>
        <p className="text-sm font-semibold">{c.history}</p>
        <ul className="mt-1 space-y-0.5 text-sm">
          {(hist.data ?? []).map((r) => (
            <li key={r.id}>
              {fInstant(r.recorded_at)} · {label(r.purpose)} · {r.purpose === "usage_analytics" ? (r.choice ? c.on : c.off) : c.accepted} · {r.version}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
