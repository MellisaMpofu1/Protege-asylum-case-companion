import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Empty, ErrorState, Loading, PageHeader, Pill, Section } from "@/components/protege/ui";
import { useI18n } from "@/lib/i18n";
import { roles, useAppCtx } from "@/lib/session";
import { pageHead, q, useRpc } from "@/lib/mutate";
import { useServerFn } from "@tanstack/react-start";
import { resendInvitation, sendInvitation } from "@/lib/invitations.functions";

export const Route = createFileRoute("/_authenticated/_staff/admin/")({
  head: pageHead("Administration"),
  component: Admin,
});

const sel = "rounded-md border bg-card p-2 text-sm";

export function useAdminOrg() {
  const ctx = useAppCtx();
  const orgs = roles(ctx.data).adminOrgs;
  const [org, setOrg] = useState<string | null>(null);
  const current = orgs.find((o) => o.org_id === org) ?? orgs[0];
  const picker = orgs.length > 1 && (
    <select
      aria-label="Organisation"
      className={sel}
      value={current?.org_id ?? ""}
      onChange={(e) => setOrg(e.target.value)}
    >
      {orgs.map((o) => (
        <option key={o.org_id} value={o.org_id}>
          {o.org_name}
        </option>
      ))}
    </select>
  );
  return { ctx, current, picker };
}

