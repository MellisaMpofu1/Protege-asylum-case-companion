import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  ActionStatusBadge,
  Empty,
  ErrorState,
  FieldRow,
  Loading,
  PageHeader,
  ReviewBadge,
  Section,
  SourceBadge,
} from "@/components/protege/ui";
import { ApplicantStatusBar } from "@/components/protege/ApplicationStatus";
import { WithMyCase } from "@/components/protege/useMyCase";
import { useI18n, type TKey } from "@/lib/i18n";
import { isOverdue } from "@/lib/dates";
import { logEvent } from "@/lib/session";
import { pageHead, q, qMaybe } from "@/lib/mutate";

export const Route = createFileRoute("/_authenticated/_applicant/home")({
  head: pageHead("Home"),
  component: () => <WithMyCase>{(id, org) => <Home caseId={id} orgId={org} />}</WithMyCase>,
});

function Home({ caseId, orgId }: { caseId: string; orgId: string }) {
  const { t, fDate, fInstant } = useI18n();
  useEffect(() => logEvent("dashboard_viewed"), []);
  const data = useQuery({
    queryKey: ["home", caseId],
    queryFn: async () => {
      const [cs, tl, acts, appts, ren, contacts] = await Promise.all([
        qMaybe(
          supabase
            .from("cases")
            .select("stage, stage_source, stage_recorded_at, procedure_path")
            .eq("id", caseId)
            .single(),
        ),
        q(
          supabase
            .from("timeline_entries")
            .select("*")
            .eq("case_id", caseId)
            .order("recorded_at", { ascending: false })
            .limit(1),
        ),
        q(
          supabase
            .from("actions")
            .select("*, documents:document_id(id, safe_name)")
            .eq("case_id", caseId)
            .in("status", ["pending", "reported_complete"]),
        ),
        q(
          supabase
            .from("appointments")
            .select("*")
            .eq("case_id", caseId)
            .gte("starts_at", new Date().toISOString())
            .neq("status", "cancelled")
            .order("starts_at")
            .limit(1),
        ),
        q(supabase.from("renewal_records").select("*").eq("case_id", caseId).maybeSingle()),
        q(
          supabase
            .from("support_contacts")
            .select("*")
            .eq("org_id", orgId)
            .eq("verified", true)
            .limit(3),
        ),
      ]);
      return { cs, tl, acts, appts, ren, contacts };
    },
  });
  if (data.isLoading) return <Loading />;
  if (data.error) return <ErrorState error={data.error} onRetry={() => data.refetch()} />;
  const { cs, tl, acts, appts, ren, contacts } = data.data!;
  const latest = tl[0];
  const sorted = [...acts].sort((a, b) => {
    const ka = a.status === "pending" ? 0 : 1,
      kb = b.status === "pending" ? 0 : 1;
    if (ka !== kb) return ka - kb;
    const da = a.due_confirmed && a.due_date ? a.due_date : "9999",
      db = b.due_confirmed && b.due_date ? b.due_date : "9999";
    return da.localeCompare(db);
  });
  const next = sorted[0];
  const appt = appts[0];

  return (
    <div className="space-y-5">
      <PageHeader title={t("home_title")} />
      <ApplicantStatusBar caseId={caseId} compact />
      <Section title={t("home_latest")}>
        {latest ? (
          <div className="space-y-2">
            <p className="text-lg font-semibold">{latest.title}</p>
            {latest.body && <p className="text-sm">{latest.body}</p>}
            <div className="flex flex-wrap gap-2">
              <SourceBadge source={latest.source} />
              <ReviewBadge state={latest.review_state} />
            </div>
            <p className="text-xs text-muted-foreground">
              {t("recorded")}: {fInstant(latest.recorded_at)}
            </p>
          </div>
        ) : (
          <Empty>{t("home_no_update")}</Empty>
        )}
        {cs?.stage && (
          <dl className="mt-4 space-y-1 border-t pt-4">
            <FieldRow label={t("stage")}>
              {cs.stage}{" "}
              {cs.procedure_path && (
                <span className="text-muted-foreground">· {cs.procedure_path}</span>
              )}
            </FieldRow>
            <FieldRow label={t("source")}>
              <SourceBadge source={cs.stage_source} />{" "}
              <span className="text-xs text-muted-foreground">
                {fInstant(cs.stage_recorded_at)}
              </span>
            </FieldRow>
          </dl>
        )}
      </Section>

      <Section title={t("home_next")} className="border-violet/40">
        {next ? (
          <div className="space-y-3">
            <p className="text-lg font-semibold">{next.title}</p>
            {next.instruction && <p className="text-sm">{next.instruction}</p>}
            <dl className="space-y-1">
              <FieldRow label={t("owner")}>{t(`owner_${next.owner}` as TKey)}</FieldRow>
              <FieldRow label={t("due")}>
                {next.due_confirmed && next.due_date
                  ? fDate(next.due_date)
                  : t("date_not_confirmed")}
              </FieldRow>
              <FieldRow label={t("source")}>
                <SourceBadge source={next.source} />
              </FieldRow>
              {next.documents && (
                <FieldRow label={t("relevant_doc")}>
                  <Link to="/documents" className="text-violet underline">
                    {(next.documents as { safe_name: string }).safe_name}
                  </Link>
                </FieldRow>
              )}
            </dl>
            <ActionStatusBadge status={next.status} overdue={isOverdue(next)} />
            <div>
              <Link
                to="/case"
                hash={`action-${next.id}`}
                onClick={() => logEvent("action_viewed", next.id)}
                className="inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                {t("view_action")}
              </Link>
            </div>
          </div>
        ) : (
          <Empty>{t("home_no_action")}</Empty>
        )}
      </Section>

      <div className="grid gap-5 md:grid-cols-2">
        <Section title={t("home_appt")}>
          {appt ? (
            <div className="space-y-1">
              <p className="font-semibold">{appt.title}</p>
              <p className="text-sm">{fInstant(appt.starts_at)}</p>
              <p className="text-xs text-muted-foreground">
                {appt.confirmed ? t("appt_confirmed") : t("appt_unconfirmed")}
              </p>
              <Link to="/appointments" {...(appts[0] ? { hash: `appt-${appts[0].id}` } : {})} className="text-sm text-violet underline">
                {t("view")}
              </Link>
            </div>
          ) : (
            <Empty>{t("home_no_appt")}</Empty>
          )}
        </Section>
        <Section title={t("home_expiry")}>
          {ren?.expiry_date ? (
            <div className="space-y-1">
              <p className="font-semibold">{ren.document_type}</p>
              <p className="text-sm">{fDate(ren.expiry_date)}</p>
              {!ren.expiry_reviewed && (
                <p className="text-xs text-warning">{t("ren_expiry_unreviewed")}</p>
              )}
              <Link to="/renewal" className="text-sm text-violet underline">
                {t("ren_prepare")}
              </Link>
            </div>
          ) : (
            <Empty>{t("date_not_confirmed")}</Empty>
          )}
        </Section>
      </div>

      <Section title={t("home_help")}>
        {contacts.length ? (
          <ul className="space-y-3">
            {contacts.map((c) => (
              <li key={c.id} className="text-sm">
                <p className="font-semibold">{c.name}</p>
                <p className="text-muted-foreground">
                  {c.role_label}
                  {c.hours ? ` · ${c.hours}` : ""}
                </p>
                {c.email && (
                  <a className="text-violet underline" href={`mailto:${c.email}`}>
                    {c.email}
                  </a>
                )}{" "}
                {c.phone && (
                  <a className="text-violet underline" href={`tel:${c.phone}`}>
                    {c.phone}
                  </a>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <Empty>{t("home_no_contact")}</Empty>
        )}
        <Link to="/support" className="mt-3 inline-block text-sm text-violet underline">
          {t("ask_help")}
        </Link>
      </Section>
    </div>
  );
}
