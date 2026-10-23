import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Empty, ErrorState, Loading, PageHeader, Pill, Section } from "@/components/protege/ui";
import { pageHead, q } from "@/lib/mutate";
import { ratioPercent, safeCell, TARGETS, type Ratio } from "@/lib/metrics";
import { useAdminOrg } from "./admin.index";

export const Route = createFileRoute("/_authenticated/_staff/admin/monitoring")({
  head: pageHead("Monitoring"),
  component: Monitoring,
});

type Summary = {
  is_demo: boolean;
  workspaces: number;
  active_applicants: number;
  understanding: Ratio;
  core_flow: Ratio & { assisted: number };
  on_time: Ratio & { unknown: number };
  reminders: Ratio & { failed: number };
  coordination: { pairs: number; baseline_avg: number | null; followup_avg: number | null };
  events: Record<string, number>;
};

const DEFS = [
  [
    "Next-action understanding",
    "Assessed applicants who identified BOTH the correct next action AND its source ÷ assessed applicants (distinct). A view event is not evidence of understanding.",
    "≥ 80%",
  ],
  [
    "Independent core flow",
    "Core-flow tests completed independently ÷ all recorded core-flow tests.",
    "≥ 80%",
  ],
  [
    "Verified on-time actions",
    "Actions verified complete on or before their confirmed due date ÷ confirmed, non-cancelled actions due in the window. Unknown outcomes are shown separately.",
    "—",
  ],
  [
    "Reminder provider acceptance",
    "Reminders accepted by the delivery channel ÷ reminders scheduled in the window.",
    "≥ 99%",
  ],
  [
    "Coordination time",
    "Average paired practitioner task time, baseline vs with Protege. Shown only when comparable paired observations exist.",
    "15% reduction (unvalidated hypothesis)",
  ],
];

