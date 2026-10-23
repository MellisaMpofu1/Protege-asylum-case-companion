
-- Invitations: delivery tracking + caseworker case assignment
alter table public.invitations add column if not exists send_status text not null default 'not_sent';
alter table public.invitations add column if not exists sent_at timestamptz;
alter table public.invitations add column if not exists last_error text;
alter table public.invitations add column if not exists case_ids uuid[] not null default '{}';
alter table public.invitations add column if not exists send_count integer not null default 0;

-- Appointments: lifecycle
alter table public.appointments add column if not exists status text not null default 'scheduled';
alter table public.appointments add column if not exists timezone text not null default 'Europe/Lisbon';
alter table public.appointments add column if not exists cancelled_at timestamptz;
alter table public.appointments add column if not exists cancel_reason text;
alter table public.appointments add column if not exists acknowledged_at timestamptz;
alter table public.appointments add column if not exists recorded_by uuid;

-- Resources: pillar category
alter table public.resources add column if not exists category text not null default 'rights';

create table public.case_messages (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  sender_id uuid not null,
  sender_role text not null,
  body text not null,
  created_at timestamptz not null default now()
);
create index on public.case_messages(case_id, created_at);
grant select on public.case_messages to authenticated;
grant all on public.case_messages to service_role;
alter table public.case_messages enable row level security;
create policy msg_read on public.case_messages for select to authenticated using (public.is_case_applicant(case_id) or public.has_case_grant(case_id));

create table public.appointment_responses (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  case_id uuid not null references public.cases(id) on delete cascade,
  kind text not null,
  note text,
  actor_id uuid,
  actor_role text not null,
  created_at timestamptz not null default now()
);
create index on public.appointment_responses(appointment_id, created_at);
grant select on public.appointment_responses to authenticated;
grant all on public.appointment_responses to service_role;
alter table public.appointment_responses enable row level security;
create policy apr_read on public.appointment_responses for select to authenticated using (public.is_case_applicant(case_id) or public.has_case_grant(case_id));

-- notification helpers
create or replace function public.notify_user(_user uuid, _key text, _link text) returns void
language sql security definer set search_path=public as $$
  insert into notifications(user_id,message_key,link) select _user,_key,_link where _user is not null;
$$;
create or replace function public.notify_applicant(_case uuid, _key text, _link text) returns void
language sql security definer set search_path=public as $$
  insert into notifications(user_id,message_key,link)
  select c.applicant_user_id,_key,_link from cases c where c.id=_case and c.applicant_user_id is not null and c.applicant_user_id is distinct from auth.uid();
$$;
create or replace function public.notify_case_staff(_case uuid, _key text) returns void
language sql security definer set search_path=public as $$
  insert into notifications(user_id,message_key,link)
  select distinct g.user_id,_key,'/work/'||_case from case_grants g where g.case_id=_case and g.revoked_at is null and g.user_id is distinct from auth.uid();
$$;
revoke execute on function public.notify_user(uuid,text,text) from public, anon, authenticated;
revoke execute on function public.notify_applicant(uuid,text,text) from public, anon, authenticated;
revoke execute on function public.notify_case_staff(uuid,text) from public, anon, authenticated;

create or replace function public.mark_notification_read(_id uuid) returns void language sql security definer set search_path=public as $$
  update notifications set read_at=now() where id=_id and user_id=auth.uid() and read_at is null;
$$;
create or replace function public.mark_notifications_read_link(_link text) returns void language sql security definer set search_path=public as $$
  update notifications set read_at=now() where user_id=auth.uid() and read_at is null and link=_link;
$$;
grant execute on function public.mark_notification_read(uuid) to authenticated;
grant execute on function public.mark_notifications_read_link(text) to authenticated;

-- messages
create or replace function public.send_case_message(_case uuid, _body text) returns uuid
language plpgsql security definer set search_path=public as $$
declare mid uuid; r text;
begin
  perform _uid();
  if is_case_applicant(_case) then r := 'applicant';
  elsif has_case_grant(_case) then r := 'staff';
  else raise exception 'forbidden'; end if;
  if length(trim(coalesce(_body,'')))=0 then raise exception 'message_required'; end if;
  insert into case_messages(case_id,sender_id,sender_role,body) values (_case,auth.uid(),r,left(trim(_body),4000)) returning id into mid;
  if r='applicant' then perform notify_case_staff(_case,'new_message');
  else perform notify_applicant(_case,'new_message','/support'); end if;
  return mid;
