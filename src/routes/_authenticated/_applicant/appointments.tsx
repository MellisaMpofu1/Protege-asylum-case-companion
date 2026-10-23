import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Empty,
  ErrorState,
  FieldRow,
  Loading,
  PageHeader,
  Pill,
  Section,
} from "@/components/protege/ui";
import { DemoPastAppointments } from "@/components/protege/DemoHistory";
import { WithMyCase } from "@/components/protege/useMyCase";
import { useI18n } from "@/lib/i18n";
import { logEvent } from "@/lib/session";
import { pageHead, q, useRpc } from "@/lib/mutate";

export const Route = createFileRoute("/_authenticated/_applicant/appointments")({
  head: pageHead("Appointments"),
  component: () => <WithMyCase>{(id) => <Appointments caseId={id} />}</WithMyCase>,
});

type Item = { label: string; done: boolean };

function Appointments({ caseId }: { caseId: string }) {
  const { t, fInstant } = useI18n();
  useEffect(() => logEvent("appointment_viewed"), []);
  const data = useQuery({
    queryKey: ["appts", caseId],
    queryFn: async () => {
      const [appts, docs, resp] = await Promise.all([
        q(
          supabase
            .from("appointments")
            .select("*")
            .eq("case_id", caseId)
            .order("starts_at", { ascending: false, nullsFirst: true }),
        ),
        q(supabase.from("documents").select("id, safe_name").eq("case_id", caseId)),
        q(supabase.from("appointment_responses").select("*").eq("case_id", caseId).order("created_at")),
      ]);
      return { appts, docs, resp };
    },
  });
  const toggle = useRpc("toggle_appointment_item", [["appts", caseId]]);
  const ack = useRpc("respond_appointment", [["appts", caseId], ["home", caseId]]);
  useEffect(() => {
    if (!data.data || typeof window === "undefined" || !window.location.hash) return;
    document.getElementById(window.location.hash.slice(1))?.scrollIntoView({ block: "start" });
  }, [data.data]);
  if (data.isLoading) return <Loading />;
  if (data.error) return <ErrorState error={data.error} onRetry={() => data.refetch()} />;
  const { appts, docs, resp } = data.data!;
  return (
    <div className="space-y-5">
      <PageHeader title={t("appt_title")} />
      <p className="text-sm text-muted-foreground">{t("appt_note")} {t("appt_recorded_note")}</p>
      <p className="text-xs text-muted-foreground">{t("appt_timezone")}</p>
      {appts.length === 0 ? (
        <Empty>{t("home_no_appt")}</Empty>
      ) : (
        appts.map((a) => {
          const list = (a.checklist as Item[]) ?? [];
          return (
            <div key={a.id} id={`appt-${a.id}`} className="scroll-mt-24">
            <Section
              title={a.title}
              action={
                a.status === "cancelled" ? (
                  <Pill variant="neutral">{t("appt_cancelled")}</Pill>
                ) : a.confirmed ? (
                  <Pill variant="success">{t("appt_confirmed")}</Pill>
                ) : (
                  <Pill variant="warning">{t("appt_unconfirmed")}</Pill>
                )
              }
            >
              <dl className="space-y-1">
                <FieldRow label={t("due")}>
                  {a.starts_at ? fInstant(a.starts_at) : t("date_not_confirmed")}
                </FieldRow>
                {a.location && <FieldRow label={t("appt_location")}>{a.location}</FieldRow>}
                {a.remote_link && (
                  <FieldRow label={t("appt_remote")}>
                    <a
                      className="break-all text-violet underline"
                      href={a.remote_link}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {a.remote_link}
                    </a>
                  </FieldRow>
                )}
                {a.document_ids.length > 0 && (
                  <FieldRow label={t("relevant_doc")}>
                    {a.document_ids
                      .map((id) => docs.find((d) => d.id === id)?.safe_name)
                      .filter(Boolean)
                      .join(", ")}
                  </FieldRow>
                )}
              </dl>
              {list.length > 0 && (
                <div className="mt-4">
                  <p className="mb-2 text-sm font-semibold">{t("appt_checklist")}</p>
                  <ul className="space-y-2">
                    {list.map((it, i) => (
                      <li key={i}>
                        <label className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={it.done}
                            onCheckedChange={(v) =>
                              toggle.mutate({ _appt: a.id, _idx: i, _done: v === true })
                            }
                          />
                          {it.label}
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {a.recap && (
                <div className="mt-4 rounded-lg bg-muted p-3">
                  <p className="text-sm font-semibold">{t("appt_recap")}</p>
                  <p className="whitespace-pre-wrap text-sm">{a.recap}</p>
                  {a.recap_reviewed_at && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("rs_reviewed")}: {fInstant(a.recap_reviewed_at)}
                    </p>
                  )}
                </div>
              )}
              {a.status === "cancelled" ? (
                a.cancel_reason && <p className="mt-4 text-sm text-muted-foreground">{a.cancel_reason}</p>
              ) : (
                <div className="mt-4 flex flex-wrap items-start gap-2">
                  {a.acknowledged_at ? (
                    <Pill variant="success">{t("appt_acknowledged")} · {fInstant(a.acknowledged_at)}</Pill>
                  ) : (
                    <Button size="sm" disabled={ack.isPending} onClick={() => ack.mutate({ _appt: a.id, _kind: "acknowledged", _note: null })}>
                      {t("appt_ack")}
                    </Button>
                  )}
                  {a.change_request ? (
                    <p className="w-full text-sm text-warning">{t("appt_change_pending")}: {a.change_request}</p>
                  ) : (
                    <ReportChange apptId={a.id} caseId={caseId} />
                  )}
                </div>
              )}
              {resp.filter((r) => r.appointment_id === a.id).length > 0 && (
                <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                  {resp.filter((r) => r.appointment_id === a.id).map((r) => (
                    <li key={r.id}>{fInstant(r.created_at)} · {r.kind === "acknowledged" ? t("appt_acknowledged") : `${t("appt_request_change")}: ${r.note ?? ""}`}</li>
                  ))}
                </ul>
              )}
            </Section>
            </div>
          );
        })
      )}
      <DemoPastAppointments />
    </div>
  );
}

function ReportChange({ apptId, caseId }: { apptId: string; caseId: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const m = useRpc("respond_appointment", [["appts", caseId]]);
  if (!open)
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        {t("appt_request_change")}
      </Button>
    );
  return (
    <form
      className="w-full space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        m.mutate({ _appt: apptId, _kind: "change_requested", _note: note }, { onSuccess: () => setOpen(false) });
      }}
    >
      <label htmlFor={`c-${apptId}`} className="text-sm font-medium">
        {t("appt_change_note")}
      </label>
      <Textarea id={`c-${apptId}`} value={note} onChange={(e) => setNote(e.target.value)} />
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={!note.trim() || m.isPending}>
          {t("submit")}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}
