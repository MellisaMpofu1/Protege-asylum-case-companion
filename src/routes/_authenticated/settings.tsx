import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Empty, Loading, PageHeader, Pill, Section } from "@/components/protege/ui";
import { LOCALES, POLICY_VERSION, useI18n } from "@/lib/i18n";
import { ConsentSettings } from "@/components/protege/Legal";
import { useAppCtx } from "@/lib/session";
import { pageHead, q, useRpc } from "@/lib/mutate";
import type { Locale } from "@/lib/dates";

export const Route = createFileRoute("/_authenticated/settings")({
  head: pageHead("Settings"),
  component: Settings,
});

function Settings() {
  const { t, setLocale, fInstant } = useI18n();
  const ctx = useAppCtx();
  const p = ctx.data?.profile;
  const [name, setName] = useState("");
  const [ui, setUi] = useState<Locale>("en");
  const [pref, setPref] = useState("");
  const [assist, setAssist] = useState(false);
  const [email, setEmail] = useState(false);
  useEffect(() => {
    if (!p) return;
    setName(p.display_name ?? "");
    setUi(p.ui_locale);
    setPref(p.preferred_language ?? "");
    setAssist(p.needs_language_assistance);
    setEmail(p.email_notifications);
    setLocale(p.ui_locale);
  }, [p, setLocale]);
  const save = useRpc("update_my_profile");
  const ack = useRpc("acknowledge_policy");
  if (ctx.isLoading) return <Loading />;
  const isApplicant = !!ctx.data?.case;
  return (
    <div className="space-y-5">
      <PageHeader title={t("set_title")} />
      <Section>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate(
              {
                _display_name: name,
                _ui_locale: ui,
                _preferred_language: pref,
                _needs_assistance: assist,
                _email_notifications: email,
              },
              { onSuccess: () => setLocale(ui) },
            );
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="n">{t("set_name")}</Label>
            <Input id="n" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ui">{t("set_ui_lang")}</Label>
            <select
              id="ui"
              className="w-full rounded-md border bg-card p-2 text-sm"
              value={ui}
              onChange={(e) => setUi(e.target.value as Locale)}
            >
              {LOCALES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pl">{t("set_pref_lang")}</Label>
            <Input
              id="pl"
              value={pref}
              onChange={(e) => setPref(e.target.value)}
              placeholder="e.g. Dari, Tigrinya, Arabic"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={assist} onCheckedChange={(v) => setAssist(v === true)} />
            {t("set_assist")}
          </label>
          <label className="flex items-start gap-2 text-sm">
            <Checkbox checked={email} onCheckedChange={(v) => setEmail(v === true)} />
            <span>
              {t("set_email")}
              <br />
              <span className="text-xs text-muted-foreground">{t("set_email_note")}</span>
            </span>
          </label>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? t("saving") : t("save")}
          </Button>
        </form>
      </Section>
      <Section title={t("set_privacy")}>
        {p?.policy_version === POLICY_VERSION ? (
          <Pill variant="success">
            {t("set_policy")} · {POLICY_VERSION}
          </Pill>
        ) : (
          <div className="space-y-2">
            <p className="text-sm">{t("policy_text")}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => ack.mutate({ _version: POLICY_VERSION })}
            >
              {t("policy_ack", { v: POLICY_VERSION })}
            </Button>
          </div>
        )}
        <div className="mt-5 border-t pt-4">
          <ConsentSettings />
        </div>
        {isApplicant && <DataRequests fInstant={fInstant} />}
      </Section>
    </div>
  );
}

function DataRequests({ fInstant }: { fInstant: (v: string) => string | null }) {
  const { t } = useI18n();
  const list = useQuery({
    queryKey: ["dr"],
    queryFn: () =>
      q(supabase.from("data_requests").select("*").order("created_at", { ascending: false })),
  });
  const [notes, setNotes] = useState("");
  const m = useRpc("create_data_request", [["dr"]]);
  return (
    <div className="mt-5 space-y-3 border-t pt-4">
      <Label htmlFor="drn">{t("optional")}</Label>
      <Textarea id="drn" value={notes} onChange={(e) => setNotes(e.target.value)} />
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={m.isPending}
          onClick={() => m.mutate({ _kind: "export", _notes: notes })}
        >
          {t("set_export")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={m.isPending}
          onClick={() => m.mutate({ _kind: "deletion", _notes: notes })}
        >
          {t("set_delete")}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{t("set_delete_note")}</p>
      <p className="text-sm font-semibold">{t("set_requests")}</p>
      {(list.data ?? []).length === 0 ? (
        <Empty>{t("none_yet")}</Empty>
      ) : (
        <ul className="text-sm">
          {list.data!.map((r) => (
            <li key={r.id}>
              {r.kind} · {r.status} · {fInstant(r.created_at)}
              {r.review_notes && ` — ${r.review_notes}`}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