end $$;
grant execute on function public.send_case_message(uuid,text) to authenticated;

-- appointments
create or replace function public.upsert_appointment(_id uuid, _case uuid, _title text, _starts_at timestamptz, _confirmed boolean, _location text, _remote_link text, _support_user uuid, _checklist jsonb, _doc_ids uuid[])
returns uuid language plpgsql security definer set search_path=public as $$
declare aid uuid := _id; old_start timestamptz; old_status text;
begin
  if not has_case_grant(_case) then raise exception 'forbidden'; end if;
  if length(trim(coalesce(_title,'')))=0 then raise exception 'title_required'; end if;
  if _remote_link is not null and _remote_link<>'' and _remote_link !~ '^https://' then raise exception 'invalid_link'; end if;
  if _doc_ids is not null and exists(select 1 from unnest(_doc_ids) d where not exists(select 1 from documents x where x.id=d and x.case_id=_case)) then raise exception 'forbidden'; end if;
  if aid is null then
    insert into appointments(case_id,title,starts_at,confirmed,location,remote_link,support_user_id,checklist,document_ids,recorded_by)
      values (_case,left(_title,200),_starts_at,coalesce(_confirmed,false) and _starts_at is not null,left(_location,300),nullif(_remote_link,''),_support_user,coalesce(_checklist,'[]'),coalesce(_doc_ids,'{}'),auth.uid()) returning id into aid;
    perform notify_applicant(_case,'appointment_created','/appointments#appt-'||aid);
  else
    select starts_at, status into old_start, old_status from appointments where id=aid and case_id=_case for update;
    if not found then raise exception 'not_found'; end if;
    update appointments set title=left(_title,200), starts_at=_starts_at, confirmed=coalesce(_confirmed,false) and _starts_at is not null, location=left(_location,300),
      remote_link=nullif(_remote_link,''), support_user_id=_support_user, checklist=coalesce(_checklist,'[]'), document_ids=coalesce(_doc_ids,'{}'), change_request=null,
      status='scheduled', cancelled_at=null, cancel_reason=null,
      acknowledged_at=case when old_start is distinct from _starts_at then null else acknowledged_at end
      where id=aid;
    perform notify_applicant(_case, case when old_start is distinct from _starts_at or old_status='cancelled' then 'appointment_rescheduled' else 'appointment_updated' end, '/appointments#appt-'||aid);
  end if;
  return aid;
end $$;

create or replace function public.cancel_appointment(_appt uuid, _reason text) returns void
language plpgsql security definer set search_path=public as $$
declare a record;
begin
  select * into a from appointments where id=_appt for update;
  if not found or not has_case_grant(a.case_id) then raise exception 'forbidden'; end if;
  if a.status='cancelled' then return; end if;
  update appointments set status='cancelled', cancelled_at=now(), cancel_reason=left(nullif(trim(coalesce(_reason,'')),''),500), confirmed=false where id=_appt;
  perform notify_applicant(a.case_id,'appointment_cancelled','/appointments#appt-'||_appt);
end $$;
grant execute on function public.cancel_appointment(uuid,text) to authenticated;

create or replace function public.respond_appointment(_appt uuid, _kind text, _note text) returns void
language plpgsql security definer set search_path=public as $$
declare a record;
begin
  select * into a from appointments where id=_appt for update;
  if not found or not is_case_applicant(a.case_id) then raise exception 'forbidden'; end if;
  if a.status='cancelled' then raise exception 'forbidden'; end if;
  if _kind not in ('acknowledged','change_requested') then raise exception 'invalid'; end if;
  if _kind='change_requested' and length(trim(coalesce(_note,'')))=0 then raise exception 'message_required'; end if;
  insert into appointment_responses(appointment_id,case_id,kind,note,actor_id,actor_role) values (_appt,a.case_id,_kind,left(_note,1000),auth.uid(),'applicant');
  if _kind='acknowledged' then update appointments set acknowledged_at=now() where id=_appt;
  else update appointments set change_request=left(_note,1000) where id=_appt; end if;
  perform notify_case_staff(a.case_id, 'appointment_response');
