import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Empty, ErrorState, Loading, PageHeader, Pill, Section } from "@/components/protege/ui";
import { WithMyCase } from "@/components/protege/useMyCase";
import { CaseMessages } from "@/components/protege/CaseMessages";
import { useI18n, type TKey } from "@/lib/i18n";
import { logEvent } from "@/lib/session";
import { pageHead, q, useRpc } from "@/lib/mutate";

export const Route = createFileRoute("/_authenticated/_applicant/support")({
  head: pageHead("My Support"),
  component: () => <WithMyCase>{(id, org) => <Support caseId={id} orgId={org} />}</WithMyCase>,
});

const CATS = [
  "cat_documents",
  "cat_appointment",
  "cat_renewal",
  "cat_account",
  "cat_other",
] as const;

function Support({ caseId, orgId }: { caseId: string; orgId: string }) {
  const { t, fDate, fInstant, locale } = useI18n();
  useEffect(() => logEvent("support_viewed"), []);
  const data = useQuery({
    queryKey: ["support", caseId, locale],
    queryFn: async () => {
      const [res, contacts, reqs] = await Promise.all([
        q(
          supabase
            .from("resources")
            .select("*")
            .eq("org_id", orgId)
            .eq("status", "published")
            .eq("locale", locale),
        ),
        q(supabase.from("support_contacts").select("*").eq("org_id", orgId)),
        q(
          supabase
            .from("help_requests")
            .select("*")
            .eq("case_id", caseId)
            .order("created_at", { ascending: false }),
        ),
      ]);
      return { res, contacts, reqs };
    },
  });
  const [cat, setCat] = useState<string>("cat_other");
  const [msg, setMsg] = useState("");
  const m = useRpc("create_help_request", [["support", caseId, locale]]);
  if (data.isLoading) return <Loading />;
  if (data.error) return <ErrorState error={data.error} onRetry={() => data.refetch()} />;
  const { res, contacts, reqs } = data.data!;
  return (
    <div className="space-y-5">
      <PageHeader title={t("sup_title")} />
      <p role="note" className="text-sm text-muted-foreground">
        {t("sup_no_emergency")}
      </p>

      <CaseMessages caseId={caseId} side="applicant" />

      <Section title={t("sup_help")}>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            m.mutate(
              { _case: caseId, _category: t(cat as TKey), _message: msg },
              {
                onSuccess: () => {
                  setMsg("");
                  logEvent("help_requested");
                },
              },
            );
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="cat">{t("sup_category")}</Label>
            <select
              id="cat"
              className="w-full rounded-md border bg-card p-2 text-sm"
              value={cat}
              onChange={(e) => setCat(e.target.value)}
            >
              {CATS.map((c) => (
                <option key={c} value={c}>
                  {t(c)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="msg">{t("sup_message")}</Label>
            <Textarea id="msg" value={msg} onChange={(e) => setMsg(e.target.value)} />
          </div>
          <Button type="submit" disabled={!msg.trim() || m.isPending}>
            {m.isPending ? t("saving") : t("submit")}
          </Button>
        </form>
        {reqs.length > 0 && (
          <div className="mt-5 border-t pt-4">
            <p className="mb-2 text-sm font-semibold">{t("sup_my_requests")}</p>
            <ul className="space-y-3">
              {reqs.map((r) => (
                <li key={r.id} className="rounded-lg border p-3 text-sm">
                  <div className="flex flex-wrap justify-between gap-2">
                    <span className="font-semibold">{r.category}</span>
                    <Pill variant={r.status === "resolved" ? "success" : "info"}>
                      {t(`help_${r.status}` as TKey)}
                    </Pill>
                  </div>
                  <p className="mt-1">{r.message}</p>
                  <p className="text-xs text-muted-foreground">{fInstant(r.created_at)}</p>
                  {r.response && (
                    <p className="mt-2 rounded bg-muted p-2">
                      <span className="font-semibold">{t("sup_response")}:</span> {r.response}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Section>

      <Section title={t("sup_contacts")}>
        {contacts.length === 0 ? (
          <Empty>{t("home_no_contact")}</Empty>
        ) : (
          <ul className="space-y-3">
            {contacts.map((c) => (
              <li key={c.id} className="text-sm">
                <p className="font-semibold">
                  {c.name} {c.is_external && <Pill>External service</Pill>}
                </p>
                <p className="text-muted-foreground">
                  {c.role_label}
                  {c.hours && ` · ${c.hours}`}
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
        )}
      </Section>

      <Section title={t("sup_resources")}>
        {res.length === 0 ? (
          <Empty>{t("sup_no_resources")}</Empty>
        ) : (
          <ul className="space-y-4">
            {res.map((r) => (
              <li key={r.id} className="rounded-lg border p-4">
                <p className="font-semibold">{r.title}</p>
                <p className="mt-1 text-sm">{r.summary}</p>
                <dl className="mt-2 grid gap-1 text-xs text-muted-foreground">
                  <div>
                    {t("sup_publisher")}: {r.publisher}
                  </div>
                  {r.applicability && (
                    <div>
                      {t("sup_limits")}: {r.applicability}
                    </div>
                  )}
                  <div>
                    {t("sup_reviewed")}: {fDate(r.last_reviewed_on) ?? t("not_recorded")} ·{" "}
                    {t("sup_reviewer")}: {r.reviewer_name}
                  </div>
                </dl>
                {r.source_url && (
                  <a
                    className="mt-2 inline-flex items-center gap-1 text-sm text-violet underline"
                    href={r.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {t("sup_official")} <ExternalLink className="size-3" aria-hidden />
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
