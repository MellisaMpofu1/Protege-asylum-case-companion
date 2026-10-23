#!/usr/bin/env python3
"""
Protege DEMO seed — development only.

Idempotent: re-running never duplicates rows (deterministic UUIDs + ON CONFLICT DO NOTHING).
Reads the synthetic workbook Protege_Simulated_Users_200.xlsx and maps its cohort IDs
(PGU/PGC) into two clearly labelled DEMO organisations. No real identities.

Usage (sandbox / dev machine with database access only):
  SEED_ALLOW=dev python3 scripts/seed_demo.py path/to/Protege_Simulated_Users_200.xlsx

Requires env: SUPABASE_DB_URL (psql), SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (to create
a handful of demo staff/applicant auth accounts). Refuses to run without SEED_ALLOW=dev.
Account credentials are written to the path in DEMO_ACCOUNTS_OUT (never into source).
"""
import json, os, secrets, subprocess, sys, uuid
import pandas as pd
import requests

if os.environ.get("SEED_ALLOW") != "dev":
    sys.exit("Refusing to seed: set SEED_ALLOW=dev (development only).")

XLSX = sys.argv[1] if len(sys.argv) > 1 else "Protege_Simulated_Users_200.xlsx"
NS = uuid.UUID("6f1d3b8e-7c2a-4e55-9a0b-70726f746567")
ORG_A = "00000000-0000-4000-8000-00000000d001"
ORG_B = "00000000-0000-4000-8000-00000000d002"


def uid(*parts):
    return str(uuid.uuid5(NS, ":".join(str(p) for p in parts)))


def q(v):
    if v is None or (isinstance(v, float) and pd.isna(v)) or (v is pd.NaT):
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int,)):
        return str(v)
    if isinstance(v, pd.Timestamp):
        return "'" + v.strftime("%Y-%m-%d %H:%M:%S") + "'"
    return "'" + str(v).replace("'", "''") + "'"


def ts(v):  # workbook timestamps are Europe/Lisbon wall time
    return "null" if pd.isna(v) else f"({q(pd.Timestamp(v))}::timestamp at time zone 'Europe/Lisbon')"


def d(v):
    return "null" if pd.isna(v) else q(pd.Timestamp(v).strftime("%Y-%m-%d")) + "::date"


x = pd.read_excel(XLSX, sheet_name=None)
users = x["Users_200"]
assert len(users) == 200, "expected exactly 200 synthetic applicants"
case_of = {r.user_id: uid("case", r.case_workspace_id) for r in users.itertuples()}
wave_of = {r.user_id: r.rollout_wave for r in users.itertuples()}

sql = ["begin;"]
sql.append(f"""insert into organisations(id,name,is_demo) values
 ('{ORG_A}','DEMO — Protege Simulation NGO',true),
 ('{ORG_B}','DEMO — Isolation Test Organisation',true) on conflict (id) do nothing;""")

