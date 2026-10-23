import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { useI18n } from "@/lib/i18n";
import { isOverdue, lisbonLocalToUtcIso, utcIsoToLisbonLocal } from "@/lib/dates";
import { pageHead, q, qMaybe, useRpc } from "@/lib/mutate";
import { useCaseRecords } from "../_applicant/case";
import { CaseMessages } from "@/components/protege/CaseMessages";
import { DocumentsPage } from "../_applicant/documents";
import { CorrespondenceLog } from "../_applicant/renewal";
import { APP_STATUSES, StatusHistory, StatusPill, useStatusHistory, type AppStatus } from "@/components/protege/ApplicationStatus";
import { removeDocument } from "@/lib/documents.functions";

export const Route = createFileRoute("/_authenticated/_staff/work/$caseId")({
  head: pageHead("Case detail"),
  component: CaseDetail,
});

const SOURCES = ["practitioner_reviewed", "applicant_reported", "linked_correspondence"] as const;
const sel = "w-full rounded-md border bg-card p-2 text-sm";

function CaseDetail() {
  const { caseId } = Route.useParams();
  const c = useQuery({
    queryKey: ["staffcase", caseId],
    queryFn: () => qMaybe(supabase.from("cases").select("*").eq("id", caseId).maybeSingle()),
  });
  const grant = useQuery({
    queryKey: ["mygrant", caseId],
    queryFn: async () => (await supabase.rpc("has_case_grant", { _case: caseId })).data === true,
  });
  if (c.isLoading || grant.isLoading) return <Loading />;
  if (c.error) return <ErrorState error={c.error} onRetry={() => c.refetch()} />;
  if (!c.data || !grant.data)
    return (
      <Empty>
        You do not have access to this case. Access is given per case by an administrator.
      </Empty>
    );
  const cs = c.data;
  return (
    <div className="space-y-5">
      <Link to="/work" className="text-sm text-violet underline">
        ← Caseload
      </Link>
      <PageHeader title={cs.display_label} />
      <p className="text-sm text-muted-foreground">
        {cs.workspace_ref} · Preferred language: {cs.preferred_language ?? "not recorded"}
        {cs.needs_language_assistance && " · Language assistance requested"}
      </p>
      <StatusEditor caseId={cs.id} />
      <StageEditor cs={cs} />
      <Tabs defaultValue="timeline">
        <TabsList className="flex h-auto flex-wrap justify-start">
          {[
            "timeline",
            "actions",
            "appointments",
            "renewal",
            "documents",
            "messages",
            "help",
            "notes",
            "assess",
            "reminders",
          ].map((v) => (
            <TabsTrigger key={v} value={v} className="capitalize">
              {v === "assess" ? "Assessments" : v}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="timeline">
          <TimelineReview caseId={caseId} />
        </TabsContent>
        <TabsContent value="actions">
          <ActionsPanel caseId={caseId} />
        </TabsContent>
        <TabsContent value="appointments">
          <AppointmentsPanel caseId={caseId} />
        </TabsContent>
        <TabsContent value="renewal">
          <RenewalPanel caseId={caseId} />
          <div className="mt-5">
            <CorrespondenceLog caseId={caseId} />
          </div>
        </TabsContent>
        <TabsContent value="documents">
          <DocReview caseId={caseId} />
          <DocumentsPage caseId={caseId} staff />
        </TabsContent>
        <TabsContent value="messages">
          <CaseMessages caseId={caseId} side="staff" />
        </TabsContent>
        <TabsContent value="help">
          <HelpPanel caseId={caseId} />
        </TabsContent>
        <TabsContent value="notes">
          <NotesPanel caseId={caseId} />
        </TabsContent>
        <TabsContent value="assess">
          <AssessPanel caseId={caseId} />
        </TabsContent>
        <TabsContent value="reminders">
          <RemindersPanel caseId={caseId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatusEditor({ caseId }: { caseId: string }) {
  const hist = useStatusHistory(caseId);
  const [status, setStatus] = useState<AppStatus>("pending");
  const [src, setSrc] = useState<string>("practitioner_reviewed");
  const [why, setWhy] = useState("");
  const [ref, setRef] = useState("");
  const m = useRpc("record_application_status", [["appstatus", caseId], ["caseload-status"], ["case", caseId]]);
  const approvedBad = status === "approved" && (src !== "linked_correspondence" || !ref.trim());
  const cur = hist.data?.[0];
  return (
    <Section title="Application status">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Current:</span>
        <StatusPill status={cur?.status} size="lg" />
        {cur?.correction_requested && <Pill variant="warning">Applicant requested a correction</Pill>}
      </div>
      <form
        className="grid gap-3 md:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          m.mutate(
            { _case: caseId, _status: status, _explanation: why, _source: src, _decision_ref: ref || null },
            { onSuccess: () => { setWhy(""); setRef(""); } },
          );
        }}
      >
        <div>
          <Label htmlFor="as-st">New status</Label>
          <select id="as-st" className={sel} value={status} onChange={(e) => setStatus(e.target.value as AppStatus)}>
            {APP_STATUSES.map((s) => (
              <option key={s} value={s}>
                {{ applied: "Applied", pending: "Pending", action_required: "Action Required", approved: "Approved" }[s]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="as-src">Source (required)</Label>
          <select id="as-src" className={sel} value={src} onChange={(e) => setSrc(e.target.value)}>
            {SOURCES.map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2">
          <Label htmlFor="as-why">Plain-language explanation for the applicant (required)</Label>
          <Textarea id="as-why" required minLength={5} value={why} onChange={(e) => setWhy(e.target.value)} />
        </div>
        {status === "approved" && (
          <div className="md:col-span-2 space-y-1">
            <Label htmlFor="as-ref">Authority decision reference (required for Approved)</Label>
            <Input id="as-ref" value={ref} onChange={(e) => setRef(e.target.value)} />
            <p className="text-xs text-muted-foreground">
              Approved needs a recorded authority decision with the source set to linked correspondence. Never record it from uploads, completed tasks or elapsed time.
            </p>
          </div>
        )}
        <div className="md:col-span-2">
          <Button type="submit" disabled={m.isPending || why.trim().length < 5 || approvedBad}>
            Save status (applicant-visible, notifies applicant)
          </Button>
        </div>
      </form>
      <div className="mt-5">
        <h3 className="mb-3 font-semibold">Status history</h3>
        {hist.isLoading ? <Loading /> : <StatusHistory rows={hist.data ?? []} />}
      </div>
    </Section>
  );
}

function StageEditor({
  cs,
}: {
  cs: {
    id: string;
    stage: string | null;
    procedure_path: string | null;
    stage_source: string | null;
  };
}) {
  const [stage, setStage] = useState(cs.stage ?? "");
  const [path, setPath] = useState(cs.procedure_path ?? "");
  const [src, setSrc] = useState(cs.stage_source ?? "practitioner_reviewed");
  const m = useRpc("set_case_stage", [["staffcase", cs.id]]);
  return (
    <Section title="Recorded case stage">
      <form
        className="grid gap-3 sm:grid-cols-3"
        onSubmit={(e) => {
          e.preventDefault();
          m.mutate({ _case: cs.id, _stage: stage, _path: path, _source: src });
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="st">Stage (as recorded)</Label>
          <Input id="st" value={stage} onChange={(e) => setStage(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pp">Procedural path</Label>
          <Input id="pp" value={path} onChange={(e) => setPath(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ss">Source</Label>
          <select id="ss" className={sel} value={src} onChange={(e) => setSrc(e.target.value)}>
            {SOURCES.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Button type="submit" variant="outline" disabled={m.isPending}>
            Save stage (applicant-visible)
          </Button>
        </div>
      </form>
    </Section>
  );
}

function TimelineReview({ caseId }: { caseId: string }) {
  const { fInstant } = useI18n();
  const data = useCaseRecords(caseId);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [src, setSrc] = useState("practitioner_reviewed");
  const add = useRpc("add_timeline_entry", [["case", caseId]]);
  const note = useRpc("add_internal_note", [["notes", caseId]]);
  const [vis, setVis] = useState<"" | "applicant" | "internal">("");
  if (data.isLoading) return <Loading />;
  if (data.error) return <ErrorState error={data.error} onRetry={() => data.refetch()} />;
  return (
    <div className="space-y-5">
      <Section title="Record an update">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const done = { onSuccess: () => { setTitle(""); setBody(""); setVis(""); } };
            if (vis === "internal") note.mutate({ _case: caseId, _body: `${title}\n${body}`.trim() }, done);
            else add.mutate({ _case: caseId, _title: title, _body: body, _source: src }, done);
          }}
        >
          <Input
            aria-label="Title"
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <Textarea
            aria-label="Details"
            placeholder="Details"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <select
            aria-label="Source"
            className={sel}
            value={src}
            onChange={(e) => setSrc(e.target.value)}
          >
            {SOURCES.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <fieldset className="space-y-1">
            <legend className="text-sm font-medium">Who can see this? (required)</legend>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name={`vis-${caseId}`} checked={vis === "applicant"} onChange={() => setVis("applicant")} />
              Visible to applicant — appears on their timeline and notifies them
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name={`vis-${caseId}`} checked={vis === "internal"} onChange={() => setVis("internal")} />
              Internal note — staff with internal access only, never shown to the applicant
            </label>
          </fieldset>
          <Button type="submit" disabled={!title.trim() || !vis || add.isPending || note.isPending}>
            {vis === "internal" ? "Save internal note" : "Save applicant-visible update"}
          </Button>
        </form>
      </Section>
      {data.data!.tl.map((e) => (
        <ReviewEntry key={e.id} e={e} caseId={caseId} fInstant={fInstant} />
      ))}
    </div>
  );
}

function ReviewEntry({
  e,
  caseId,
  fInstant,
}: {
  e: {
    id: string;
    title: string;
    body: string | null;
    source: string;
    review_state: string;
    version: number;
    correction_requested: boolean;
    correction_note: string | null;
    recorded_at: string;
  };
  caseId: string;
  fInstant: (v: string) => string | null;
}) {
  const [edit, setEdit] = useState(false);
  const [title, setTitle] = useState(e.title);
  const [body, setBody] = useState(e.body ?? "");
  const [src, setSrc] = useState(e.source);
  const [reason, setReason] = useState("");
  const m = useRpc("review_timeline_entry", [["case", caseId]]);
  const needs = e.review_state === "unreviewed" || e.correction_requested;
  return (
    <Section className={needs ? "border-warning/50" : ""}>
      <div className="flex flex-wrap justify-between gap-2">
        <p className="font-semibold">{e.title}</p>
        <div className="flex gap-1">
          <SourceBadge source={e.source} />
          <ReviewBadge state={e.review_state} />
        </div>
      </div>
      {e.body && <p className="mt-1 text-sm">{e.body}</p>}
      <p className="text-xs text-muted-foreground">
        {fInstant(e.recorded_at)} · v{e.version}
      </p>
      {e.correction_requested && (
        <p className="mt-2 text-sm text-warning">Correction requested: {e.correction_note}</p>
      )}
      {!edit ? (
        <div className="mt-3 flex gap-2">
          {needs && (
            <Button
              size="sm"
              onClick={() =>
                m.mutate({
                  _entry: e.id,
                  _expected_version: e.version,
                  _title: e.title,
                  _body: e.body,
                  _source: e.source === "applicant_reported" ? "applicant_reported" : e.source,
                  _reason: "Reviewed without change",
                })
              }
            >
              Mark reviewed
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => setEdit(true)}>
            Correct
          </Button>
        </div>
      ) : (
        <form
          className="mt-3 space-y-2"
          onSubmit={(ev) => {
            ev.preventDefault();
            m.mutate(
              {
                _entry: e.id,
                _expected_version: e.version,
                _title: title,
                _body: body,
                _source: src,
                _reason: reason,
              },
              { onSuccess: () => setEdit(false) },
            );
          }}
        >
          <Input aria-label="Title" value={title} onChange={(ev) => setTitle(ev.target.value)} />
          <Textarea aria-label="Details" value={body} onChange={(ev) => setBody(ev.target.value)} />
          <select
            aria-label="Source"
            className={sel}
            value={src}
            onChange={(ev) => setSrc(ev.target.value)}
          >
            {SOURCES.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <Input
            aria-label="Reason for correction"
            placeholder="Reason for correction (kept in history)"
            value={reason}
            onChange={(ev) => setReason(ev.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            The previous version is preserved. Saving fails if someone else changed this entry
            meanwhile.
          </p>
          <div className="flex gap-2">
            <Button size="sm" type="submit" disabled={!reason.trim() || m.isPending}>
              Save correction
            </Button>
            <Button size="sm" type="button" variant="ghost" onClick={() => setEdit(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </Section>
  );
}

function ActionsPanel({ caseId }: { caseId: string }) {
  const { fDate } = useI18n();
  const data = useCaseRecords(caseId);
  const [f, setF] = useState({
    title: "",
    instruction: "",
    owner: "applicant",
    source: "practitioner_reviewed",
    due: "",
    confirmed: false,
    doc: "",
    reqDoc: false,
  });
  const create = useRpc("create_action", [["case", caseId]]);
  if (data.isLoading) return <Loading />;
  if (data.error) return <ErrorState error={data.error} onRetry={() => data.refetch()} />;
  const { acts, docs } = data.data!;
  return (
    <div className="space-y-5">
      <Section title="Assign an action (applicant-visible)">
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate(
              {
                _case: caseId,
                _title: f.title,
                _instruction: f.instruction,
                _owner: f.owner,
                _source: f.source,
                _due: f.due || null,
                _due_confirmed: f.confirmed,
                _doc: f.doc || null,
                _requests_document: f.reqDoc,
              },
              {
                onSuccess: () =>
                  setF({ ...f, title: "", instruction: "", due: "", confirmed: false }),
              },
            );
          }}
        >
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="at">Title</Label>
            <Input
              id="at"
              value={f.title}
              onChange={(e) => setF({ ...f, title: e.target.value })}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="ai">Plain-language instruction</Label>
            <Textarea
              id="ai"
              value={f.instruction}
              onChange={(e) => setF({ ...f, instruction: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ao">Owner</Label>
            <select
              id="ao"
              className={sel}
              value={f.owner}
              onChange={(e) => setF({ ...f, owner: e.target.value })}
            >
              <option value="applicant">Applicant</option>
              <option value="practitioner">Practitioner</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="as">Source</Label>
            <select
              id="as"
              className={sel}
              value={f.source}
              onChange={(e) => setF({ ...f, source: e.target.value })}
            >
              {SOURCES.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ad">Due date (date only)</Label>
            <Input
              id="ad"
              type="date"
              value={f.due}
              onChange={(e) => setF({ ...f, due: e.target.value })}
            />
          </div>
          <label className="flex items-center gap-2 self-end text-sm">
            <Checkbox
              checked={f.confirmed}
              onCheckedChange={(v) => setF({ ...f, confirmed: v === true })}
            />
            I have confirmed this date (enables reminders)
          </label>
          <div className="space-y-1.5">
            <Label htmlFor="adoc">Relevant document</Label>
            <select
              id="adoc"
              className={sel}
              value={f.doc}
              onChange={(e) => setF({ ...f, doc: e.target.value })}
            >
              <option value="">—</option>
              {docs.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.safe_name}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 self-end text-sm">
            <Checkbox
              checked={f.reqDoc}
              onCheckedChange={(v) => setF({ ...f, reqDoc: v === true })}
            />
            Request a document from the applicant
          </label>
          <div>
            <Button type="submit" disabled={!f.title.trim() || create.isPending}>
              Assign action
            </Button>
          </div>
        </form>
      </Section>
      {acts.length === 0 ? (
        <Empty>No actions recorded.</Empty>
      ) : (
        acts.map((a) => (
          <Section key={a.id}>
            <div className="flex flex-wrap justify-between gap-2">
              <p className="font-semibold">{a.title}</p>
              <ActionStatusBadge status={a.status} overdue={isOverdue(a)} />
            </div>
            <dl className="mt-2 space-y-1">
              <FieldRow label="Due">
                {a.due_date
                  ? `${fDate(a.due_date)}${a.due_confirmed ? " (confirmed)" : " (not confirmed)"}`
                  : "Date not confirmed"}
              </FieldRow>
              {a.completed_on && (
                <FieldRow label="Reported completed">{fDate(a.completed_on)}</FieldRow>
              )}
              {a.status !== "pending" && (
                <FieldRow label="Outcome">{a.outcome ?? "Outcome not recorded"}</FieldRow>
              )}
            </dl>
            <ActionControls a={a} caseId={caseId} />
          </Section>
        ))
      )}
    </div>
  );
}

function ActionControls({
  a,
  caseId,
}: {
  a: {
    id: string;
    status: string;
    version: number;
    due_date: string | null;
    due_confirmed: boolean;
  };
  caseId: string;
}) {
  const inv = [["case", caseId]];
  const verify = useRpc("verify_action", inv);
  const ret = useRpc("return_action", inv);
  const cancel = useRpc("cancel_action", inv);
  const due = useRpc("update_action_due", inv);
  const [d, setD] = useState(a.due_date ?? "");
  const [conf, setConf] = useState(a.due_confirmed);
  const [reason, setReason] = useState("");
  if (a.status === "cancelled" || a.status === "verified_complete") return null;
  return (
    <div className="mt-3 space-y-3 border-t pt-3">
      <div className="flex flex-wrap gap-2">
        {a.status === "reported_complete" && (
          <>
            <Button
              size="sm"
              onClick={() => verify.mutate({ _action: a.id, _expected_version: a.version })}
            >
              Verify completion
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                ret.mutate({
                  _action: a.id,
                  _expected_version: a.version,
                  _note: "Returned for more information",
                })
              }
            >
              Return to applicant
            </Button>
          </>
        )}
      </div>
      {a.status === "pending" && (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            due.mutate({
              _action: a.id,
              _expected_version: a.version,
              _due: d || null,
              _confirmed: conf,
            });
          }}
        >
          <div>
            <Label htmlFor={`d-${a.id}`} className="text-xs">
              Due date
            </Label>
            <Input id={`d-${a.id}`} type="date" value={d} onChange={(e) => setD(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-xs">
            <Checkbox checked={conf} onCheckedChange={(v) => setConf(v === true)} />
            Confirmed
          </label>
          <Button size="sm" variant="outline" type="submit">
            Update date
          </Button>
        </form>
      )}
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          cancel.mutate({ _action: a.id, _expected_version: a.version, _reason: reason });
        }}
      >
        <div className="min-w-48 flex-1">
          <Label htmlFor={`r-${a.id}`} className="text-xs">
            Cancellation reason
          </Label>
          <Input id={`r-${a.id}`} value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <Button size="sm" variant="ghost" type="submit" disabled={!reason.trim()}>
          Cancel action
        </Button>
      </form>
    </div>
  );
}

type Appt = {
  id: string;
  title: string;
  starts_at: string | null;
  confirmed: boolean;
  location: string | null;
  remote_link: string | null;
  support_user_id: string | null;
  checklist: unknown;
  document_ids: string[];
  change_request: string | null;
  recap: string | null;
};

function AppointmentsPanel({ caseId }: { caseId: string }) {
  const { fInstant } = useI18n();
  const list = useQuery({
    queryKey: ["appts", caseId],
    queryFn: async () => ({
      appts: await q(
        supabase
          .from("appointments")
          .select("*")
          .eq("case_id", caseId)
          .order("starts_at", { ascending: false }),
      ),
      docs: await q(supabase.from("documents").select("id, safe_name").eq("case_id", caseId)),
      resp: await q(supabase.from("appointment_responses").select("*").eq("case_id", caseId).order("created_at")),
    }),
  });
  const cancel = useRpc("cancel_appointment", [["appts", caseId]]);
  const [creating, setCreating] = useState(false);
  if (list.isLoading) return <Loading />;
  if (list.error) return <ErrorState error={list.error} onRetry={() => list.refetch()} />;
  const docs = list.data!.docs;
  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">Appointments here are recorded by caseworkers for the applicant. Saving does not book anything with AIMA or any authority. Times are Europe/Lisbon.</p>
      {creating ? (
        <Section title="Create appointment">
          <ApptForm caseId={caseId} docs={docs} onDone={() => setCreating(false)} />
        </Section>
      ) : (
        <Button onClick={() => setCreating(true)}>Create Appointment</Button>
      )}
      {list.data!.appts.map((a) => (
        <Section
          key={a.id}
          title={a.title}
          action={
            a.status === "cancelled" ? (
              <Pill variant="neutral">Cancelled</Pill>
            ) : a.confirmed ? (
              <Pill variant="success">Confirmed</Pill>
            ) : (
              <Pill variant="warning">Not confirmed</Pill>
            )
          }
        >
          <p className="text-sm">{a.starts_at ? `${fInstant(a.starts_at)} (Lisbon)` : "Date not confirmed"}</p>
          <p className="text-sm">{a.acknowledged_at ? `Applicant acknowledged ${fInstant(a.acknowledged_at)}` : "Not acknowledged by applicant yet"}</p>
          {a.change_request && (
            <p className="mt-2 text-sm text-warning">
              Applicant asked for a change: {a.change_request}
            </p>
          )}
          {list.data!.resp.filter((r) => r.appointment_id === a.id).length > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              {list.data!.resp.filter((r) => r.appointment_id === a.id).map((r) => (
                <li key={r.id}>{fInstant(r.created_at)} · {r.kind === "acknowledged" ? "Acknowledged" : `Change requested: ${r.note ?? ""}`}</li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs text-muted-foreground">Acknowledgement means the applicant saw it — not proof of understanding or attendance.</p>
          <ApptForm caseId={caseId} appt={a as Appt} docs={docs} />
          {a.status !== "cancelled" && (
            <Button size="sm" variant="ghost" className="mt-2" disabled={cancel.isPending} onClick={() => {
              const reason = window.prompt("Reason for cancelling (shown to the applicant, optional)") ;
              if (reason !== null) cancel.mutate({ _appt: a.id, _reason: reason });
            }}>Cancel appointment</Button>
          )}
          <RecapForm appt={a as Appt} caseId={caseId} />
        </Section>
      ))}
    </div>
  );
}

function ApptForm({ caseId, appt, docs, onDone }: { caseId: string; appt?: Appt; docs: { id: string; safe_name: string }[]; onDone?: () => void }) {
  const [open, setOpen] = useState(!appt);
  const [docIds, setDocIds] = useState<string[]>(appt?.document_ids ?? []);
  const [f, setF] = useState({
    title: appt?.title ?? "",
    when: utcIsoToLisbonLocal(appt?.starts_at),
    confirmed: appt?.confirmed ?? false,
    location: appt?.location ?? "",
    link: appt?.remote_link ?? "",
    checklist: ((appt?.checklist as { label: string }[]) ?? []).map((i) => i.label).join("\n"),
  });
  const m = useRpc("upsert_appointment", [["appts", caseId]]);
  if (!open)
    return (
      <Button size="sm" variant="outline" className="mt-3" onClick={() => setOpen(true)}>
        Edit / reschedule
      </Button>
    );
  return (
    <form
      className="mt-3 grid gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        const prev = (appt?.checklist as { label: string; done: boolean }[]) ?? [];
        const checklist = f.checklist
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean)
          .map((label) => ({ label, done: prev.find((p) => p.label === label)?.done ?? false }));
        m.mutate(
          {
            _id: appt?.id ?? null,
            _case: caseId,
            _title: f.title,
            _starts_at: f.when ? lisbonLocalToUtcIso(f.when) : null,
            _confirmed: f.confirmed,
            _location: f.location,
            _remote_link: f.link,
            _support_user: null,
            _checklist: checklist,
            _doc_ids: docIds,
          },
          { onSuccess: () => { if (appt) setOpen(false); onDone?.(); } },
        );
      }}
    >
      <div className="space-y-1.5">
        <Label>Title</Label>
        <Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label>Date and time (Europe/Lisbon)</Label>
        <Input
          type="datetime-local"
          value={f.when}
          onChange={(e) => setF({ ...f, when: e.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Location</Label>
        <Input value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label>Remote link (https)</Label>
        <Input value={f.link} onChange={(e) => setF({ ...f, link: e.target.value })} />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label>Preparation instructions (one step per line)</Label>
        <Textarea value={f.checklist} onChange={(e) => setF({ ...f, checklist: e.target.value })} />
      </div>
      {docs.length > 0 && (
        <fieldset className="space-y-1 sm:col-span-2">
          <legend className="text-sm font-medium">Documents to bring (optional)</legend>
          {docs.map((d) => (
            <label key={d.id} className="flex items-center gap-2 text-sm">
              <Checkbox checked={docIds.includes(d.id)} onCheckedChange={(v) => setDocIds((xs) => (v === true ? [...xs, d.id] : xs.filter((x) => x !== d.id)))} />
              <span className="break-all">{d.safe_name}</span>
            </label>
          ))}
        </fieldset>
      )}
      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={f.confirmed}
          onCheckedChange={(v) => setF({ ...f, confirmed: v === true })}
        />
        Date confirmed by practitioner (enables reminder)
      </label>
      <div>
        <Button size="sm" type="submit" disabled={!f.title.trim() || m.isPending}>
          Save appointment
        </Button>
      </div>
    </form>
  );
}

function RecapForm({ appt, caseId }: { appt: Appt; caseId: string }) {
  const [recap, setRecap] = useState(appt.recap ?? "");
  const m = useRpc("save_recap", [["appts", caseId]]);
  return (
    <form
      className="mt-3 space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        m.mutate({ _appt: appt.id, _recap: recap });
      }}
    >
      <Label htmlFor={`rc-${appt.id}`}>Reviewed recap (applicant-visible)</Label>
      <Textarea id={`rc-${appt.id}`} value={recap} onChange={(e) => setRecap(e.target.value)} />
      <Button size="sm" variant="outline" type="submit" disabled={m.isPending}>
        Save reviewed recap
      </Button>
    </form>
  );
}

function RenewalPanel({ caseId }: { caseId: string }) {
  const r = useQuery({
    queryKey: ["renewal", caseId],
    queryFn: () =>
      qMaybe(supabase.from("renewal_records").select("*").eq("case_id", caseId).maybeSingle()),
  });
  if (r.isLoading) return <Loading />;
  return <RenewalForm caseId={caseId} r={r.data} key={r.data?.id ?? "new"} />;
}

function RenewalForm({
  caseId,
  r,
}: {
  caseId: string;
  r:
    | {
        document_type: string;
        expiry_date: string | null;
        expiry_reviewed: boolean;
        prep_start_date: string | null;
        instructions: string | null;
        checklist: unknown;
      }
    | null
    | undefined;
}) {
  const prev = (r?.checklist as { label: string; done: boolean }[]) ?? [];
  const [f, setF] = useState({
    type: r?.document_type ?? "",
    expiry: r?.expiry_date ?? "",
    reviewed: r?.expiry_reviewed ?? false,
    prep: r?.prep_start_date ?? "",
    instr: r?.instructions ?? "",
    list: prev.map((p) => p.label).join("\n"),
  });
  const m = useRpc("upsert_renewal", [["renewal", caseId]]);
  return (
    <Section title="Renewal preparation (applicant-visible)">
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          m.mutate({
            _case: caseId,
            _document_type: f.type,
            _expiry: f.expiry || null,
            _expiry_reviewed: f.reviewed,
            _prep_start: f.prep || null,
            _instructions: f.instr,
            _checklist: f.list
              .split("\n")
              .map((s) => s.trim())
              .filter(Boolean)
              .map((label) => ({
                label,
                done: prev.find((p) => p.label === label)?.done ?? false,
              })),
          });
        }}
      >
        <div className="space-y-1.5">
          <Label>Recorded document type</Label>
          <Input value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Recorded expiry date</Label>
          <Input
            type="date"
            value={f.expiry}
            onChange={(e) => setF({ ...f, expiry: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Preparation reminder date</Label>
          <Input
            type="date"
            value={f.prep}
            onChange={(e) => setF({ ...f, prep: e.target.value })}
          />
        </div>
        <label className="flex items-center gap-2 self-end text-sm">
          <Checkbox
            checked={f.reviewed}
            onCheckedChange={(v) => setF({ ...f, reviewed: v === true })}
          />
          Expiry reviewed by me (enables reminder)
        </label>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Reviewed instructions</Label>
          <Textarea value={f.instr} onChange={(e) => setF({ ...f, instr: e.target.value })} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Checklist (one per line)</Label>
          <Textarea value={f.list} onChange={(e) => setF({ ...f, list: e.target.value })} />
        </div>
        <p className="text-xs text-muted-foreground sm:col-span-2">
          Do not enter guessed entitlements, processing times or legal deadlines.
        </p>
        <div>
          <Button type="submit" disabled={!f.type.trim() || m.isPending}>
            Save renewal preparation
          </Button>
        </div>
      </form>
    </Section>
  );
}

function DocReview({ caseId }: { caseId: string }) {
  const qc = useQueryClient();
  const docs = useQuery({
    queryKey: ["docs", caseId, "review"],
    queryFn: () =>
      q(
        supabase
          .from("documents")
          .select("id, safe_name, review_state, expiry_date, removal_requested")
          .eq("case_id", caseId)
          .or("review_state.eq.unreviewed,removal_requested.eq.true"),
      ),
  });
  const review = useRpc("review_document", [
    ["docs", caseId],
    ["docs", caseId, "review"],
  ]);
  const remove = useServerFn(removeDocument);
  if (!docs.data?.length) return null;
  return (
    <Section title="Documents needing review" className="mb-5">
      <ul className="divide-y">
        {docs.data.map((d) => (
          <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
            <span>
              {d.safe_name}{" "}
              {d.removal_requested && <Pill variant="warning">Removal requested</Pill>}
            </span>
            <span className="flex gap-2">
              {d.review_state === "unreviewed" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    review.mutate({ _doc: d.id, _state: "reviewed", _expiry: d.expiry_date })
                  }
                >
                  Mark reviewed
                </Button>
              )}
              {d.removal_requested && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    const r = await remove({ data: { id: d.id } });
                    if (r.ok) {
                      toast.success("Removed");
                      qc.invalidateQueries({ queryKey: ["docs", caseId] });
                    } else toast.error("Could not remove");
                  }}
                >
                  Confirm removal
                </Button>
              )}
            </span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function HelpPanel({ caseId }: { caseId: string }) {
  const { fInstant } = useI18n();
  const list = useQuery({
    queryKey: ["help", caseId],
    queryFn: () =>
      q(
        supabase
          .from("help_requests")
          .select("*")
          .eq("case_id", caseId)
          .order("created_at", { ascending: false }),
      ),
  });
  if (list.isLoading) return <Loading />;
  if (!list.data?.length) return <Empty>No help requests.</Empty>;
  return (
    <div className="space-y-4">
      {list.data.map((h) => (
        <HelpItem key={h.id} h={h} caseId={caseId} when={fInstant(h.created_at)} />
      ))}
    </div>
  );
}

function HelpItem({
  h,
  caseId,
  when,
}: {
  h: { id: string; category: string; message: string; status: string; response: string | null };
  caseId: string;
  when: string | null;
}) {
  const [resp, setResp] = useState(h.response ?? "");
  const [status, setStatus] = useState(h.status);
  const m = useRpc("respond_help_request", [["help", caseId]]);
  return (
    <Section>
      <p className="font-semibold">
        {h.category} <span className="text-xs font-normal text-muted-foreground">· {when}</span>
      </p>
      <p className="text-sm">{h.message}</p>
      <form
        className="mt-3 space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          m.mutate({ _id: h.id, _status: status, _response: resp });
        }}
      >
        <Label htmlFor={`h-${h.id}`}>Response (applicant-visible)</Label>
        <Textarea id={`h-${h.id}`} value={resp} onChange={(e) => setResp(e.target.value)} />
        <div className="flex gap-2">
          <select
            aria-label="Status"
            className="rounded-md border bg-card p-2 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="open">Open</option>
            <option value="in_progress">In progress</option>
            <option value="resolved">Resolved</option>
          </select>
          <Button size="sm" type="submit">
            Save
          </Button>
        </div>
      </form>
    </Section>
  );
}

function NotesPanel({ caseId }: { caseId: string }) {
  const { fInstant } = useI18n();
  const list = useQuery({
    queryKey: ["notes", caseId],
    queryFn: () =>
      q(
        supabase
          .from("internal_notes")
          .select("*")
          .eq("case_id", caseId)
          .order("created_at", { ascending: false }),
      ),
  });
  const [body, setBody] = useState("");
  const m = useRpc("add_internal_note", [["notes", caseId]]);
  return (
    <Section title="Internal notes — NOT visible to the applicant">
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          m.mutate({ _case: caseId, _body: body }, { onSuccess: () => setBody("") });
        }}
      >
        <Textarea
          aria-label="Internal note"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <Button size="sm" type="submit" disabled={!body.trim()}>
          Save internal note
        </Button>
      </form>
      {list.error ? (
        <p className="mt-3 text-sm">Your assignment does not include internal notes.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {(list.data ?? []).map((n) => (
            <li key={n.id} className="rounded bg-muted p-2 text-sm">
              {n.body}
              <div className="text-xs text-muted-foreground">{fInstant(n.created_at)}</div>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function AssessPanel({ caseId }: { caseId: string }) {
  const m = useRpc("record_assessment");
  const [ca, setCa] = useState(false);
  const [cs, setCs] = useState(false);
  const [outcome, setOutcome] = useState("independent");
  const [base, setBase] = useState("");
  const [fol, setFol] = useState("");
  return (
    <div className="space-y-5">
      <Section title="Next-action understanding check">
        <p className="mb-2 text-sm text-muted-foreground">
          Ask the applicant what their next action is and where it came from. Record what you
          observed.
        </p>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={ca} onCheckedChange={(v) => setCa(v === true)} />
          Identified the correct action
        </label>
        <label className="mt-1 flex items-center gap-2 text-sm">
          <Checkbox checked={cs} onCheckedChange={(v) => setCs(v === true)} />
          Identified the correct source
        </label>
        <Button
          size="sm"
          className="mt-3"
          onClick={() =>
            m.mutate({
              _case: caseId,
              _kind: "comprehension",
              _correct_action: ca,
              _correct_source: cs,
              _outcome: null,
              _baseline: null,
              _followup: null,
            })
          }
        >
          Record check
        </Button>
      </Section>
      <Section title="Core-flow test">
        <select
          aria-label="Outcome"
          className={sel}
          value={outcome}
          onChange={(e) => setOutcome(e.target.value)}
        >
          <option value="independent">Independent success</option>
          <option value="assisted">Assisted success</option>
          <option value="failed">Not completed</option>
        </select>
        <Button
          size="sm"
          className="mt-3"
          onClick={() =>
            m.mutate({
              _case: caseId,
              _kind: "task_flow",
              _correct_action: null,
              _correct_source: null,
              _outcome: outcome,
              _baseline: null,
              _followup: null,
            })
          }
        >
          Record test
        </Button>
      </Section>
      <Section title="Paired practitioner task timing (seconds)">
        <div className="flex flex-wrap gap-2">
          <Input
            aria-label="Baseline seconds"
            className="w-40"
            type="number"
            placeholder="Baseline"
            value={base}
            onChange={(e) => setBase(e.target.value)}
          />
          <Input
            aria-label="With Protege seconds"
            className="w-40"
            type="number"
            placeholder="With Protege"
            value={fol}
            onChange={(e) => setFol(e.target.value)}
          />
        </div>
        <Button
          size="sm"
          className="mt-3"
          disabled={!base || !fol}
          onClick={() =>
            m.mutate({
              _case: caseId,
              _kind: "practitioner_timing",
              _correct_action: null,
              _correct_source: null,
              _outcome: null,
              _baseline: Number(base),
              _followup: Number(fol),
            })
          }
        >
          Record paired timing
        </Button>
      </Section>
    </div>
  );
}

function RemindersPanel({ caseId }: { caseId: string }) {
  const { fInstant } = useI18n();
  const list = useQuery({
    queryKey: ["outbox", caseId],
    queryFn: () =>
      q(
        supabase
          .from("reminder_outbox")
          .select("id, target_type, send_at, status, attempts, last_error, channel")
          .eq("case_id", caseId)
          .order("send_at", { ascending: false })
          .limit(50),
      ),
  });
  if (list.isLoading) return <Loading />;
  if (!list.data?.length)
    return (
      <Empty>
        No reminders scheduled. Reminders are created only from practitioner-confirmed dates.
      </Empty>
    );
  return (
    <Section title="Reminders (in-app)">
      <ul className="divide-y text-sm">
        {list.data.map((r) => (
          <li key={r.id} className="flex flex-wrap justify-between gap-2 py-2">
            <span>
              {r.target_type} · {fInstant(r.send_at)}
            </span>
            <span>
              <Pill
                variant={
                  r.status === "delivery_failed"
                    ? "danger"
                    : r.status === "delivered"
                      ? "success"
                      : "neutral"
                }
              >
                {r.status.replace(/_/g, " ")}
              </Pill>
              {r.last_error && (
                <span className="ml-2 text-xs text-destructive">{r.last_error}</span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </Section>
  );
}
