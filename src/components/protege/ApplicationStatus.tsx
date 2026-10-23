import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, FileCheck2, HelpCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Empty, ErrorState, FieldRow, Loading, Pill, ReviewBadge, SourceBadge } from "./ui";
import { useI18n, type TKey } from "@/lib/i18n";
import { q, useRpc } from "@/lib/mutate";
import { cn } from "@/lib/utils";

export type AppStatus = "applied" | "pending" | "action_required" | "approved";
export const APP_STATUSES: AppStatus[] = ["applied", "pending", "action_required", "approved"];

const STYLE: Record<AppStatus | "none", { cls: string; Icon: typeof Clock }> = {
  applied: { cls: "border-applied bg-applied/10 text-applied", Icon: FileCheck2 },
  pending: { cls: "border-warning bg-warning/10 text-warning", Icon: Clock },
  action_required: { cls: "border-destructive bg-destructive/10 text-destructive", Icon: AlertTriangle },
  approved: { cls: "border-success bg-success/10 text-success", Icon: CheckCircle2 },
  none: { cls: "border-neutral-status/40 bg-muted text-neutral-status", Icon: HelpCircle },
};

/** Status label with icon, text and colour (never colour alone). */
export function StatusPill({ status, size = "sm" }: { status: string | null | undefined; size?: "sm" | "lg" }) {
  const { t } = useI18n();
  const key = (status && status in STYLE ? status : "none") as AppStatus | "none";
  const { cls, Icon } = STYLE[key];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-semibold",
        size === "lg" ? "px-4 py-1.5 text-base" : "px-2.5 py-0.5 text-xs",
        cls,
      )}
    >
      <Icon className={size === "lg" ? "size-5" : "size-3.5"} aria-hidden />
      {t(`as_${key}` as TKey)}
    </span>
  );
}

export type StatusRow = {
  id: string;
  status: string;
  previous_status: string | null;
  explanation: string;
  source: string;
  decision_ref: string | null;
  is_demo: boolean;
  recorded_at: string;
  correction_requested: boolean;
  correction_note: string | null;
};

export function useStatusHistory(caseId: string) {
  return useQuery({
    queryKey: ["appstatus", caseId],
    queryFn: () =>
      q(
        supabase
          .from("case_status_history")
          .select("*")
          .eq("case_id", caseId)
          .order("recorded_at", { ascending: false }),
      ) as Promise<StatusRow[]>,
  });
}

export function StatusHistory({ rows }: { rows: StatusRow[] }) {
  const { t, fInstant } = useI18n();
  if (!rows.length) return <Empty>{t("as_none")}</Empty>;
  const chrono = [...rows].reverse();
  const currentId = rows[0]!.id;
  return (
    <ol className="space-y-3 border-l-2 border-lavender pl-4">
      {chrono.map((r) => {
        const cur = r.id === currentId;
        return (
          <li key={r.id} className={cn("relative rounded-lg p-3", cur ? "border border-violet bg-lavender/50" : "")}>
            <span
              aria-hidden
              className={cn("absolute -left-[23px] top-4 size-3 rounded-full border-2 border-card", cur ? "bg-violet" : "bg-border")}
            />
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill status={r.status} />
              {cur && <Pill variant="info">{t("as_current")}</Pill>}
              {r.is_demo && r.status === "approved" && <Pill variant="warning">{t("as_demo")}</Pill>}
              {r.correction_requested && <Pill variant="warning">{t("as_correction_pending")}</Pill>}
            </div>
            <p className="mt-1 text-sm">{r.explanation}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {fInstant(r.recorded_at)} · {t(`src_${r.source}` as TKey)}
              {r.decision_ref ? ` · ${t("as_decision_ref")}: ${r.decision_ref}` : ""}
            </p>
            {r.correction_note && (
              <p className="mt-1 text-xs text-warning">“{r.correction_note}”</p>
            )}
          </li>
        );
      })}
    </ol>
  );
}

type Act = {
  id: string;
  title: string;
  owner: string;
  status: string;
  due_date: string | null;
  due_confirmed: boolean;
};