function Monitoring() {
  const { ctx, current, picker } = useAdminOrg();
  const [from, setFrom] = useState("2026-01-01");
  const [to, setTo] = useState("2027-12-31");
  const [cohort, setCohort] = useState("");
  const [applied, setApplied] = useState({ from, to, cohort });
  const org = current?.org_id;
  const s = useQuery({
    enabled: !!org,
    queryKey: ["monitor", org, applied],
    queryFn: async () =>
      (await q(
        supabase.rpc("monitoring_summary", {
          _org: org!,
          _from: `${applied.from}T00:00:00Z`,
          _to: `${applied.to}T23:59:59Z`,
          _cohort: (applied.cohort || null) as string,
        }),
      )) as unknown as Summary,
  });
  if (ctx.isLoading) return <Loading />;
  if (!current) return <Empty>Monitoring is available to administrators only.</Empty>;

  async function exportXlsx() {
    const d = s.data!;
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    wb.creator = "Protege";
    const label = d.is_demo
      ? "SIMULATED DEMO DATA — not real pilot results"
      : "Live data (demo records excluded)";
    const ws = wb.addWorksheet("Dashboard");
    ws.addRow(["Protege — Monitoring dashboard"]).font = {
      bold: true,
      size: 16,
      color: { argb: "FF3C156B" },
    };
    ws.addRow([safeCell(label)]).font = {
      bold: true,
      color: { argb: d.is_demo ? "FFC50B7A" : "FF29163E" },
    };
    ws.addRow([`Organisation: ${safeCell(current!.org_name)}`]);
    ws.addRow([
      `Reporting window: ${applied.from} to ${applied.to}`,
      `Cohort: ${safeCell(applied.cohort || "All")}`,
    ]);
    ws.addRow([]);
    ws.addRow(["Metric", "Numerator", "Denominator", "Result", "Target"]).font = { bold: true };
    const row = (n: string, r: Ratio, target: string) =>
      ws.addRow([
        n,
        r.num,
        r.den,
        ratioPercent(r) === null ? "Not enough data" : `${ratioPercent(r)}%`,
        target,
      ]);
    row("Next-action understanding", d.understanding, "≥ 80%");
    row("Independent core flow", d.core_flow, "≥ 80%");
    row("Verified on-time actions", d.on_time, "—");
    row("Reminder provider acceptance", d.reminders, "≥ 99%");
    ws.addRow(["Unknown action outcomes", d.on_time.unknown]);
    ws.addRow([
      "Coordination time (paired)",
      d.coordination.pairs
        ? `${d.coordination.baseline_avg}s → ${d.coordination.followup_avg}s (${d.coordination.pairs} pairs)`
        : "Not enough data",
      "",
      "",
      "15% reduction — unvalidated hypothesis",
    ]);
    ws.columns.forEach((c) => (c.width = 30));
    const defs = wb.addWorksheet("Metric Definitions");
    defs.addRow(["Metric", "Definition", "Target"]).font = { bold: true };
    DEFS.forEach((r) => defs.addRow(r.map(safeCell)));
    defs.columns.forEach((c) => (c.width = 50));
    const agg = wb.addWorksheet("Aggregate Data");
    agg.addRow([safeCell(label)]);
    agg.addRow(["Measure", "Value"]).font = { bold: true };
    agg.addRow(["Case workspaces", d.workspaces]);
    agg.addRow(["Distinct active applicants (pseudonymous)", d.active_applicants]);
    Object.entries(d.events)
      .sort()
      .forEach(([k, v]) => agg.addRow([safeCell(`Event: ${k}`), v]));
    agg.addRow(["Assisted core-flow successes", d.core_flow.assisted]);
    agg.addRow(["Reminder delivery failures", d.reminders.failed]);
    agg.columns.forEach((c) => (c.width = 45));
    const buf = await wb.xlsx.writeBuffer();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(
      new Blob([buf], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
    );
    a.download = `Protege-monitoring-${d.is_demo ? "SIMULATED-" : ""}${applied.from}_${applied.to}.xlsx`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Monitoring">{picker}</PageHeader>
      <Section>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            setApplied({ from, to, cohort });
          }}
        >
          <div className="space-y-1">
            <Label htmlFor="mf">From</Label>
            <Input id="mf" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="mt">To</Label>
            <Input id="mt" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="mc">Cohort / wave</Label>
            <select
              id="mc"
              className="rounded-md border bg-card p-2 text-sm"
              value={cohort}
              onChange={(e) => setCohort(e.target.value)}
            >
              <option value="">All</option>
              {["Wave 1", "Wave 2", "Wave 3", "Wave 4"].map((w) => (
                <option key={w}>{w}</option>
              ))}
            </select>
          </div>
          <Button type="submit" variant="outline">
            Apply
          </Button>
          <Button type="button" disabled={!s.data} onClick={exportXlsx}>
            Export XLSX
          </Button>
        </form>
      </Section>
      {s.isLoading ? (
        <Loading />
      ) : s.error ? (
        <ErrorState error={s.error} onRetry={() => s.refetch()} />
      ) : (
        (() => {
          const d = s.data!;
          return (
            <>
              <p
                role="note"
                className={`rounded-lg p-3 text-sm font-semibold ${d.is_demo ? "bg-pink text-primary-foreground" : "bg-lavender"}`}
              >
                {d.is_demo
                  ? "SIMULATED DEMO DATA — these figures come from the synthetic workbook and are not real pilot results."
                  : "Live data. Demo records are excluded."}{" "}
                Window {applied.from} – {applied.to}
                {applied.cohort && ` · ${applied.cohort}`}.
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                <Metric
                  title="Next-action understanding"
                  r={d.understanding}
                  target={TARGETS.understanding}
                  note="Both action AND source correct"
                />
                <Metric
                  title="Independent core flow"
                  r={d.core_flow}
                  target={TARGETS.core_flow}
                  note={`${d.core_flow.assisted} assisted`}
                />
                <Metric
                  title="Verified on-time actions"
                  r={d.on_time}
                  note={`${d.on_time.unknown} with unknown outcome (shown separately)`}
                />
                <Metric
                  title="Reminder provider acceptance"
                  r={d.reminders}
                  target={TARGETS.reminders}
                  note={`${d.reminders.failed} failed`}
                />
              </div>
              <Section title="Coordination time (paired observations)">
                {d.coordination.pairs ? (
                  <p className="text-sm">
                    Baseline {d.coordination.baseline_avg}s → with Protege{" "}
                    {d.coordination.followup_avg}s across {d.coordination.pairs} comparable pairs.
                    The 15% reduction target is an unvalidated hypothesis.
                  </p>
                ) : (
                  <Empty>Not enough data — no comparable paired observations.</Empty>
                )}
              </Section>
              <Section title="Activity (distinct events)">
                <p className="mb-2 text-sm">
                  {d.workspaces} case workspaces · {d.active_applicants} distinct active applicants
                  (staff excluded)
                </p>
                {Object.keys(d.events).length === 0 ? (
                  <Empty>No events in this window.</Empty>
                ) : (
                  <ul className="grid gap-1 text-sm sm:grid-cols-2">
                    {Object.entries(d.events)
                      .sort()
                      .map(([k, v]) => (
                        <li key={k} className="flex justify-between border-b py-1">
                          <span>{k.replace(/_/g, " ")}</span>
                          <span className="font-semibold">{v}</span>
                        </li>
                      ))}
                  </ul>
                )}
              </Section>
            </>
          );
        })()
      )}
    </div>
  );
}

function Metric({
  title,
  r,
  target,
  note,
}: {
  title: string;
  r: Ratio;
  target?: number;
  note?: string;
}) {
  const p = ratioPercent(r);
  return (
    <Section title={title}>
      {p === null ? (
        <p className="text-lg font-semibold text-muted-foreground">Not enough data</p>
      ) : (
        <p className="text-3xl font-semibold text-primary">{p}%</p>
      )}
      <p className="text-sm">
        {r.num} / {r.den}
      </p>
      {target !== undefined && (
        <p className="mt-1 text-xs">
          Target ≥ {target}%{" "}
          {p !== null &&
            (p >= target ? (
              <Pill variant="success">meets target</Pill>
            ) : (
              <Pill variant="warning">below target</Pill>
            ))}
        </p>
      )}
      {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
    </Section>
  );
}
