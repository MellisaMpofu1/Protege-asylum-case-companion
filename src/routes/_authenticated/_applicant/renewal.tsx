import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Empty, ErrorState, FieldRow, Loading, PageHeader, Section } from "@/components/protege/ui";
import { WithMyCase } from "@/components/protege/useMyCase";
import { useI18n } from "@/lib/i18n";
import { logEvent } from "@/lib/session";
import { pageHead, q, qMaybe, useRpc } from "@/lib/mutate";

export const Route = createFileRoute("/_authenticated/_applicant/renewal")({
  head: pageHead("Renewal Preparation"),
  component: () => <WithMyCase>{(id) => <Renewal caseId={id} />}</WithMyCase>,
});

type Item = { label: string; done: boolean };

export function CorrespondenceLog({ caseId }: { caseId: string }) {
  const { t, fDate } = useI18n();
  const list = useQuery({
    queryKey: ["corr", caseId],
    queryFn: () =>
      q(
        supabase
          .from("correspondence")
          .select("*")
          .eq("case_id", caseId)
          .order("created_at", { ascending: false }),
      ),
  });
  const [kind, setKind] = useState("");
  const [summary, setSummary] = useState("");
  const [date, setDate] = useState("");
  const m = useRpc("record_correspondence", [["corr", caseId]]);
  return (
    <Section title={t("ren_corr_log")}>
      <form
        className="grid gap-3 sm:grid-cols-3"
        onSubmit={(e) => {
          e.preventDefault();
          m.mutate(
            { _case: caseId, _kind: kind, _summary: summary, _occurred: date || null },
            {
              onSuccess: () => {
                setKind("");
                setSummary("");
                setDate("");
              },
            },
          );
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="ck">{t("corr_kind")}</Label>
          <Input
            id="ck"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            placeholder="Letter, email, call"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cdt">{t("corr_date")}</Label>
          <Input id="cdt" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="space-y-1.5 sm:col-span-3">
          <Label htmlFor="cs">{t("corr_summary")}</Label>
          <Input id="cs" value={summary} onChange={(e) => setSummary(e.target.value)} />
        </div>
        <div>
          <Button
            type="submit"
            variant="outline"
            disabled={!kind.trim() || !summary.trim() || m.isPending}
          >
            {t("ren_record")}
          </Button>
        </div>
      </form>
      <ul className="mt-4 divide-y">
        {(list.data ?? []).map((c) => (
          <li key={c.id} className="py-2 text-sm">
            <span className="font-semibold">{c.kind}</span> ·{" "}
            {c.occurred_on ? fDate(c.occurred_on) : t("date_not_confirmed")} — {c.summary}
          </li>
        ))}
      </ul>
    </Section>
  );
}

function Renewal({ caseId }: { caseId: string }) {
  const { t, fDate } = useI18n();
  useEffect(() => logEvent("renewal_viewed"), []);
  const data = useQuery({
    queryKey: ["renewal", caseId],
    queryFn: () =>
      qMaybe(supabase.from("renewal_records").select("*").eq("case_id", caseId).maybeSingle()),
  });
  const toggle = useRpc("toggle_renewal_item", [["renewal", caseId]]);
  if (data.isLoading) return <Loading />;
  if (data.error) return <ErrorState error={data.error} onRetry={() => data.refetch()} />;
  const r = data.data;
  return (
    <div className="space-y-5">
      <PageHeader title={t("ren_title")} />
      <p role="note" className="rounded-lg border bg-lavender p-3 text-sm">
        {t("ren_disclaimer")}
      </p>
      {!r ? (
        <Empty>{t("ren_none")}</Empty>
      ) : (
        <Section title={t("ren_prepare")}>
          <dl className="space-y-1">
            <FieldRow label={t("ren_doc")}>{r.document_type}</FieldRow>
            <FieldRow label={t("ren_expiry")}>
              {r.expiry_date ? fDate(r.expiry_date) : t("date_not_confirmed")}
            </FieldRow>
            {!r.expiry_reviewed && (
              <FieldRow label={t("source")}>{t("ren_expiry_unreviewed")}</FieldRow>
            )}
          </dl>
          {r.instructions && (
            <div className="mt-4">
              <p className="text-sm font-semibold">{t("ren_instructions")}</p>
              <p className="whitespace-pre-wrap text-sm">{r.instructions}</p>
            </div>
          )}
          {(r.checklist as Item[]).length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-sm font-semibold">{t("ren_checklist")}</p>
              <ul className="space-y-2">
                {(r.checklist as Item[]).map((it, i) => (
                  <li key={i}>
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={it.done}
                        onCheckedChange={(v) =>
                          toggle.mutate({ _case: caseId, _idx: i, _done: v === true })
                        }
                      />
                      {it.label}
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Section>
      )}
      <CorrespondenceLog caseId={caseId} />
      <Link to="/support" className="inline-flex rounded-lg border px-4 py-2 text-sm font-semibold">
        {t("ask_help")}
      </Link>
    </div>
  );
}