end $$;
grant execute on function public.respond_appointment(uuid,text,text) to authenticated;

create or replace function public.report_appointment_change(_appt uuid, _note text) returns void language plpgsql security definer set search_path=public as $$
begin perform respond_appointment(_appt,'change_requested',_note); end $$;

create or replace function public.appt_reminder_trg() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.confirmed and new.starts_at is not null and new.status<>'cancelled' then
    perform schedule_reminder(new.case_id,'appointment',new.id, new.starts_at - interval '1 day', 'appointment:'||new.id||':'||extract(epoch from new.starts_at)::bigint);
  else
    perform schedule_reminder(new.case_id,'appointment',new.id,null,null);
  end if;
  return null;
end $$;
drop trigger if exists appt_reminder on public.appointments;
create trigger appt_reminder after insert or update of starts_at,confirmed,status on public.appointments for each row execute function public.appt_reminder_trg();

-- cross-portal notifications via triggers
create or replace function public.notify_timeline_trg() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if exists(select 1 from cases c where c.id=new.case_id and c.applicant_user_id is distinct from new.author_id) then
    perform notify_applicant(new.case_id,'case_update','/case');
  else
    perform notify_case_staff(new.case_id,'applicant_update');
  end if;
  return null;
end $$;
create trigger notify_timeline after insert on public.timeline_entries for each row execute function public.notify_timeline_trg();

create or replace function public.notify_action_trg() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_op='INSERT' then
    perform notify_applicant(new.case_id, case when new.requests_document then 'document_requested' else 'action_assigned' end, case when new.requests_document then '/documents' else '/case' end);
  elsif new.status='reported_complete' and old.status is distinct from 'reported_complete' then
    perform notify_case_staff(new.case_id,'action_reported');
  end if;
  return null;
end $$;
create trigger notify_action after insert or update of status on public.actions for each row execute function public.notify_action_trg();

create or replace function public.notify_help_trg() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_op='INSERT' then perform notify_case_staff(new.case_id,'help_request');
  elsif new.response is distinct from old.response and new.response is not null then perform notify_applicant(new.case_id,'help_response','/support'); end if;
  return null;
end $$;
create trigger notify_help after insert or update of response on public.help_requests for each row execute function public.notify_help_trg();

-- invitations v2
create or replace function public.create_invitation_v2(_org uuid, _email text, _role invite_role, _case uuid, _cases uuid[])
returns jsonb language plpgsql security definer set search_path=public, extensions as $$
declare tok text; iid uuid; em text := lower(trim(coalesce(_email,'')));
begin
  perform _uid();
  if not is_org_admin(_org) then raise exception 'forbidden'; end if;
  if em !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'invalid_email'; end if;
  if (select count(*) from invitations where created_by=auth.uid() and created_at>now()-interval '1 hour')>=30 then raise exception 'rate_limited'; end if;
  if exists(select 1 from invitations where org_id=_org and email=em and status='pending' and expires_at>now()) then raise exception 'already_pending'; end if;
  if _role='applicant' then
    if _case is null or not exists(select 1 from cases where id=_case and org_id=_org and applicant_user_id is null) then raise exception 'invalid_case'; end if;
    if exists(select 1 from invitations where case_id=_case and status='pending' and expires_at>now()) then raise exception 'invalid_case'; end if;
    _cases := '{}';
  else
    _case := null;
    _cases := coalesce(_cases,'{}');
    if _role='admin' then _cases := '{}'; end if;
    if exists(select 1 from unnest(_cases) x where not exists(select 1 from cases c where c.id=x and c.org_id=_org)) then raise exception 'invalid_case'; end if;
  end if;
  tok := encode(extensions.gen_random_bytes(24),'hex');
  insert into invitations(org_id,email,role,case_id,case_ids,token_hash,expires_at,created_by)
    values (_org, em, _role, _case, _cases, _hash(tok), now()+interval '7 days', auth.uid()) returning id into iid;
  return jsonb_build_object('id',iid,'token',tok,'email',em);
