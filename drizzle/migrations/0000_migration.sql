
-- ===== ENUMS =====
create type public.org_role as enum ('admin','practitioner');
create type public.provenance as enum ('applicant_reported','practitioner_reviewed','linked_correspondence','officially_synchronised');
create type public.review_state as enum ('unreviewed','reviewed','corrected');
create type public.action_status as enum ('pending','reported_complete','verified_complete','cancelled');
create type public.help_status as enum ('open','in_progress','resolved');
create type public.invite_role as enum ('applicant','practitioner','admin');
create type public.invite_status as enum ('pending','accepted','revoked');
create type public.outbox_status as enum ('scheduled','provider_accepted','delivery_failed','delivered','cancelled');

-- ===== TABLES =====
create table public.organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key,
  display_name text,
  ui_locale text not null default 'en' check (ui_locale in ('en','pt-PT')),
  preferred_language text,
  needs_language_assistance boolean not null default false,
  email_notifications boolean not null default false,
  policy_version text,
  policy_ack_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  user_id uuid not null,
  role public.org_role not null,
  created_at timestamptz not null default now(),
  unique (org_id, user_id, role)
);
create index on public.memberships(user_id);

create table public.cases (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  applicant_user_id uuid unique,
  cohort_ref text,
  workspace_ref text,
  display_label text not null,
  procedure_path text,
  stage text,
  stage_source public.provenance,
  stage_recorded_at timestamptz,
  preferred_language text,
  needs_language_assistance boolean not null default false,
  rollout_wave text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  unique (org_id, workspace_ref)
);
create index on public.cases(org_id);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  email text not null,
  role public.invite_role not null,
  case_id uuid references public.cases(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  status public.invite_status not null default 'pending',
  accepted_by uuid,
  accepted_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index on public.invitations(org_id);

create table public.case_grants (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  user_id uuid not null,
  can_view_documents boolean not null default true,
  can_view_internal boolean not null default true,
  granted_by uuid,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index on public.case_grants(user_id) where revoked_at is null;
create index on public.case_grants(case_id);
create unique index case_grants_active_uniq on public.case_grants(case_id,user_id) where revoked_at is null;

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  doc_type text not null,
  safe_name text not null,
  storage_path text,
  mime text not null,
  size_bytes integer not null,
  uploaded_by uuid,
  source public.provenance not null default 'applicant_reported',
  review_state public.review_state not null default 'unreviewed',
  expiry_date date,
  is_sample boolean not null default false,
  removal_requested boolean not null default false,
  action_id uuid,
  created_at timestamptz not null default now()
);
create index on public.documents(case_id);

create table public.timeline_entries (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  title text not null,
  body text,
  source public.provenance not null,
  review_state public.review_state not null default 'unreviewed',
  author_id uuid,
  linked_document_id uuid references public.documents(id) on delete set null,
  correction_requested boolean not null default false,
  correction_note text,
  version integer not null default 1,
  recorded_at timestamptz not null default now(),
  reviewed_by uuid,
  reviewed_at timestamptz
);
create index on public.timeline_entries(case_id, recorded_at desc);

create table public.timeline_revisions (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.timeline_entries(id) on delete cascade,
  case_id uuid not null references public.cases(id) on delete cascade,
  version integer not null,
  title text not null,
  body text,
  source public.provenance not null,
  review_state public.review_state not null,
  changed_by uuid,
  reason text,
  changed_at timestamptz not null default now()
);
create index on public.timeline_revisions(entry_id);

create table public.actions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  title text not null,
  instruction text,
  owner text not null default 'applicant' check (owner in ('applicant','practitioner')),
  source public.provenance not null default 'practitioner_reviewed',
  due_date date,
  due_confirmed boolean not null default false,
  document_id uuid references public.documents(id) on delete set null,
  requests_document boolean not null default false,
  status public.action_status not null default 'pending',
  completed_on date,
  outcome text,
  reported_at timestamptz,
  verified_by uuid,
  verified_at timestamptz,
  cancel_reason text,
  version integer not null default 1,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index on public.actions(case_id);
alter table public.documents add constraint documents_action_fk foreign key (action_id) references public.actions(id) on delete set null;

create table public.action_events (
  id uuid primary key default gen_random_uuid(),
  action_id uuid not null references public.actions(id) on delete cascade,
  case_id uuid not null references public.cases(id) on delete cascade,
  kind text not null,
  note text,
  actor_id uuid,
  at timestamptz not null default now()
);
create index on public.action_events(action_id);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  title text not null,
  starts_at timestamptz,
  confirmed boolean not null default false,
  location text,
  remote_link text,
  support_user_id uuid,
  checklist jsonb not null default '[]'::jsonb,
  document_ids uuid[] not null default '{}',
  change_request text,
  recap text,
  recap_reviewed_by uuid,
  recap_reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.appointments(case_id);

create table public.renewal_records (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null unique references public.cases(id) on delete cascade,
  document_type text not null,
  expiry_date date,
  expiry_reviewed boolean not null default false,
  prep_start_date date,
  instructions text,
  checklist jsonb not null default '[]'::jsonb,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.correspondence (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  kind text not null,
  summary text not null,
  occurred_on date,
  recorded_by uuid,
  created_at timestamptz not null default now()
);
create index on public.correspondence(case_id);

create table public.resources (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  title text not null,
  summary text not null,
  publisher text not null,
  source_url text,
  applicability text,
  locale text not null default 'en',
  last_reviewed_on date,
  reviewer_name text,
  status text not null default 'draft' check (status in ('draft','published','needs_review')),
  created_at timestamptz not null default now()
);

create table public.support_contacts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  name text not null,
  role_label text not null,
  phone text,
  email text,
  hours text,
  is_external boolean not null default false,
  verified boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.help_requests (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  category text not null,
  message text not null,
  status public.help_status not null default 'open',
  owner_id uuid,
  response text,
  responded_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index on public.help_requests(case_id);

create table public.internal_notes (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  body text not null,
  author_id uuid,
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  outbox_id uuid unique,
  message_key text not null default 'generic_update',
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.notifications(user_id, created_at desc);

create table public.reminder_outbox (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  user_id uuid,
  target_type text not null check (target_type in ('action','appointment','renewal')),
  target_id uuid not null,
  channel text not null default 'in_app' check (channel in ('in_app','email')),
  send_at timestamptz not null,
  idempotency_key text not null unique,
  status public.outbox_status not null default 'scheduled',
  attempts integer not null default 0,
  last_error text,
  provider_accepted_at timestamptz,
  delivered_at timestamptz,
  opened_at timestamptz,
  is_demo boolean not null default false,
  cohort_ref text,
  created_at timestamptz not null default now()
);
create index on public.reminder_outbox(status, send_at);

create table public.audit_log (
  id bigserial primary key,
  org_id uuid,
  case_id uuid,
  actor_id uuid,
  action text not null,
  record_type text not null,
  record_id text,
  at timestamptz not null default now()
);
create index on public.audit_log(org_id, at desc);

create table public.monitoring_events (
  id bigserial primary key,
  org_id uuid,
  is_demo boolean not null default false,
  pseudo_user text not null,
  role text,
  event text not null check (event in (
    'invitation_sent','invitation_accepted','login','onboarding_started','onboarding_completed',
    'dashboard_viewed','timeline_viewed','action_viewed','document_viewed','upload_attempted',
    'upload_completed','upload_failed','appointment_viewed','renewal_viewed','support_viewed',
    'help_requested','reminder_scheduled','reminder_accepted','reminder_failed','action_reported','action_verified')),
  session_id text,
  object_id text,
  cohort text,
  device text,
  channel text,
  outcome text,
  dedupe_key text unique,
  occurred_at timestamptz not null default now()
);
create index on public.monitoring_events(org_id, occurred_at);

create table public.assessments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  is_demo boolean not null default false,
  pseudo_user text not null,
  kind text not null check (kind in ('comprehension','task_flow','practitioner_timing')),
  correct_action boolean,
  correct_source boolean,
  outcome text check (outcome in ('independent','assisted','failed')),
  baseline_seconds integer,
  followup_seconds integer,
  paired boolean not null default false,
  cohort text,
  external_ref text unique,
  recorded_by uuid,
  assessed_at timestamptz not null default now()
);
create index on public.assessments(org_id, assessed_at);

create table public.data_requests (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  kind text not null check (kind in ('export','deletion')),
  status text not null default 'submitted' check (status in ('submitted','under_review','completed','declined')),
  notes text,
  review_notes text,
  requested_by uuid,
  created_at timestamptz not null default now()
);

create table public.bootstrap_codes (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  used_at timestamptz,
  used_by uuid
);

-- ===== HELPERS =====
create or replace function public.is_org_admin(_org uuid) returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from memberships where org_id=_org and user_id=auth.uid() and role='admin') $$;
create or replace function public.is_org_staff(_org uuid) returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from memberships where org_id=_org and user_id=auth.uid()) $$;
create or replace function public.is_case_applicant(_case uuid) returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from cases where id=_case and applicant_user_id=auth.uid()) $$;
create or replace function public.has_case_grant(_case uuid) returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from case_grants g join cases c on c.id=g.case_id
    join memberships m on m.org_id=c.org_id and m.user_id=g.user_id
    where g.case_id=_case and g.user_id=auth.uid() and g.revoked_at is null) $$;