STAGE = {
    "Practitioner-reviewed": ("practitioner_reviewed", "Interview recorded — awaiting next recorded update"),
    "Applicant-reported": ("applicant_reported", "Applicant reported a new letter"),
    "Linked correspondence": ("linked_correspondence", "Correspondence linked to case record"),
}
for r in users.itertuples():
    cid = case_of[r.user_id]
    src, stage = STAGE[r.record_source]
    lang = {"English": "English", "Portuguese": "Português"}.get(r.preferred_language, None)
    sql.append(
        f"insert into cases(id,org_id,cohort_ref,workspace_ref,display_label,procedure_path,stage,stage_source,stage_recorded_at,preferred_language,needs_language_assistance,rollout_wave,is_demo) values "
        f"('{cid}','{ORG_A}',{q(r.user_id)},{q(r.case_workspace_id)},{q('DEMO applicant ' + r.user_id)},'International protection — regular procedure',{q(stage)},'{src}',{ts(r.first_activity_at if not pd.isna(r.first_activity_at) else r.invited_at)},{q(lang)},{q(lang is None)},{q(r.rollout_wave)},true) on conflict (id) do nothing;"
    )
    # timeline: invitation + recorded update
    sql.append(
        f"insert into timeline_entries(id,case_id,title,body,source,review_state,recorded_at) values "
        f"('{uid('tl1', cid)}','{cid}','DEMO: Workspace opened by support organisation','Simulated record for demonstration only.','practitioner_reviewed','reviewed',{ts(r.invited_at)}),"
        f"('{uid('tl2', cid)}','{cid}',{q('DEMO: ' + stage)},'Simulated entry — not real correspondence.','{src}',"
        f"'{'reviewed' if src == 'practitioner_reviewed' else 'unreviewed'}',{ts(r.first_activity_at if not pd.isna(r.first_activity_at) else r.invited_at)}) on conflict (id) do nothing;"
    )
    if r.renewal_eligible:
        sql.append(
            f"insert into renewal_records(id,case_id,document_type,expiry_date,expiry_reviewed,prep_start_date,instructions,checklist) values "
            f"('{uid('ren', cid)}','{cid}','Applicant declaration (DEMO)',{d(pd.Timestamp(r.invited_at) + pd.Timedelta(days=120))},true,"
            f"{d(pd.Timestamp(r.invited_at) + pd.Timedelta(days=90))},'DEMO checklist reviewed by a simulated practitioner. Not an official renewal.',"
            f"'[{{\"label\":\"Check recorded expiry date with your caseworker\",\"done\":false}},{{\"label\":\"Gather identity document copy\",\"done\":false}}]'::jsonb) on conflict do nothing;"
        )
    if r.appointment_eligible:
        sql.append(
            f"insert into appointments(id,case_id,title,starts_at,confirmed,location,checklist,recap) values "
            f"('{uid('appt', cid)}','{cid}','DEMO interview preparation meeting',{ts(pd.Timestamp(r.invited_at) + pd.Timedelta(days=30, hours=1))},true,'DEMO NGO office, Lisbon',"
            f"'[{{\"label\":\"Bring recorded documents\",\"done\":false}},{{\"label\":\"Request an interpreter if needed\",\"done\":false}}]'::jsonb,"
            f"{q('DEMO recap: simulated summary reviewed by practitioner.' if r.recap_eligible else None)}) on conflict (id) do nothing;"
        )
    if r.document_eligible:
        sql.append(
            f"insert into documents(id,case_id,doc_type,safe_name,mime,size_bytes,source,review_state,is_sample) values "
            f"('{uid('doc', cid)}','{cid}','Sample','DEMO-sample-document.pdf','application/pdf',1024,'practitioner_reviewed','reviewed',true) on conflict (id) do nothing;"
        )

for r in x["Action Log"].itertuples():
    cid = case_of[r.user_id]
    status = "verified_complete" if r.completion_verified == 1 else ("reported_complete" if not pd.isna(r.completed_at) else "pending")
    sql.append(
        f"insert into actions(id,case_id,title,instruction,owner,source,due_date,due_confirmed,status,completed_on,outcome,verified_at,created_at) values "
        f"('{uid('act', r.action_id)}','{cid}',{q('DEMO: ' + r.action_category)},'Simulated action for demonstration.','applicant','practitioner_reviewed',"
        f"{d(r.confirmed_deadline)},{q(bool(r.deadline_confirmed))},'{status}',{d(r.completed_at)},{q(None if pd.isna(r.outcome) else r.outcome)},"
        f"{ts(r.completed_at) if status == 'verified_complete' else 'null'},{ts(r.created_at)}) on conflict (id) do nothing;"
    )

for r in x["Support Requests"].itertuples():
    st = {"Resolved": "resolved", "Open": "open"}.get(r.status, "in_progress")
    sql.append(
        f"insert into help_requests(id,case_id,category,message,status,created_at) values "
        f"('{uid('hr', r.request_id)}','{case_of[r.user_id]}',{q(r.category)},'DEMO help request (simulated).','{st}',{ts(r.requested_at)}) on conflict (id) do nothing;"
    )

for r in x["Reminders"].itertuples():
    st = "delivery_failed" if r.provider_status == "Failed" else ("delivered" if not pd.isna(r.opened_at) else "provider_accepted")
    sql.append(
        f"insert into reminder_outbox(case_id,target_type,target_id,send_at,idempotency_key,status,attempts,provider_accepted_at,opened_at,is_demo,cohort_ref) values "
        f"('{case_of[r.user_id]}','action','{uid('rmt', r.reminder_id)}',{ts(r.scheduled_at)},{q('demo:' + r.reminder_id)},'{st}',1,{ts(r.provider_accepted_at)},{ts(r.opened_at)},true,{q(r.rollout_wave)}) on conflict (idempotency_key) do nothing;"
    )