end $$;
grant execute on function public.create_invitation_v2(uuid,text,invite_role,uuid,uuid[]) to authenticated;

create or replace function public.rotate_invitation_token(_id uuid) returns jsonb
language plpgsql security definer set search_path=public, extensions as $$
declare i record; tok text;
begin
  select * into i from invitations where id=_id for update;
  if not found or not is_org_admin(i.org_id) then raise exception 'forbidden'; end if;
  if i.status<>'pending' then raise exception 'invitation_not_pending'; end if;
  if i.sent_at is not null and i.sent_at>now()-interval '60 seconds' then raise exception 'rate_limited'; end if;
  if i.send_count>=10 then raise exception 'rate_limited'; end if;
  tok := encode(extensions.gen_random_bytes(24),'hex');
  update invitations set token_hash=_hash(tok), expires_at=now()+interval '7 days' where id=_id;
  return jsonb_build_object('id',i.id,'token',tok,'email',i.email);
end $$;
grant execute on function public.rotate_invitation_token(uuid) to authenticated;

create or replace function public.record_invitation_send(_id uuid, _ok boolean, _err text) returns void
language sql security definer set search_path=public as $$
  update invitations set send_status=case when _ok then 'provider_accepted' else 'send_failed' end,
    sent_at=case when _ok then now() else sent_at end, last_error=case when _ok then null else left(_err,300) end,
    send_count=send_count+1 where id=_id;
$$;
revoke execute on function public.record_invitation_send(uuid,boolean,text) from public, anon, authenticated;
grant execute on function public.record_invitation_send(uuid,boolean,text) to service_role;

create or replace function public.accept_invitation(_token text) returns jsonb language plpgsql security definer set search_path=public as $$
declare i record; u uuid := _uid(); em text := lower(coalesce(auth.jwt()->>'email','')); c uuid;
begin
  select * into i from invitations where token_hash=_hash(_token) for update;
  if not found then raise exception 'invalid_invitation'; end if;
  if i.email<>em then raise exception 'invitation_email_mismatch'; end if;
  if i.status='accepted' and i.accepted_by=u then return jsonb_build_object('role',i.role); end if;
  if i.status<>'pending' then raise exception 'invitation_not_pending'; end if;
  if i.expires_at<now() then raise exception 'invitation_expired'; end if;
  perform ensure_profile();
  if i.role='applicant' then
    if exists(select 1 from memberships where user_id=u) then raise exception 'staff_account'; end if;
    if exists(select 1 from cases where applicant_user_id=u and id<>i.case_id) then raise exception 'already_applicant'; end if;
    update cases set applicant_user_id=u where id=i.case_id and (applicant_user_id is null or applicant_user_id=u);
    if not found then raise exception 'case_unavailable'; end if;
  else
    if exists(select 1 from cases where applicant_user_id=u) then raise exception 'applicant_account'; end if;
    insert into memberships(org_id,user_id,role) values (i.org_id,u,i.role::text::org_role) on conflict do nothing;
    if i.role='practitioner' then
      foreach c in array i.case_ids loop
        if not exists(select 1 from case_grants where case_id=c and user_id=u and revoked_at is null) then
          insert into case_grants(case_id,user_id,can_view_documents,can_view_internal,granted_by) values (c,u,true,true,i.created_by);
        end if;
      end loop;
    end if;
  end if;
  update invitations set status='accepted', accepted_by=u, accepted_at=now() where id=i.id;
  insert into monitoring_events(org_id,is_demo,pseudo_user,role,event,object_id,dedupe_key)
    select i.org_id, o.is_demo, pseudo_id(u), i.role::text, 'invitation_accepted', i.id::text, 'inva:'||i.id from organisations o where o.id=i.org_id
    on conflict do nothing;
  return jsonb_build_object('role',i.role);
end $$;

create or replace function public.set_resource_category(_id uuid, _category text) returns void
language plpgsql security definer set search_path=public as $$
begin
  if _category not in ('rights','life') then raise exception 'invalid'; end if;
  if not exists(select 1 from resources where id=_id and is_org_admin(org_id)) then raise exception 'forbidden'; end if;
  update resources set category=_category where id=_id;
end $$;
grant execute on function public.set_resource_category(uuid,text) to authenticated;

alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.case_messages;