create or replace function public.can_access_case(_case uuid) returns boolean language sql stable security definer set search_path=public as $$
  select public.is_case_applicant(_case) or public.has_case_grant(_case) $$;
create or replace function public.can_case_docs(_case uuid) returns boolean language sql stable security definer set search_path=public as $$
  select public.is_case_applicant(_case) or exists(select 1 from case_grants where case_id=_case and user_id=auth.uid() and revoked_at is null and can_view_documents) and public.has_case_grant(_case) $$;
create or replace function public.can_case_internal(_case uuid) returns boolean language sql stable security definer set search_path=public as $$
  select public.has_case_grant(_case) and exists(select 1 from case_grants where case_id=_case and user_id=auth.uid() and revoked_at is null and can_view_internal) $$;
create or replace function public.case_org(_case uuid) returns uuid language sql stable security definer set search_path=public as $$
  select org_id from cases where id=_case $$;
create or replace function public.is_case_admin(_case uuid) returns boolean language sql stable security definer set search_path=public as $$
  select public.is_org_admin(public.case_org(_case)) $$;
create or replace function public.is_applicant_in_org(_org uuid) returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from cases where org_id=_org and applicant_user_id=auth.uid()) $$;

-- ===== GRANTS (read-only from client; writes via RPC) =====
do $$ declare t text; begin
  foreach t in array array['organisations','profiles','memberships','cases','invitations','case_grants','documents','timeline_entries','timeline_revisions','actions','action_events','appointments','renewal_records','correspondence','resources','support_contacts','help_requests','internal_notes','notifications','reminder_outbox','audit_log','monitoring_events','assessments','data_requests','bootstrap_codes'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
  foreach t in array array['organisations','profiles','memberships','cases','invitations','case_grants','documents','timeline_entries','timeline_revisions','actions','action_events','appointments','renewal_records','correspondence','resources','support_contacts','help_requests','internal_notes','notifications','reminder_outbox','audit_log','data_requests'] loop
    execute format('grant select on public.%I to authenticated', t);
  end loop;
end $$;
grant usage, select on sequence public.audit_log_id_seq, public.monitoring_events_id_seq to service_role;

-- ===== POLICIES =====
create policy org_read on public.organisations for select to authenticated using (is_org_staff(id) or is_applicant_in_org(id));
create policy prof_read on public.profiles for select to authenticated using (
  id=auth.uid()
  or exists(select 1 from cases c where c.applicant_user_id=profiles.id and has_case_grant(c.id))
  or exists(select 1 from memberships m where m.user_id=profiles.id and is_org_staff(m.org_id))
  or exists(select 1 from case_grants g join cases c on c.id=g.case_id where g.user_id=profiles.id and g.revoked_at is null and c.applicant_user_id=auth.uid()));
create policy mem_read on public.memberships for select to authenticated using (user_id=auth.uid() or is_org_admin(org_id));
create policy case_read on public.cases for select to authenticated using (applicant_user_id=auth.uid() or has_case_grant(id) or is_org_admin(org_id));
create policy inv_read on public.invitations for select to authenticated using (is_org_admin(org_id));
create policy grant_read on public.case_grants for select to authenticated using (user_id=auth.uid() or is_case_admin(case_id) or (is_case_applicant(case_id) and revoked_at is null));
create policy doc_read on public.documents for select to authenticated using (can_case_docs(case_id));
create policy tl_read on public.timeline_entries for select to authenticated using (can_access_case(case_id));
create policy tlr_read on public.timeline_revisions for select to authenticated using (can_access_case(case_id));
create policy act_read on public.actions for select to authenticated using (can_access_case(case_id));
create policy acte_read on public.action_events for select to authenticated using (can_access_case(case_id));
create policy appt_read on public.appointments for select to authenticated using (can_access_case(case_id));
create policy ren_read on public.renewal_records for select to authenticated using (can_access_case(case_id));
create policy corr_read on public.correspondence for select to authenticated using (can_access_case(case_id));
create policy res_read on public.resources for select to authenticated using (is_org_staff(org_id) or (status='published' and is_applicant_in_org(org_id)));
create policy con_read on public.support_contacts for select to authenticated using (is_org_staff(org_id) or is_applicant_in_org(org_id));
create policy help_read on public.help_requests for select to authenticated using (can_access_case(case_id));
create policy note_read on public.internal_notes for select to authenticated using (can_case_internal(case_id));
create policy notif_read on public.notifications for select to authenticated using (user_id=auth.uid());
create policy outbox_read on public.reminder_outbox for select to authenticated using (has_case_grant(case_id) or is_case_admin(case_id));
create policy audit_read on public.audit_log for select to authenticated using (org_id is not null and is_org_admin(org_id));
create policy dr_read on public.data_requests for select to authenticated using (is_case_applicant(case_id) or is_case_admin(case_id));

-- ===== AUDIT TRIGGER =====
create or replace function public.audit_trg() returns trigger language plpgsql security definer set search_path=public as $$
declare r jsonb; cid uuid; oid uuid;
begin
  r := case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
  cid := nullif(r->>'case_id','')::uuid;
  if tg_table_name='cases' then cid := (r->>'id')::uuid; end if;
  oid := coalesce(nullif(r->>'org_id','')::uuid, (select org_id from cases where id=cid));
  insert into audit_log(org_id,case_id,actor_id,action,record_type,record_id)
    values (oid,cid,auth.uid(),lower(tg_op),tg_table_name,r->>'id');
  return null;
end $$;
do $$ declare t text; begin
  foreach t in array array['memberships','cases','invitations','case_grants','documents','timeline_entries','actions','appointments','renewal_records','correspondence','resources','support_contacts','help_requests','internal_notes','data_requests'] loop
    execute format('create trigger audit_%1$s after insert or update or delete on public.%1$I for each row execute function public.audit_trg()', t);
  end loop;
end $$;

create or replace function public.audit_immutable() returns trigger language plpgsql as $$ begin raise exception 'audit records are immutable'; end $$;
create trigger audit_no_update before update or delete on public.audit_log for each row execute function public.audit_immutable();

-- last admin guard
create or replace function public.guard_last_admin() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if old.role='admin' and (tg_op='DELETE' or new.role<>'admin') then
    if (select count(*) from memberships where org_id=old.org_id and role='admin' and id<>old.id)=0 then
      raise exception 'cannot remove the last administrator';
    end if;
  end if;
  return case when tg_op='DELETE' then old else new end;
end $$;
create trigger memberships_last_admin before update or delete on public.memberships for each row execute function public.guard_last_admin();

-- ===== REMINDER SCHEDULING =====
create or replace function public.schedule_reminder(_case uuid, _type text, _target uuid, _send_at timestamptz, _key text) returns void language plpgsql security definer set search_path=public as $$
declare c record;
begin
  -- cancel any other pending reminder for this target
  update reminder_outbox set status='cancelled' where target_type=_type and target_id=_target and status='scheduled' and (_key is null or idempotency_key<>_key);
  if _key is null or _send_at is null then return; end if;
  select * into c from cases where id=_case;
  if c.applicant_user_id is null then return; end if;
  insert into reminder_outbox(case_id,user_id,target_type,target_id,channel,send_at,idempotency_key,is_demo,cohort_ref)
    values (_case,c.applicant_user_id,_type,_target,'in_app',_send_at,_key,c.is_demo,c.rollout_wave)
    on conflict (idempotency_key) do update set status='scheduled', send_at=excluded.send_at
      where reminder_outbox.status='cancelled';
end $$;

create or replace function public.lisbon_9am(_d date) returns timestamptz language sql immutable as $$
  select ((_d::timestamp + time '09:00') at time zone 'Europe/Lisbon') $$;

create or replace function public.actions_reminder_trg() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.status='pending' and new.due_confirmed and new.due_date is not null then
    perform schedule_reminder(new.case_id,'action',new.id, lisbon_9am(new.due_date - 2), 'action:'||new.id||':'||new.due_date);
  else
    perform schedule_reminder(new.case_id,'action',new.id,null,null);
  end if;
  return null;
end $$;
create trigger actions_reminder after insert or update of due_date,due_confirmed,status on public.actions for each row execute function public.actions_reminder_trg();

create or replace function public.appt_reminder_trg() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.confirmed and new.starts_at is not null then
    perform schedule_reminder(new.case_id,'appointment',new.id, new.starts_at - interval '1 day', 'appointment:'||new.id||':'||extract(epoch from new.starts_at)::bigint);
  else
    perform schedule_reminder(new.case_id,'appointment',new.id,null,null);
  end if;
  return null;
end $$;
create trigger appt_reminder after insert or update of starts_at,confirmed on public.appointments for each row execute function public.appt_reminder_trg();

create or replace function public.renewal_reminder_trg() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.expiry_reviewed and new.prep_start_date is not null then
    perform schedule_reminder(new.case_id,'renewal',new.id, lisbon_9am(new.prep_start_date), 'renewal:'||new.id||':'||new.prep_start_date);
  else
    perform schedule_reminder(new.case_id,'renewal',new.id,null,null);
  end if;
  return null;
end $$;
create trigger renewal_reminder after insert or update of prep_start_date,expiry_reviewed on public.renewal_records for each row execute function public.renewal_reminder_trg();

create or replace function public.process_reminders(_limit int default 200) returns int language plpgsql security definer set search_path=public as $$
declare r record; n int := 0;
begin
  for r in select * from reminder_outbox where status='scheduled' and send_at<=now() order by send_at limit _limit for update skip locked loop
    begin
      if r.channel='in_app' then
        insert into notifications(user_id,outbox_id,message_key,link) values (r.user_id,r.id,'generic_update','/home') on conflict (outbox_id) do nothing;
        update reminder_outbox set status='delivered', attempts=attempts+1, provider_accepted_at=now(), delivered_at=now() where id=r.id;
      else
        update reminder_outbox set attempts=attempts+1, last_error='email_provider_not_configured',
          status=case when attempts+1>=5 then 'delivery_failed'::outbox_status else 'scheduled'::outbox_status end,
          send_at=now()+interval '1 hour' where id=r.id;
      end if;
      n := n+1;
    exception when others then
      update reminder_outbox set attempts=attempts+1, last_error=left(sqlerrm,200),
        status=case when attempts+1>=5 then 'delivery_failed'::outbox_status else 'scheduled'::outbox_status end where id=r.id;
    end;
  end loop;
  return n;
end $$;
revoke execute on function public.process_reminders(int) from public, anon, authenticated;
revoke execute on function public.schedule_reminder(uuid,text,uuid,timestamptz,text) from public, anon, authenticated;