for r in x["Comprehension Checks"].itertuples():
    sql.append(
        f"insert into assessments(org_id,is_demo,pseudo_user,kind,correct_action,correct_source,cohort,external_ref,assessed_at) values "
        f"('{ORG_A}',true,{q(r.user_id)},'comprehension',{q(bool(r.correct_next_action))},{q(bool(r.correct_source))},{q(r.rollout_wave)},{q('demo:' + r.check_id)},{ts(r.assessed_at)}) on conflict (external_ref) do nothing;"
    )
for r in x["Task Results"].itertuples():
    o = "independent" if r.outcome == "Independent success" else ("assisted" if "ssist" in r.outcome else "failed")
    sql.append(
        f"insert into assessments(org_id,is_demo,pseudo_user,kind,outcome,cohort,external_ref,assessed_at) values "
        f"('{ORG_A}',true,{q(r.user_id)},'task_flow','{o}',{q(r.rollout_wave)},{q('demo:' + r.task_attempt_id)},{ts(r.finished_at)}) on conflict (external_ref) do nothing;"
    )
for r in x["Practitioner Tasks"].itertuples():
    sql.append(
        f"insert into assessments(org_id,is_demo,pseudo_user,kind,baseline_seconds,followup_seconds,paired,external_ref,assessed_at) values "
        f"('{ORG_A}',true,{q(r.practitioner_id)},'practitioner_timing',{int(r.baseline_seconds)},{int(r.protege_seconds)},{q(bool(r.same_scope_verified))},{q('demo:' + r.comparison_id)},{ts(r.measurement_at)}) on conflict (external_ref) do nothing;"
    )

EVMAP = {
    "cohort_invited": "invitation_sent", "account_login_success": "login", "onboarding_started": "onboarding_started",
    "onboarding_completed": "onboarding_completed", "dashboard_viewed": "dashboard_viewed", "case_timeline_viewed": "timeline_viewed",
    "next_action_viewed": "action_viewed", "document_viewed": "document_viewed", "document_list_viewed": "document_viewed",
    "document_upload_started": "upload_attempted", "document_upload_completed": "upload_completed", "document_upload_failed": "upload_failed",
    "appointment_viewed": "appointment_viewed", "renewal_info_viewed": "renewal_viewed", "support_contact_viewed": "support_viewed",
    "reviewed_guidance_viewed": "support_viewed", "help_requested": "help_requested", "reminder_scheduled": "reminder_scheduled",
    "reminder_provider_accepted": "reminder_accepted", "reminder_delivery_failed": "reminder_failed",
    "action_completion_recorded": "action_reported", "action_completion_verified": "action_verified",
}
rows = []
for r in x["Raw Data"].itertuples():
    ev = EVMAP.get(r.event)
    if not ev:
        continue
    rows.append(
        f"('{ORG_A}',true,{q(r.user_id)},'applicant','{ev}',{q(None if pd.isna(r.session_id) else r.session_id)},{q(None if pd.isna(r.object_id) else str(r.object_id))},"
        f"{q(r.rollout_wave)},{q(r.device)},{q(None if pd.isna(r.outcome) else str(r.outcome)[:40])},{q('demo:' + r.event_id)},{ts(r.timestamp)})"
    )
for i in range(0, len(rows), 500):
    sql.append(
        "insert into monitoring_events(org_id,is_demo,pseudo_user,role,event,session_id,object_id,cohort,device,outcome,dedupe_key,occurred_at) values "
        + ",".join(rows[i:i + 500]) + " on conflict (dedupe_key) do nothing;"
    )

# Isolation org: 3 synthetic workspaces
for n in range(1, 4):
    sql.append(
        f"insert into cases(id,org_id,workspace_ref,display_label,is_demo,stage,stage_source) values ('{uid('caseB', n)}','{ORG_B}','ISO{n:03d}','DEMO isolation applicant {n}',true,'DEMO isolation record','practitioner_reviewed') on conflict (id) do nothing;"
    )

