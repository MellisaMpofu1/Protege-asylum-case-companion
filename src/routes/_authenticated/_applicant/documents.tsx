import { Link } from "@tanstack/react-router";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Empty,
  ErrorState,
  InlineError,
  Loading,
  PageHeader,
  Pill,
  ReviewBadge,
  Section,
  SourceBadge,
} from "@/components/protege/ui";
import { DemoDocuments } from "@/components/protege/DemoHistory";
import { WithMyCase } from "@/components/protege/useMyCase";
import { useI18n, type TKey } from "@/lib/i18n";
import { logEvent, errorKey } from "@/lib/session";
import { pageHead, q, useRpc } from "@/lib/mutate";
import { getDocumentLink, uploadDocument } from "@/lib/documents.functions";
import { MAX_UPLOAD_BYTES } from "@/lib/files";

export const Route = createFileRoute("/_authenticated/_applicant/documents")({
  head: pageHead("Documents"),
  component: () => <WithMyCase>{(id) => <DocumentsPage caseId={id} />}</WithMyCase>,
});

export function DocumentsPage({ caseId, staff = false }: { caseId: string; staff?: boolean }) {
  const { t, fDate, fInstant } = useI18n();
  const data = useQuery({
    queryKey: ["docs", caseId],
    queryFn: async () => {
      const [docs, reqs] = await Promise.all([
        q(
          supabase
            .from("documents")
            .select("*")
            .eq("case_id", caseId)
            .order("created_at", { ascending: false }),
        ),
        q(
          supabase
            .from("actions")
            .select("id, title")
            .eq("case_id", caseId)
            .eq("requests_document", true)
            .eq("status", "pending"),
        ),
      ]);
      return { docs, reqs };
    },
  });
  const open = useServerFn(getDocumentLink);
  const removal = useRpc("request_document_removal", [["docs", caseId]]);
  if (data.isLoading) return <Loading />;
  if (data.error) return <ErrorState error={data.error} onRetry={() => data.refetch()} />;
  const { docs, reqs } = data.data!;

  async function view(id: string) {
    logEvent("document_viewed", id);
    const w = window.open("", "_blank");
    if (w) w.opener = null;
    const r = await open({ data: { id } });
    if (r.ok) {
      if (w) w.location.href = r.url;
      else window.location.href = r.url;
    } else {
      w?.close();
      toast.error(t("error_forbidden"));
    }
  }

  return (
    <div className="space-y-5">
      {!staff && <PageHeader title={t("docs_title")}><Button asChild variant="outline" size="sm"><Link to="/renewal">{t("renewal_link")}</Link></Button></PageHeader>}
      {reqs.length > 0 && (
        <div role="note" className="rounded-lg border border-violet/40 bg-lavender p-4 text-sm">
          <p className="font-semibold">{t("docs_requested")}</p>
          <ul className="list-disc pl-5">
            {reqs.map((r) => (
              <li key={r.id}>{r.title}</li>
            ))}
          </ul>
        </div>
      )}
      <UploadForm caseId={caseId} actions={reqs} />
      <Section title={t("docs_title")}>
        {docs.length === 0 ? (
          <Empty>{t("none_yet")}</Empty>
        ) : (
          <ul className="divide-y">
            {docs.map((d) => (
              <li
                key={d.id}
                className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="break-words font-semibold">{d.safe_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {d.doc_type} · {t("docs_uploaded_by")} {fInstant(d.created_at)}
                    {d.expiry_date && ` · ${t("docs_expiry")}: ${fDate(d.expiry_date)}`}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <SourceBadge source={d.source} />
                    <ReviewBadge state={d.review_state} />
                    {d.removal_requested && (
                      <Pill variant="warning">{t("docs_removal_pending")}</Pill>
                    )}
                  </div>
                </div>
                <div className="flex min-w-0 flex-wrap gap-2 sm:max-w-xs">
                  {d.is_sample ? (
                    <span className="text-xs text-muted-foreground">{t("docs_sample")}</span>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => view(d.id)}>
                      {t("docs_open")}
                    </Button>
                  )}
                  {!d.removal_requested && !staff && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="ghost">
                          {t("docs_remove")}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{t("docs_remove")}</AlertDialogTitle>
                          <AlertDialogDescription>
                            {t("docs_remove_confirm")}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                          <AlertDialogAction onClick={() => removal.mutate({ _doc: d.id })}>
                            {t("submit")}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-xs text-muted-foreground">{t("docs_scan_note")}</p>
      </Section>
      {!staff && <DemoDocuments />}
    </div>
  );
}

function UploadForm({
  caseId,
  actions,
}: {
  caseId: string;
  actions: { id: string; title: string }[];
}) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const upload = useServerFn(uploadDocument);
  const fileRef = useRef<HTMLInputElement>(null);
  const [type, setType] = useState("doc_type_letter");
  const [expiry, setExpiry] = useState("");
  const [action, setAction] = useState("");
  const [err, setErr] = useState<TKey | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (actions[0]) setAction(actions[0].id);
  }, [actions]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const f = fileRef.current?.files?.[0];
    if (!f) return setErr("required");
    if (f.size > MAX_UPLOAD_BYTES) return setErr("docs_err_too_large");
    const fd = new FormData();
    fd.set("file", f);
    fd.set("caseId", caseId);
    fd.set("docType", t(type as TKey));
    fd.set("expiry", expiry);
    fd.set("actionId", action);
    setBusy(true);
    logEvent("upload_attempted");
    try {
      const r = await upload({ data: fd });
      if (!r.ok) {
        logEvent("upload_failed");
        setErr(
          (["too_large", "invalid_type", "active_content", "empty"].includes(r.error)
            ? `docs_err_${r.error}`
            : r.error === "forbidden"
              ? "error_forbidden"
              : "error_generic") as TKey,
        );
      } else {
        logEvent("upload_completed", r.id);
        toast.success(t("saved"));
        if (fileRef.current) fileRef.current.value = "";
        setExpiry("");
        qc.invalidateQueries({ queryKey: ["docs", caseId] });
      }
    } catch (e2) {
      setErr(errorKey(e2));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Section title={t("docs_upload")}>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="f">{t("docs_file")}</Label>
          <Input id="f" ref={fileRef} type="file" accept="application/pdf,image/jpeg,image/png" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ty">{t("docs_type")}</Label>
          <select
            id="ty"
            className="w-full rounded-md border bg-card p-2 text-sm"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            {["doc_type_identity", "doc_type_letter", "doc_type_evidence", "doc_type_other"].map(
              (k) => (
                <option key={k} value={k}>
                  {t(k as TKey)}
                </option>
              ),
            )}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ex">
            {t("docs_expiry")} ({t("optional")})
          </Label>
          <Input id="ex" type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
        </div>
        {actions.length > 0 && (
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="ac">{t("docs_requested")}</Label>
            <select
              id="ac"
              className="w-full rounded-md border bg-card p-2 text-sm"
              value={action}
              onChange={(e) => setAction(e.target.value)}
            >
              <option value="">—</option>
              {actions.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="sm:col-span-2">
          <InlineError k={err} />
        </div>
        <div>
          <Button type="submit" disabled={busy}>
            {busy ? t("saving") : t("docs_upload")}
          </Button>
        </div>
      </form>
    </Section>
  );
}
