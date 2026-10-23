import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  ActionStatusBadge,
  Empty,
  ErrorState,
  FieldRow,
  Loading,
  PageHeader,
  Pill,
  ReviewBadge,
  Section,
  SourceBadge,
} from "@/components/protege/ui";
import { ApplicantStatusBar } from "@/components/protege/ApplicationStatus";
import { WithMyCase } from "@/components/protege/useMyCase";
import { useI18n, type TKey } from "@/lib/i18n";
import { isOverdue, todayInLisbon } from "@/lib/dates";
import { logEvent } from "@/lib/session";
import { pageHead, q, useRpc } from "@/lib/mutate";

export const Route = createFileRoute("/_authenticated/_applicant/case")({
  head: pageHead("My Case"),
  component: () => <WithMyCase>{(id) => <CasePage caseId={id} />}</WithMyCase>,
});

export function useCaseRecords(caseId: string) {
  return useQuery({
    queryKey: ["case", caseId],
    queryFn: async () => {
      const [tl, revs, acts, evs, docs] = await Promise.all([
        q(
          supabase
            .from("timeline_entries")
            .select("*")
            .eq("case_id", caseId)
            .order("recorded_at", { ascending: false }),
        ),
        q(supabase.from("timeline_revisions").select("*").eq("case_id", caseId).order("version")),
        q(
          supabase
            .from("actions")
            .select("*")
            .eq("case_id", caseId)
            .order("created_at", { ascending: false }),
        ),
        q(supabase.from("action_events").select("*").eq("case_id", caseId).order("at")),
        q(supabase.from("documents").select("id, safe_name").eq("case_id", caseId)),
      ]);
      return { tl, revs, acts, evs, docs };
    },
  });
}

