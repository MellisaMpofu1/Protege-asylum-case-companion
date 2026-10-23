import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Empty, ErrorState, Loading, PageHeader, Pill, Section } from "@/components/protege/ui";
import { useI18n } from "@/lib/i18n";
import { pageHead, q } from "@/lib/mutate";
import { StatusPill } from "@/components/protege/ApplicationStatus";

export const Route = createFileRoute("/_authenticated/_staff/work/")({
  head: pageHead("Caseload"),
  component: Caseload,
});

const FILTERS = [
  { v: "", label: "All assigned" },
  { v: "awaiting_review", label: "Awaiting review" },
  { v: "overdue", label: "Overdue" },
  { v: "actions_due", label: "Actions due" },
  { v: "expiry", label: "Expiry within 90 days" },
  { v: "help", label: "Open help requests" },
];
const PAGE = 20;

function Caseload() {
  const { fDate, t } = useI18n();
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(0);
  const list = useQuery({
    queryKey: ["caseload", term, filter, page],
    queryFn: () =>
      q(
        supabase.rpc("my_caseload", {
          _search: term || (null as unknown as string),
          _filter: filter || (null as unknown as string),
          _limit: PAGE,
          _offset: page * PAGE,
        }),
      ),
  });
  const ids = (list.data ?? []).map((c) => c.case_id);
  const statuses = useQuery({
    queryKey: ["caseload-status", ids],
    enabled: ids.length > 0,
    queryFn: async () => {
      const rows = await q(supabase.rpc("latest_case_statuses", { _cases: ids }));
      return Object.fromEntries(rows.map((r) => [r.case_id, r.status])) as Record<string, string>;
    },
  });
  const total = Number(list.data?.[0]?.total ?? 0);
  return (
    <div className="space-y-5">
      <PageHeader title={t("nav_caseload")} />
      <Section>
        <form
          className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(0);
            setTerm(search.trim());
          }}
        >
          <label htmlFor="s" className="sr-only">
            Search
          </label>
          <Input
            id="s"
            className="min-w-0"
            placeholder="Search label or workspace ID"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Button type="submit" variant="outline">
            Search
          </Button>
          <label htmlFor="f" className="sr-only">
            Filter
          </label>
          <select
            id="f"
            className="rounded-md border bg-card p-2 text-sm"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setPage(0);
            }}
          >
            {FILTERS.map((f) => (
              <option key={f.v} value={f.v}>
                {f.label}
              </option>
            ))}
          </select>
        </form>
      </Section>
      {list.isLoading ? (
        <Loading />
      ) : list.error ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
        ) : (list.data?.length ?? 0) === 0 ? (
        <Empty>
          No assigned cases match. Cases appear here only when an administrator assigns them to you.
        </Empty>
      ) : (
        <div className="min-w-0">
          <div className="protege-table overflow-x-auto rounded-lg border bg-card" role="region" aria-label={t("nav_caseload")} tabIndex={0}>
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-muted text-left">
              <tr>
                <th className="p-3">Case</th>
                <th className="p-3">Application status</th>
                <th className="p-3">Needs attention</th>
                <th className="p-3">Next confirmed due</th>
                <th className="p-3">Recorded expiry</th>
              </tr>
            </thead>
            <tbody>
              {list.data?.map((c) => (
                <tr key={c.case_id} className="border-t">
                  <td className="p-3">
                    <Link
                      to="/work/$caseId"
                      params={{ caseId: c.case_id }}
                      className="font-semibold text-violet underline"
                    >
                      {c.label}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {c.workspace_ref} {c.is_demo && "· DEMO"}
                    </div>
                  </td>
                  <td className="p-3">
                    <StatusPill status={statuses.data?.[c.case_id]} />
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      {c.overdue > 0 && <Pill variant="danger">{c.overdue} overdue</Pill>}
                      {c.awaiting_review > 0 && (
                        <Pill variant="warning">{c.awaiting_review} to review</Pill>
                      )}
                      {c.open_help > 0 && <Pill variant="info">{c.open_help} help</Pill>}
                      {c.actions_due > 0 && <Pill>{c.actions_due} due</Pill>}
                    </div>
                  </td>
                  <td className="p-3">{c.next_due ? fDate(c.next_due) : "—"}</td>
                  <td className="p-3">{c.expiry ? fDate(c.expiry) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          <div className="grid gap-3 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <span>
              {page * PAGE + 1}–{Math.min((page + 1) * PAGE, total)} of {total}
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={(page + 1) * PAGE >= total}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