/** Applicant status bar: current status, explanation, source, last update, next action and history. */
export function ApplicantStatusBar({ caseId, compact }: { caseId: string; compact?: boolean }) {
  const { t, fDate, fInstant } = useI18n();
  const hist = useStatusHistory(caseId);
  const acts = useQuery({
    queryKey: ["case", caseId, "status-acts"],
    queryFn: () =>
      q(
        supabase
          .from("actions")
          .select("id, title, owner, status, due_date, due_confirmed")
          .eq("case_id", caseId)
          .eq("status", "pending"),
      ) as Promise<Act[]>,
  });
  if (hist.isLoading || acts.isLoading) return <Loading />;
  if (hist.error) return <ErrorState error={hist.error} onRetry={() => hist.refetch()} />;
  const rows = hist.data ?? [];
  const cur = rows[0];
  const key = (cur?.status ?? "none") as AppStatus | "none";
  const pending = [...(acts.data ?? [])].sort((a, b) =>
    (a.due_confirmed && a.due_date ? a.due_date : "9999").localeCompare(
      b.due_confirmed && b.due_date ? b.due_date : "9999",
    ),
  );
  const next = pending[0];
  const mine = pending.filter((a) => a.owner === "applicant");
  return (
    <section
      aria-label={t("as_title")}
      className="rounded-xl border-2 border-violet/30 bg-card p-4 shadow-sm md:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-violet">{t("as_title")}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusPill status={cur?.status} size="lg" />
            {cur?.is_demo && cur.status === "approved" && <Pill variant="warning">{t("as_demo")}</Pill>}
          </div>
        </div>
        {cur && !cur.correction_requested && <CorrectionDialog entryId={cur.id} caseId={caseId} />}
        {cur?.correction_requested && <Pill variant="warning">{t("as_correction_pending")}</Pill>}
      </div>
      <p className="mt-3 text-sm">{t(`as_desc_${key}` as TKey)}</p>

      {mine.length > 0 && (
        <div role="alert" className="mt-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
          <p className="flex items-center gap-2 font-semibold text-destructive">
            <AlertTriangle className="size-4" aria-hidden /> {t("as_alert")}
          </p>
          <ul className="mt-1 space-y-1">
            {mine.slice(0, 3).map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-2">
                <span>{a.title}</span>
                <Link to="/case" hash={`action-${a.id}`} className="text-violet underline">
                  {t("as_view_task")}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <dl className="mt-4 space-y-1 border-t pt-3">
        {cur && (
          <>
            <FieldRow label={t("as_explanation")}>{cur.explanation}</FieldRow>
            <FieldRow label={t("as_source")}>
              <span className="inline-flex flex-wrap gap-1">
                <SourceBadge source={cur.source} />
                <ReviewBadge state="reviewed" />
              </span>
            </FieldRow>
            <FieldRow label={t("as_updated")}>{fInstant(cur.recorded_at)}</FieldRow>
          </>
        )}
        <FieldRow label={t("as_next")}>{next ? next.title : t("as_no_newer")}</FieldRow>
        {next && (
          <FieldRow label={t("as_due")}>
            {next.due_confirmed && next.due_date ? fDate(next.due_date) : t("date_not_confirmed")}
          </FieldRow>
        )}
      </dl>
      <p className="mt-3 text-xs text-muted-foreground">{t("as_not_official")}</p>

      {!compact && (
        <div className="mt-4 border-t pt-4">
          <h3 className="mb-3 font-semibold">{t("as_history")}</h3>
          <StatusHistory rows={rows} />
          {rows.length > 0 && <p className="mt-3 text-xs text-muted-foreground">{t("as_no_newer")}</p>}
        </div>
      )}
    </section>
  );
}

function CorrectionDialog({ entryId, caseId }: { entryId: string; caseId: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const m = useRpc("request_status_correction", [["appstatus", caseId]]);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">{t("as_correction")}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("as_correction")}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            m.mutate({ _entry: entryId, _note: note }, { onSuccess: () => setOpen(false) });
          }}
        >
          <Label htmlFor="asc">{t("as_correction_note")}</Label>
          <Textarea id="asc" required value={note} onChange={(e) => setNote(e.target.value)} />
          <Button type="submit" disabled={m.isPending || !note.trim()}>
            {t("as_correction_send")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