# Demo resources & contacts (clearly simulated, not legal guidance)
sql.append(f"""insert into resources(id,org_id,title,summary,publisher,source_url,applicability,locale,last_reviewed_on,reviewer_name,status) values
 ('{uid('res', 1)}','{ORG_A}','DEMO: Where official information is published','Sample card for demonstration. Official information about residence and protection procedures is published by AIMA. Confirm anything important with your caseworker.','AIMA (official website)','https://aima.gov.pt','Demonstration only — not reviewed legal guidance.','en','2026-10-01','DEMO reviewer','published'),
 ('{uid('res', 2)}','{ORG_A}','DEMO: Onde é publicada a informação oficial','Cartão de exemplo para demonstração. A informação oficial é publicada pela AIMA. Confirme tudo o que for importante com o seu técnico.','AIMA (site oficial)','https://aima.gov.pt','Apenas demonstração — não é orientação jurídica revista.','pt-PT','2026-10-01','Revisor DEMO','published')
 on conflict (id) do nothing;""")
sql.append(f"""insert into support_contacts(id,org_id,name,role_label,phone,email,hours,is_external,verified) values
 ('{uid('con', 1)}','{ORG_A}','DEMO Caseworker Team','NGO caseworker (simulated)',null,'caseworkers@protege-demo.test','Mon–Fri 10:00–16:00 (Lisbon)',false,true)
 on conflict (id) do nothing;""")
sql.append("commit;")

out = "/tmp/protege_seed.sql"
open(out, "w").write("\n".join(sql))
subprocess.run(["psql", os.environ["SUPABASE_DB_URL"], "-v", "ON_ERROR_STOP=1", "-q", "-f", out], check=True)
print("seeded demo data")

# ---- demo auth accounts (few, real auth, random passwords) ----
URL = os.environ["SUPABASE_URL"].rstrip("/")
KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
H = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json"}
ACCOUNTS = [
    ("demo.admin@protege-demo.test", "admin", ORG_A, None),
    ("demo.practitioner@protege-demo.test", "practitioner", ORG_A, None),
    ("demo.applicant@protege-demo.test", "applicant", ORG_A, case_of["PGU0001"]),
    ("demo.isolation@protege-demo.test", "practitioner", ORG_B, None),
]
existing = {}
page = 1
while True:
    r = requests.get(f"{URL}/auth/v1/admin/users?page={page}&per_page=200", headers=H).json()
    us = r.get("users", [])
    for u in us:
        existing[u["email"]] = u["id"]
    if len(us) < 200:
        break
    page += 1

created = []
ids = {}
for email, role, org, case in ACCOUNTS:
    pw = secrets.token_urlsafe(14)
    if email in existing:
        ids[email] = existing[email]
        if os.environ.get("RESET_PASSWORDS") != "1":
            continue
        requests.put(f"{URL}/auth/v1/admin/users/{ids[email]}", headers=H, json={"password": pw}).raise_for_status()
    else:
        r = requests.post(f"{URL}/auth/v1/admin/users", headers=H, json={"email": email, "password": pw, "email_confirm": True})
        r.raise_for_status()
        ids[email] = r.json()["id"]
    created.append((email, role, pw))
    outp = os.environ.get("DEMO_ACCOUNTS_OUT")
    if outp:
        with open(outp, "a") as f:
            f.write(f"- {role}: {email} / {pw}\n")

# Link accounts through the service REST API (idempotent)
R = f"{URL}/rest/v1"
UP = {**H, "Prefer": "resolution=ignore-duplicates,return=minimal"}


def post(table, rows, on_conflict=None):
    url = f"{R}/{table}" + (f"?on_conflict={on_conflict}" if on_conflict else "")
    requests.post(url, headers=UP, json=rows).raise_for_status()


for email, role, org, case in ACCOUNTS:
    u = ids[email]
    post("profiles", [{"id": u, "display_name": "DEMO " + role}], "id")
    if role == "applicant":
        requests.patch(f"{R}/cases?id=eq.{case}&applicant_user_id=is.null", headers=H, json={"applicant_user_id": u}).raise_for_status()
    else:
        post("memberships", [{"org_id": org, "user_id": u, "role": role}], "org_id,user_id,role")


def grant_all(user, cases):
    have = {g["case_id"] for g in requests.get(f"{R}/case_grants?user_id=eq.{user}&revoked_at=is.null&select=case_id", headers=H).json()}
    rows = [{"case_id": c, "user_id": user} for c in cases if c not in have]
    if rows:
        post("case_grants", rows)


grant_all(ids["demo.practitioner@protege-demo.test"], [case_of[f"PGU{n:04d}"] for n in range(1, 41)])
grant_all(ids["demo.isolation@protege-demo.test"], [uid("caseB", n) for n in range(1, 4)])
print("accounts written:", [c[0] for c in created])