function Admin() {
  const { ctx, current, picker } = useAdminOrg();
  if (ctx.isLoading) return <Loading />;
  if (!current) return <Empty>You are not an administrator of any organisation.</Empty>;
  const org = current.org_id;
  return (
    <div className="space-y-5">
      <PageHeader title="Administration">{picker}</PageHeader>
      <p className="text-sm text-muted-foreground">
        {current.org_name}
        {current.is_demo && " · DEMO organisation"}. Administration does not grant access to case
        narratives, internal notes or documents — assign yourself as a practitioner per case for
        that.
      </p>
      <Tabs defaultValue="invites">
        <TabsList className="flex h-auto flex-wrap justify-start">
          {(
            [
              ["invites", "Invitations"],
              ["members", "Members"],
              ["cases", "Cases & access"],
              ["resources", "Information"],
              ["contacts", "Contacts"],
              ["failures", "Failures"],
              ["requests", "Data requests"],
              ["audit", "Audit"],
            ] as [string, string][]
          ).map(([v, l]) => (
            <TabsTrigger key={v} value={v}>
              {l}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="invites">
          <Invites org={org} />
        </TabsContent>
        <TabsContent value="members">
          <Members org={org} />
        </TabsContent>
        <TabsContent value="cases">
          <Cases org={org} />
        </TabsContent>
        <TabsContent value="resources">
          <Resources org={org} />
        </TabsContent>
        <TabsContent value="contacts">
          <Contacts org={org} />
        </TabsContent>
        <TabsContent value="failures">
          <Failures org={org} />
        </TabsContent>
        <TabsContent value="requests">
          <DataRequests org={org} />
        </TabsContent>
        <TabsContent value="audit">
          <Audit org={org} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function useCases(org: string) {
  return useQuery({
    queryKey: ["admincases", org],
    queryFn: () =>
      q(
        supabase
          .from("cases")
          .select("id, display_label, workspace_ref, applicant_user_id")
          .eq("org_id", org)
          .order("workspace_ref")
          .limit(1000),
      ),
  });
}

function Invites({ org }: { org: string }) {
  const { fInstant } = useI18n();
  const list = useQuery({
    queryKey: ["invites", org],
    queryFn: () =>
      q(
        supabase
          .from("invitations")
          .select("id, email, role, status, expires_at, case_id, case_ids, created_at, send_status, sent_at")
          .eq("org_id", org)
          .order("created_at", { ascending: false })
          .limit(100),
      ),
  });
  const cases = useCases(org);
  const revoke = useRpc("revoke_invitation", [["invites", org]]);
  const send = useServerFn(sendInvitation);
  const resend = useServerFn(resendInvitation);
  const [kind, setKind] = useState<"applicant" | "practitioner" | "admin">("applicant");
  const [email, setEmail] = useState("");
  const [caseId, setCaseId] = useState("");
  const [caseIds, setCaseIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const errText: Record<string, string> = {
    invalid_case: "Choose a workspace without an applicant or pending invitation.",
    already_pending: "This email already has a pending invitation. Use Resend instead.",
    rate_limited: "Too many sends. Wait a minute and try again.",
    invalid_email: "Enter a valid email address.",
    forbidden: "You do not have permission to do this.",
    forbidden_origin: "Sending is only allowed from the Protege site.",
    invitation_not_pending: "This invitation is no longer pending.",
  };
  function report(r: { ok: boolean; error?: string }) {
    if (r.ok) toast.success("Email accepted by the sending service. Delivery to the inbox is not confirmed.");
    else toast.error(r.error === "rate_limited" ? "The email service limit was reached. Try again later." : "The invitation was saved but the email could not be sent. Use Resend.");
    list.refetch();
    cases.refetch();
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      report(await send({ data: { org, email, role: kind, caseId: kind === "applicant" ? caseId : null, caseIds: kind === "practitioner" ? caseIds : [] } }));
      setEmail("");
      setCaseId("");
      setCaseIds([]);
    } catch (err) {
      toast.error(errText[(err as Error).message] ?? "Could not send the invitation.");
    } finally {
      setBusy(false);
    }
  }
  async function createWorkspace() {
    if (!newLabel.trim()) return undefined;
    const { data, error } = await supabase.rpc("create_case", { _org: org, _label: newLabel.trim(), _procedure: null as unknown as string });
    if (error) return toast.error("Could not create the workspace.");
    setNewLabel("");
    await cases.refetch();
    setCaseId(data as string);
    return undefined;
  }
  async function doResend(id: string) {
    try {
      report(await resend({ data: { id } }));
    } catch (err) {
      toast.error(errText[(err as Error).message] ?? "Could not resend.");
    }
  }
  const free = (cases.data ?? []).filter((c) => !c.applicant_user_id);
  return (
    <div className="space-y-5">
      <Section title="Invite someone">
        <div role="radiogroup" aria-label="Invitation type" className="mb-4 flex flex-wrap gap-2">
          {([
            ["applicant", "Invite Applicant"],
            ["practitioner", "Invite Caseworker"],
            ["admin", "Invite Administrator"],
          ] as const).map(([v, l]) => (
            <Button key={v} type="button" role="radio" aria-checked={kind === v} variant={kind === v ? "default" : "outline"} onClick={() => setKind(v)}>
              {l}
            </Button>
          ))}
        </div>
        <form className="space-y-4" onSubmit={submit}>
          <div className="max-w-md space-y-1.5">
            <Label htmlFor="ie">Email</Label>
            <Input id="ie" type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          {kind === "applicant" && (
            <div className="space-y-2">
              <Label htmlFor="ic">Case workspace (exactly one)</Label>
              <select id="ic" className={`${sel} w-full max-w-md`} value={caseId} onChange={(e) => setCaseId(e.target.value)} required>
                <option value="">—</option>
                {free.map((c) => (
                  <option key={c.id} value={c.id}>{c.workspace_ref ?? c.display_label}</option>
                ))}
              </select>
              <div className="flex max-w-md flex-wrap gap-2">
                <Input aria-label="New synthetic workspace label" placeholder="Or create a new workspace label" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} className="min-w-0 flex-1" />
                <Button type="button" variant="outline" onClick={createWorkspace} disabled={!newLabel.trim()}>Create workspace</Button>
              </div>
            </div>
          )}
          {kind === "practitioner" && (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Assigned cases ({caseIds.length})</legend>
              <div className="max-h-56 overflow-y-auto rounded-md border p-2">
                {(cases.data ?? []).slice(0, 300).map((c) => (
                  <label key={c.id} className="flex items-center gap-2 py-1 text-sm">
                    <Checkbox checked={caseIds.includes(c.id)} onCheckedChange={(v) => setCaseIds((xs) => (v === true ? [...xs, c.id] : xs.filter((x) => x !== c.id)))} />
                    {c.workspace_ref ?? c.display_label}
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Caseworkers only see the cases you tick. They do not get administrator rights.</p>
            </fieldset>
          )}
          {kind === "admin" && <p className="text-sm text-muted-foreground">Administrators manage people and monitoring. They do not see case content unless also assigned as caseworker.</p>}
          <Button type="submit" disabled={busy || !email || (kind === "applicant" && !caseId)}>
            {busy ? "Sending…" : "Send invitation email"}
          </Button>
        </form>
        <p className="mt-3 text-xs text-muted-foreground">
          The email contains a one-time sign-in link that expires. "Sent" means the email service accepted it; it does not confirm the person received it.
        </p>
      </Section>
      <Section title="Invitations">
        {list.isLoading ? (
          <Loading />
        ) : !list.data?.length ? (
          <Empty>No invitations yet.</Empty>
        ) : (
          <ul className="divide-y text-sm">
            {list.data.map((i) => {
              const expired = i.status === "pending" && new Date(i.expires_at) < new Date();
              const state = i.status !== "pending" ? i.status : expired ? "expired" : i.send_status === "send_failed" ? "sending failed" : i.send_status === "provider_accepted" ? "pending · email sent" : "pending · not sent";
              const ws = i.case_id ? cases.data?.find((c) => c.id === i.case_id) : null;
              return (
                <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="min-w-0 break-all">
                    {i.email} · {i.role === "practitioner" ? "caseworker" : i.role}
                    {ws && ` · ${ws.workspace_ref ?? ws.display_label}`}
                    {i.role === "practitioner" && ` · ${i.case_ids?.length ?? 0} cases`}
                  </span>
                  <span className="flex flex-wrap items-center gap-2">
                    <Pill variant={i.status === "accepted" ? "success" : i.send_status === "send_failed" && i.status === "pending" ? "warning" : i.status === "revoked" || expired ? "neutral" : "info"}>{state}</Pill>
                    <span className="text-xs text-muted-foreground">{fInstant(i.sent_at ?? i.created_at)}</span>
                    {i.status === "pending" && (
                      <Button size="sm" variant="outline" onClick={() => doResend(i.id)}>Resend</Button>
                    )}
                    {i.status === "pending" && (
                      <Button size="sm" variant="ghost" onClick={() => revoke.mutate({ _id: i.id })}>Revoke</Button>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Section>
    </div>
  );
}

function useMembers(org: string) {
  return useQuery({
    queryKey: ["members", org],
    queryFn: async () => {
      const ms = await q(
        supabase.from("memberships").select("id, user_id, role").eq("org_id", org),
      );
      const ids = [...new Set(ms.map((m) => m.user_id))];
      const ps = ids.length
        ? await q(supabase.from("profiles").select("id, display_name").in("id", ids))
        : [];
      return ms.map((m) => ({
        ...m,
        name: ps.find((p) => p.id === m.user_id)?.display_name ?? m.user_id.slice(0, 8),
      }));
    },
  });
}

function Members({ org }: { org: string }) {
  const list = useMembers(org);
  const remove = useRpc("remove_membership", [["members", org]]);
  const add = useRpc("add_membership_role", [["members", org]]);
  if (list.isLoading) return <Loading />;
  if (list.error) return <ErrorState error={list.error} onRetry={() => list.refetch()} />;
  const admins = list.data!.filter((m) => m.role === "admin").length;
  return (
    <Section title="Members">
      <ul className="divide-y text-sm">
        {list.data!.map((m) => (
          <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <span>
              {m.name} · <Pill>{m.role}</Pill>
            </span>
            <span className="flex gap-2">
              {m.role === "practitioner" &&
                !list.data!.some((x) => x.user_id === m.user_id && x.role === "admin") && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => add.mutate({ _org: org, _user: m.user_id, _role: "admin" })}
                  >
                    Make admin
                  </Button>
                )}
              {m.role === "admin" &&
                !list.data!.some((x) => x.user_id === m.user_id && x.role === "practitioner") && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      add.mutate({ _org: org, _user: m.user_id, _role: "practitioner" })
                    }
                  >
                    Add practitioner role
                  </Button>
                )}
              <Button
                size="sm"
                variant="ghost"
                disabled={m.role === "admin" && admins <= 1}
                title={
                  m.role === "admin" && admins <= 1
                    ? "The last administrator cannot be removed"
                    : undefined
                }
                onClick={() => remove.mutate({ _id: m.id })}
              >
                Remove {m.role}
              </Button>
            </span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function Cases({ org }: { org: string }) {
  const cases = useCases(org);
  const members = useMembers(org);
  const grants = useQuery({
    queryKey: ["grants", org],
    queryFn: () =>
      q(
        supabase
          .from("case_grants")
          .select("id, case_id, user_id, can_view_documents, can_view_internal, revoked_at")
          .is("revoked_at", null),
      ),
  });
  const grant = useRpc("grant_case_access", [["grants", org]]);
  const revoke = useRpc("revoke_case_access", [["grants", org]]);
  const create = useRpc("create_case", [["admincases", org]]);
  const [filter, setFilter] = useState("");
  const [label, setLabel] = useState("");
  const [sel1, setSel1] = useState("");
  const [user, setUser] = useState("");
  const [docs, setDocs] = useState(true);
  const [internal, setInternal] = useState(true);
  if (cases.isLoading || members.isLoading) return <Loading />;
  const pracs = (members.data ?? []).filter((m) => m.role === "practitioner");
  const shown = (cases.data ?? [])
    .filter(
      (c) =>
        !filter ||
        (c.workspace_ref ?? c.display_label).toLowerCase().includes(filter.toLowerCase()),
    )
    .slice(0, 50);
  const nameOf = (u: string) => members.data?.find((m) => m.user_id === u)?.name ?? u.slice(0, 8);
  return (
    <div className="space-y-5">
      <Section title="Create a case workspace">
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate(
              { _org: org, _label: label, _procedure: null },
              { onSuccess: () => setLabel("") },
            );
          }}
        >
          <Input
            aria-label="Workspace label"
            className="max-w-xs"
            placeholder="Workspace label (no sensitive details)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <Button type="submit" disabled={!label.trim()}>
            Create
          </Button>
        </form>
        <p className="mt-2 text-xs text-muted-foreground">
          Then invite the applicant from the Invitations tab. One primary applicant per workspace.
        </p>
      </Section>
      <Section title="Assign case access">
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            grant.mutate({ _case: sel1, _user: user, _docs: docs, _internal: internal });
          }}
        >
          <select
            aria-label="Case"
            className={sel}
            value={sel1}
            onChange={(e) => setSel1(e.target.value)}
          >
            <option value="">Case…</option>
            {(cases.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.workspace_ref ?? c.display_label}
              </option>
            ))}
          </select>
          <select
            aria-label="Practitioner"
            className={sel}
            value={user}
            onChange={(e) => setUser(e.target.value)}
          >
            <option value="">Practitioner…</option>
            {pracs.map((p) => (
              <option key={p.user_id} value={p.user_id}>
                {p.name}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={docs} onCheckedChange={(v) => setDocs(v === true)} />
            Can view documents
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={internal} onCheckedChange={(v) => setInternal(v === true)} />
            Can view internal notes
          </label>
          <div>
            <Button type="submit" disabled={!sel1 || !user}>
              Grant access
            </Button>
          </div>
        </form>
      </Section>
      <Section title="Cases">
        <Input
          aria-label="Filter cases"
          className="mb-3 max-w-xs"
          placeholder="Filter by workspace ID"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <ul className="divide-y text-sm">
          {shown.map((c) => {
            const gs = (grants.data ?? []).filter((g) => g.case_id === c.id);
            return (
              <li key={c.id} className="py-2">
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="font-semibold">{c.workspace_ref ?? c.display_label}</span>
                  <span className="text-xs">
                    {c.applicant_user_id ? "Applicant linked" : "No applicant yet"}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap gap-2">
                  {gs.length === 0 ? (
                    <span className="text-xs text-muted-foreground">No practitioner assigned</span>
                  ) : (
                    gs.map((g) => (
                      <span key={g.id} className="inline-flex items-center gap-1">
                        <Pill>
                          {nameOf(g.user_id)}
                          {g.can_view_documents ? " · docs" : ""}
                          {g.can_view_internal ? " · notes" : ""}
                        </Pill>
                        <button
                          className="text-xs text-destructive underline"
                          onClick={() => revoke.mutate({ _grant: g.id })}
                        >
                          revoke
                        </button>
                      </span>
                    ))
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        {(cases.data?.length ?? 0) > 50 && (
          <p className="mt-2 text-xs text-muted-foreground">
            Showing first 50 matches. Use the filter.
          </p>
        )}
      </Section>
    </div>
  );
}

function Resources({ org }: { org: string }) {
  const { fDate } = useI18n();
  const list = useQuery({
    queryKey: ["resources", org],
    queryFn: () =>
      q(
        supabase
          .from("resources")
          .select("*")
          .eq("org_id", org)
          .order("created_at", { ascending: false }),
      ),
  });
  const cat = useRpc("set_resource_category", [["resources", org]]);
  const m = useRpc("upsert_resource", [["resources", org]]);
  const empty = {
    id: null as string | null,
    title: "",
    summary: "",
    publisher: "",
    url: "",
    applicability: "",
    locale: "en",
    reviewed: "",
    reviewer: "",
    status: "draft",
  };
  const [f, setF] = useState(empty);
  return (
    <div className="space-y-5">
      <Section title={f.id ? "Edit information card" : "Add information card"}>
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            m.mutate(
              {
                _id: f.id,
                _org: org,
                _title: f.title,
                _summary: f.summary,
                _publisher: f.publisher,
                _url: f.url,
                _applicability: f.applicability,
                _locale: f.locale,
                _reviewed: f.reviewed || null,
                _reviewer: f.reviewer,
                _status: f.status,
              },
              { onSuccess: () => setF(empty) },
            );
          }}
        >
          <Input
            aria-label="Title"
            placeholder="Title"
            value={f.title}
            onChange={(e) => setF({ ...f, title: e.target.value })}
          />
          <Input
            aria-label="Publisher"
            placeholder="Publisher"
            value={f.publisher}
            onChange={(e) => setF({ ...f, publisher: e.target.value })}
          />
          <Textarea
            aria-label="Summary"
            className="sm:col-span-2"
            placeholder="Concise guidance (reviewed)"
            value={f.summary}
            onChange={(e) => setF({ ...f, summary: e.target.value })}
          />
          <Input
            aria-label="Official source URL"
            placeholder="https://…"
            value={f.url}
            onChange={(e) => setF({ ...f, url: e.target.value })}
          />
          <Input
            aria-label="Applicability"
            placeholder="Applies to / limits"
            value={f.applicability}
            onChange={(e) => setF({ ...f, applicability: e.target.value })}
          />
          <Input
            aria-label="Last reviewed"
            type="date"
            value={f.reviewed}
            onChange={(e) => setF({ ...f, reviewed: e.target.value })}
          />
          <Input
            aria-label="Reviewer"
            placeholder="Responsible reviewer"
            value={f.reviewer}
            onChange={(e) => setF({ ...f, reviewer: e.target.value })}
          />
          <select
            aria-label="Language"
            className={sel}
            value={f.locale}
            onChange={(e) => setF({ ...f, locale: e.target.value })}
          >
            <option value="en">English</option>
            <option value="pt-PT">Português</option>
          </select>
          <select
            aria-label="Status"
            className={sel}
            value={f.status}
            onChange={(e) => setF({ ...f, status: e.target.value })}
          >
            <option value="draft">Draft</option>
            <option value="needs_review">Needs re-review</option>
            <option value="published">Published (applicant-visible)</option>
          </select>
          <div className="flex gap-2">
            <Button type="submit" disabled={!f.title || !f.summary || !f.publisher}>
              Save
            </Button>
            {f.id && (
              <Button type="button" variant="ghost" onClick={() => setF(empty)}>
                Cancel
              </Button>
            )}
          </div>
        </form>
      </Section>
      <Section title="Information cards">
        {!list.data?.length ? (
          <Empty>No cards yet.</Empty>
        ) : (
          <ul className="divide-y text-sm">
            {list.data.map((r) => {
              const stale =
                r.last_reviewed_on &&
                new Date(r.last_reviewed_on) < new Date(Date.now() - 180 * 864e5);
              return (
                <li key={r.id} className="flex flex-wrap justify-between gap-2 py-2">
                  <span>
                    {r.title} · {r.locale} · reviewed {fDate(r.last_reviewed_on) ?? "never"}
                  </span>
                  <span className="flex gap-2">
                    <select aria-label="Pillar" className={sel} value={(r as { category?: string }).category ?? "rights"} onChange={(e) => cat.mutate({ _id: r.id, _category: e.target.value })}>
                      <option value="rights">My Rights</option>
                      <option value="life">My Life in Portugal</option>
                    </select>
                    <Pill variant={r.status === "published" ? "success" : "warning"}>
                      {r.status}
                    </Pill>
                    {stale && <Pill variant="danger">Re-review due</Pill>}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setF({
                          id: r.id,
                          title: r.title,
                          summary: r.summary,
                          publisher: r.publisher,
                          url: r.source_url ?? "",
                          applicability: r.applicability ?? "",
                          locale: r.locale,
                          reviewed: r.last_reviewed_on ?? "",
                          reviewer: r.reviewer_name ?? "",
                          status: r.status,
                        })
                      }
                    >
                      Edit
                    </Button>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Section>
    </div>
  );
}

function Contacts({ org }: { org: string }) {
  const list = useQuery({
    queryKey: ["contacts", org],
    queryFn: () => q(supabase.from("support_contacts").select("*").eq("org_id", org)),
  });
  const m = useRpc("upsert_contact", [["contacts", org]]);
  const [f, setF] = useState({
    name: "",
    role: "",
    phone: "",
    email: "",
    hours: "",
    external: false,
    verified: false,
  });
  return (
    <div className="space-y-5">
      <Section title="Add support contact">
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            m.mutate({
              _id: null,
              _org: org,
              _name: f.name,
              _role_label: f.role,
              _phone: f.phone || null,
              _email: f.email || null,
              _hours: f.hours || null,
              _external: f.external,
              _verified: f.verified,
            });
          }}
        >
          <Input
            aria-label="Name"
            placeholder="Name"
            value={f.name}
            onChange={(e) => setF({ ...f, name: e.target.value })}
          />
          <Input
            aria-label="Role"
            placeholder="Role (e.g. caseworker)"
            value={f.role}
            onChange={(e) => setF({ ...f, role: e.target.value })}
          />
          <Input
            aria-label="Phone"
            placeholder="Phone"
            value={f.phone}
            onChange={(e) => setF({ ...f, phone: e.target.value })}
          />
          <Input
            aria-label="Email"
            placeholder="Email"
            value={f.email}
            onChange={(e) => setF({ ...f, email: e.target.value })}
          />
          <Input
            aria-label="Hours"
            placeholder="Hours"
            value={f.hours}
            onChange={(e) => setF({ ...f, hours: e.target.value })}
          />
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={f.external}
              onCheckedChange={(v) => setF({ ...f, external: v === true })}
            />
            External service
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={f.verified}
              onCheckedChange={(v) => setF({ ...f, verified: v === true })}
            />
            Verified handoff
          </label>
          <div>
            <Button type="submit" disabled={!f.name || !f.role}>
              Save
            </Button>
          </div>
        </form>
      </Section>
      <Section title="Contacts">
        {!list.data?.length ? (
          <Empty>No contacts.</Empty>
        ) : (
          <ul className="text-sm">
            {list.data.map((c) => (
              <li key={c.id}>
                {c.name} · {c.role_label}{" "}
                {c.verified ? <Pill variant="success">verified</Pill> : <Pill>unverified</Pill>}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function Failures({ org }: { org: string }) {
  const { fInstant } = useI18n();
  const list = useQuery({
    queryKey: ["failures", org],
    queryFn: async () => {
      const cs = await q(
        supabase.from("cases").select("id, workspace_ref").eq("org_id", org).limit(1000),
      );
      const ids = cs.map((c) => c.id);
      if (!ids.length) return [];
      const rows = await q(
        supabase
          .from("reminder_outbox")
          .select("id, case_id, target_type, send_at, status, attempts, last_error")
          .in("case_id", ids)
          .eq("status", "delivery_failed")
          .order("send_at", { ascending: false })
          .limit(100),
      );
      return rows.map((r) => ({ ...r, ref: cs.find((c) => c.id === r.case_id)?.workspace_ref }));
    },
  });
  if (list.isLoading) return <Loading />;
  return (
    <Section title="Reminder delivery failures">
      {!list.data?.length ? (
        <Empty>No failures.</Empty>
      ) : (
        <ul className="divide-y text-sm">
          {list.data.map((r) => (
            <li key={r.id} className="py-2">
              {r.ref} · {r.target_type} · {fInstant(r.send_at)} · {r.attempts} attempts{" "}
              {r.last_error && `· ${r.last_error}`}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function DataRequests({ org }: { org: string }) {
  const { fInstant } = useI18n();
  const list = useQuery({
    queryKey: ["dreqs", org],
    queryFn: async () => {
      const cs = await q(
        supabase.from("cases").select("id, workspace_ref").eq("org_id", org).limit(1000),
      );
      const rows = await q(
        supabase
          .from("data_requests")
          .select("*")
          .in(
            "case_id",
            cs.map((c) => c.id),
          )
          .order("created_at", { ascending: false }),
      );
      return rows.map((r) => ({ ...r, ref: cs.find((c) => c.id === r.case_id)?.workspace_ref }));
    },
  });
  const m = useRpc("review_data_request", [["dreqs", org]]);
  if (list.isLoading) return <Loading />;
  return (
    <Section title="Export and deletion requests">
      <p className="mb-3 text-xs text-muted-foreground">
        Review each request against your retention obligations. Marking a request completed does not
        delete records automatically.
      </p>
      {!list.data?.length ? (
        <Empty>No requests.</Empty>
      ) : (
        <ul className="divide-y text-sm">
          {list.data.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>
                {r.ref} · {r.kind} · {fInstant(r.created_at)}
                {r.notes && ` — ${r.notes}`}
              </span>
              <select
                aria-label="Status"
                className={sel}
                value={r.status}
                onChange={(e) =>
                  m.mutate({ _id: r.id, _status: e.target.value, _notes: r.review_notes })
                }
              >
                {["submitted", "under_review", "completed", "declined"].map((s) => (
                  <option key={s} value={s}>
                    {s.replace("_", " ")}
                  </option>
                ))}
              </select>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function Audit({ org }: { org: string }) {
  const { fInstant } = useI18n();
  const list = useQuery({
    queryKey: ["audit", org],
    queryFn: () =>
      q(
        supabase
          .from("audit_log")
          .select("id, action, record_type, record_id, at, actor_id, case_id")
          .eq("org_id", org)
          .order("at", { ascending: false })
          .limit(100),
      ),
  });
  if (list.isLoading) return <Loading />;
  return (
    <Section title="Recent audit records (read-only)">
      {!list.data?.length ? (
        <Empty>No records.</Empty>
      ) : (
        <ul className="divide-y font-mono text-xs">
          {list.data.map((a) => (
            <li key={a.id} className="py-1.5">
              {fInstant(a.at)} · {a.action} {a.record_type} {a.record_id?.slice(0, 8)} · actor{" "}
              {a.actor_id?.slice(0, 8) ?? "system"}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