function CasePage({ caseId }: { caseId: string }) {
  const { t, fInstant } = useI18n();
  const data = useCaseRecords(caseId);
  useEffect(() => logEvent("timeline_viewed"), []);
  if (data.isLoading) return <Loading />;
  if (data.error) return <ErrorState error={data.error} onRetry={() => data.refetch()} />;
  const { tl, revs, acts, evs, docs } = data.data!;
  const docName = (id: string | null) => docs.find((d) => d.id === id)?.safe_name;
  return (
    <div className="space-y-5">
      <PageHeader title={t("case_title")}>
        <AddUpdate caseId={caseId} docs={docs} />
      </PageHeader>
      <ApplicantStatusBar caseId={caseId} />

      <Section title={t("actions_title")}>
        {acts.length === 0 ? (
          <Empty>{t("home_no_action")}</Empty>
        ) : (
          <ul className="space-y-4">
            {acts.map((a) => (
              <ActionCard
                key={a.id}
                a={a}
                events={evs.filter((e) => e.action_id === a.id)}
                docs={docs}
                docName={docName(a.document_id)}
              />
            ))}
          </ul>
        )}
      </Section>

      <Section title="Timeline">
        {tl.length === 0 ? (
          <Empty>{t("home_no_update")}</Empty>
        ) : (
          <ol className="space-y-4">
            {tl.map((e) => {
              const history = revs.filter((r) => r.entry_id === e.id);
              return (
                <li key={e.id} className="rounded-lg border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="font-semibold">{e.title}</p>
                    <div className="flex flex-wrap gap-1">
                      <SourceBadge source={e.source} />
                      <ReviewBadge state={e.review_state} />
                      {e.correction_requested && (
                        <Pill variant="warning">{t("case_correction_requested")}</Pill>
                      )}
                    </div>
                  </div>
                  {e.body && <p className="mt-1 text-sm">{e.body}</p>}
                  {e.linked_document_id && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {docName(e.linked_document_id)} — {t("linked_doc_note")}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-muted-foreground">
                    {t("recorded")}: {fInstant(e.recorded_at)}
                    {e.reviewed_at && ` · ${t("rs_reviewed")}: ${fInstant(e.reviewed_at)}`}
                  </p>
                  {history.length > 0 && (
                    <details className="mt-2 text-xs">
                      <summary className="cursor-pointer text-violet">
                        {t("case_history")} ({history.length})
                      </summary>
                      <ul className="mt-2 space-y-1">
                        {history.map((h) => (
                          <li key={h.id}>
                            v{h.version}: “{h.title}” — {t(`src_${h.source}` as TKey)} ·{" "}
                            {fInstant(h.changed_at)}
                            {h.reason && ` · ${h.reason}`}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                  {!e.correction_requested && <RequestCorrection entryId={e.id} caseId={caseId} />}
                </li>
              );
            })}
          </ol>
        )}
      </Section>
    </div>
  );
}

function AddUpdate({
  caseId,
  docs,
}: {
  caseId: string;
  docs: { id: string; safe_name: string }[];
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [doc, setDoc] = useState("");
  const m = useRpc("add_timeline_entry", [
    ["case", caseId],
    ["home", caseId],
  ]);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>{t("case_add_update")}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("case_add_update")}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            m.mutate(
              { _case: caseId, _title: title, _body: body, _doc: doc || null },
              {
                onSuccess: () => {
                  setOpen(false);
                  setTitle("");
                  setBody("");
                },
              },
            );
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="t">{t("entry_title")}</Label>
            <Input id="t" required value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="b">{t("entry_body")}</Label>
            <Textarea id="b" value={body} onChange={(e) => setBody(e.target.value)} />
          </div>
          {docs.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="d">{t("attach_optional")}</Label>
              <select
                id="d"
                className="w-full rounded-md border bg-card p-2 text-sm"
                value={doc}
                onChange={(e) => setDoc(e.target.value)}
              >
                <option value="">—</option>
                {docs.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.safe_name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            {t("rs_unreviewed")} — {t("src_applicant_reported")}
          </p>
          <Button type="submit" disabled={m.isPending || !title.trim()}>
            {m.isPending ? t("saving") : t("save")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RequestCorrection({ entryId, caseId }: { entryId: string; caseId: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const m = useRpc("request_correction", [["case", caseId]]);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="link" size="sm" className="mt-1 h-auto p-0">
          {t("case_request_correction")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("case_request_correction")}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            m.mutate({ _entry: entryId, _note: note }, { onSuccess: () => setOpen(false) });
          }}
        >
          <Label htmlFor="n">{t("correction_note")}</Label>
          <Textarea id="n" required value={note} onChange={(e) => setNote(e.target.value)} />
          <Button type="submit" disabled={m.isPending || !note.trim()}>
            {t("submit")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type Action = {
  id: string;
  case_id: string;
  title: string;
  instruction: string | null;
  owner: string;
  source: string;
  due_date: string | null;
  due_confirmed: boolean;
  status: string;
  completed_on: string | null;
  outcome: string | null;
  cancel_reason: string | null;
  version: number;
  document_id: string | null;
  requests_document: boolean;
};

function ActionCard({
  a,
  events,
  docs,
  docName,
}: {
  a: Action;
  events: { id: string; kind: string; note: string | null; at: string }[];
  docs: { id: string; safe_name: string }[];
  docName?: string | undefined;
}) {
  const { t, fDate, fInstant } = useI18n();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(todayInLisbon());
  const [outcome, setOutcome] = useState("");
  const [doc, setDoc] = useState("");
  const m = useRpc("report_action_complete", [
    ["case", a.case_id],
    ["home", a.case_id],
  ]);
  return (
    <li id={`action-${a.id}`} className="scroll-mt-6 rounded-lg border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="font-semibold">{a.title}</p>
        <ActionStatusBadge status={a.status} overdue={isOverdue(a)} />
      </div>
      {a.instruction && <p className="mt-1 text-sm">{a.instruction}</p>}
      <dl className="mt-3 space-y-1">
        <FieldRow label={t("owner")}>{t(`owner_${a.owner}` as TKey)}</FieldRow>
        <FieldRow label={t("due")}>
          {a.due_confirmed && a.due_date ? fDate(a.due_date) : t("date_not_confirmed")}
        </FieldRow>
        <FieldRow label={t("source")}>
          <SourceBadge source={a.source} />
        </FieldRow>
        {docName && <FieldRow label={t("relevant_doc")}>{docName}</FieldRow>}
        {a.requests_document && <FieldRow label={t("docs_title")}>{t("docs_requested")}</FieldRow>}
        {a.completed_on && <FieldRow label={t("completed_on")}>{fDate(a.completed_on)}</FieldRow>}
        {a.status !== "pending" && a.status !== "cancelled" && (
          <FieldRow label={t("outcome")}>{a.outcome ?? t("outcome_unknown")}</FieldRow>
        )}
        {a.cancel_reason && <FieldRow label={t("cancel_reason")}>{a.cancel_reason}</FieldRow>}
      </dl>
      <div className="mt-3 flex flex-wrap gap-2">
        {a.status === "pending" && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">{t("action_report")}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("action_report")}</DialogTitle>
              </DialogHeader>
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  m.mutate(
                    {
                      _action: a.id,
                      _expected_version: a.version,
                      _completed_on: date,
                      _outcome: outcome,
                      _doc: doc || null,
                    },
                    {
                      onSuccess: () => {
                        setOpen(false);
                        logEvent("action_reported", a.id);
                      },
                    },
                  );
                }}
              >
                <div className="space-y-1.5">
                  <Label htmlFor="cd">{t("completed_on")}</Label>
                  <Input
                    id="cd"
                    type="date"
                    required
                    value={date}
                    max={todayInLisbon()}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="oc">{t("outcome")}</Label>
                  <Textarea id="oc" value={outcome} onChange={(e) => setOutcome(e.target.value)} />
                </div>
                {docs.length > 0 && (
                  <div className="space-y-1.5">
                    <Label htmlFor="ad">{t("attach_optional")}</Label>
                    <select
                      id="ad"
                      className="w-full rounded-md border bg-card p-2 text-sm"
                      value={doc}
                      onChange={(e) => setDoc(e.target.value)}
                    >
                      <option value="">—</option>
                      {docs.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.safe_name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <Button type="submit" disabled={m.isPending || !date}>
                  {m.isPending ? t("saving") : t("submit")}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
        <a href="/support" className="inline-flex items-center rounded-md border px-3 text-sm">
          {t("ask_help")}
        </a>
      </div>
      {events.length > 0 && (
        <details className="mt-3 text-xs">
          <summary className="cursor-pointer text-violet">{t("history")}</summary>
          <ul className="mt-2 space-y-1">
            {events.map((e) => (
              <li key={e.id}>
                {fInstant(e.at)} — {e.kind}
                {e.note ? `: ${e.note}` : ""}
              </li>
            ))}
          </ul>
        </details>
      )}
    </li>
  );
}
