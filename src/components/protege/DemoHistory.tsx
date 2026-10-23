import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FieldRow, Pill, Section } from "./ui";
import { useI18n } from "@/lib/i18n";
import { todayInLisbon } from "@/lib/dates";
import { q } from "@/lib/mutate";
import f1 from "@/assets/demo-renewal-prep-2025-02-12.pdf.asset.json";
import f2 from "@/assets/demo-renewal-request-2025-02-18.pdf.asset.json";
import f3 from "@/assets/demo-renewal-prep-2025-08-14.pdf.asset.json";
import f4 from "@/assets/demo-interview-transcript-2025-05-22.pdf.asset.json";

const FILES: Record<string, string> = {
  "renewal-prep-2025-02-12": f1.url,
  "renewal-request-2025-02-18": f2.url,
  "renewal-prep-2025-08-14": f3.url,
  "interview-transcript-2025-05-22": f4.url,
};

type Fx = {
  id: string;
  kind: string;
  title: string;
  occurred_on: string | null;
  details: { note?: string; file?: string; doc?: string; location?: string; prep?: string; outcome?: string; category?: string; summary?: string; info?: string };
};

function useFixtures(kind: string) {
  return useQuery({
    queryKey: ["demo-fixtures", kind],
    queryFn: () =>
      q(
        supabase
          .from("applicant_demo_fixtures")
          .select("id, kind, title, occurred_on, details")
          .eq("kind", kind)
          .order("occurred_on", { ascending: true, nullsFirst: true }),
      ) as Promise<Fx[]>,
  });
}

function Banner() {
  const { t } = useI18n();
  return (
    <p role="note" className="mb-3 rounded-lg border border-pink/40 bg-pink/5 px-3 py-2 text-xs font-semibold text-pink">
      {t("demo_hist_banner")}
    </p>
  );
}

/** Opens the fixture whose anchor matches the URL hash (used by notification links). */
function useHashOpen(rows: Fx[] | undefined, set: (f: Fx) => void) {
  useEffect(() => {
    const h = window.location.hash.replace("#demo-", "");
    const f = rows?.find((r) => r.id === h);
    if (f) set(f);
  }, [rows, set]);
}

function FileLinks({ file }: { file?: string | undefined }) {
  const { t } = useI18n();
  const url = file ? FILES[file] : undefined;
  if (!url) return null;
  return (
    <div className="flex flex-wrap gap-2">
      <Button asChild size="sm" variant="outline">
        <a href={url} target="_blank" rel="noreferrer">{t("demo_preview")}</a>
      </Button>
      <Button asChild size="sm" variant="outline">
        <a href={url} download>{t("demo_download")}</a>
      </Button>
    </div>
  );
}

export function DemoDocuments() {
  const { t, fDate } = useI18n();
  const d = useFixtures("document");
  if (!d.data?.length) return null;
  return (
    <Section title={t("demo_docs_title")}>
      <Banner />
      <ul className="space-y-3">
        {d.data.map((f) => (
          <li key={f.id} id={`demo-${f.id}`} className="rounded-lg border bg-card p-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold">{f.title}</p>
              <Pill variant="warning">DEMO</Pill>
            </div>
            <p className="text-xs text-muted-foreground">{fDate(f.occurred_on)}</p>
            <p className="my-2 text-sm">{f.details.note}</p>
            <FileLinks file={f.details.file} />
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function DemoPastAppointments() {
  const { t, fDate } = useI18n();
  const d = useFixtures("appointment");
  const docs = useFixtures("document");
  const [open, setOpen] = useState<Fx | null>(null);
  useHashOpen(d.data, setOpen);
  if (!d.data?.length) return null;
  const doc = open?.details.doc ? docs.data?.find((x) => x.id === open.details.doc) : undefined;
  return (
    <Section title={t("demo_past_appts")}>
      <Banner />
      <ul className="space-y-3">
        {[...d.data].reverse().map((f) => (
          <li key={f.id} id={`demo-${f.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card p-3">
            <div>
              <p className="font-semibold">{f.title}</p>
              <p className="text-xs text-muted-foreground">{fDate(f.occurred_on)} · {t("demo_simulated")}</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => setOpen(f)}>{t("demo_view")}</Button>
          </li>
        ))}
      </ul>
      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{open?.title}</DialogTitle></DialogHeader>
          {open && (
            <div className="space-y-3">
              <Pill variant="warning">DEMO</Pill>
              <dl className="space-y-1">
                <FieldRow label={t("demo_date")}>{fDate(open.occurred_on)}</FieldRow>
                <FieldRow label={t("demo_location")}>{open.details.location}</FieldRow>
                <FieldRow label={t("demo_prep")}>{open.details.prep}</FieldRow>
                <FieldRow label={t("demo_outcome")}>{open.details.outcome}</FieldRow>
              </dl>
              {doc && (
                <div className="space-y-2 border-t pt-3">
                  <p className="text-sm font-semibold">{doc.title}</p>
                  <FileLinks file={doc.details.file} />
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Section>
  );
}

export function DemoLife() {
  const { t, fDate } = useI18n();
  const d = useFixtures("life");
  const [open, setOpen] = useState<Fx | null>(null);
  if (!d.data?.length) return null;
  const today = todayInLisbon();
  return (
    <Section title={t("demo_life_title")}>
      <Banner />
      <p className="mb-3 text-xs text-muted-foreground">{t("demo_locality")}</p>
      <ul className="grid gap-3 md:grid-cols-2">
        {d.data.map((f) => (
          <li key={f.id} className="space-y-2 rounded-lg border bg-card p-3">
            <div className="flex flex-wrap gap-2">
              <Pill variant="info">{f.details.category}</Pill>
              <Pill variant="warning">DEMO</Pill>
              {f.occurred_on && (
                <Pill>{f.occurred_on >= today ? t("demo_upcoming") : t("demo_past")}</Pill>
              )}
            </div>
            <p className="font-semibold">{f.title}</p>
            {f.occurred_on && <p className="text-sm">{fDate(f.occurred_on)}</p>}
            <p className="text-sm text-muted-foreground">{f.details.summary}</p>
            <Button size="sm" variant="outline" onClick={() => setOpen(f)}>{t("demo_view")}</Button>
          </li>
        ))}
      </ul>
      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{open?.title}</DialogTitle></DialogHeader>
          {open && (
            <div className="space-y-2 text-sm">
              <Pill variant="warning">DEMO</Pill>
              {open.occurred_on && <p>{fDate(open.occurred_on)}</p>}
              <p>{open.details.info}</p>
              <p className="text-xs text-muted-foreground">{t("demo_locality")}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Section>
  );
}
