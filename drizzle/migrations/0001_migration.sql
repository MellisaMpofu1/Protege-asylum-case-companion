
create or replace function public._uid() returns uuid language plpgsql stable as $$
begin if auth.uid() is null then raise exception 'not_authenticated'; end if; return auth.uid(); end $$;

create or replace function public._hash(_t text) returns text language sql immutable set search_path=public, extensions as $$
  select encode(extensions.digest(_t,'sha256'),'hex') $$;

create or replace function public.pseudo_id(_u uuid) returns text language sql immutable set search_path=public, extensions as $$
  select 'u_'||left(encode(extensions.digest('protege-pseudo:'||_u::text,'sha256'),'hex'),16) $$;

-- context
create or replace function public.my_context() returns jsonb language plpgsql stable security definer set search_path=public as $$
declare u uuid := _uid();
begin
  return jsonb_build_object(
    'user_id', u,
    'profile', (select to_jsonb(p) from profiles p where id=u),
    'memberships', coalesce((select jsonb_agg(jsonb_build_object('org_id',m.org_id,'role',m.role,'org_name',o.name,'is_demo',o.is_demo)) from memberships m join organisations o on o.id=m.org_id where m.user_id=u),'[]'),
    'case', (select jsonb_build_object('id',c.id,'org_id',c.org_id,'label',c.display_label,'is_demo',c.is_demo,'org_name',o.name) from cases c join organisations o on o.id=c.org_id where c.applicant_user_id=u),
    'unread', (select count(*) from notifications where user_id=u and read_at is null)
  );
end $$;

create or replace function public.ensure_profile() returns void language plpgsql security definer set search_path=public as $$
begin insert into profiles(id, display_name) values (_uid(), split_part(coalesce(auth.jwt()->>'email',''),'@',1)) on conflict (id) do nothing; end $$;

create or replace function public.update_my_profile(_display_name text, _ui_locale text, _preferred_language text, _needs_assistance boolean, _email_notifications boolean)
returns void language plpgsql security definer set search_path=public as $$
begin
  perform ensure_profile();
  update profiles set display_name=left(_display_name,120), ui_locale=_ui_locale, preferred_language=left(_preferred_language,80),
    needs_language_assistance=_needs_assistance, email_notifications=_email_notifications, updated_at=now() where id=auth.uid();
  update cases set preferred_language=left(_preferred_language,80), needs_language_assistance=_needs_assistance where applicant_user_id=auth.uid();
end $$;

create or replace function public.acknowledge_policy(_version text) returns void language plpgsql security definer set search_path=public as $$
begin perform ensure_profile(); update profiles set policy_version=_version, policy_ack_at=now() where id=auth.uid(); end $$;

-- bootstrap (one-time)
create or replace function public.bootstrap_first_admin(_code text, _org_name text) returns uuid language plpgsql security definer set search_path=public as $$
declare b record; o uuid; u uuid := _uid();
begin
  select * into b from bootstrap_codes where code_hash=_hash(_code) and used_at is null for update;
  if not found then raise exception 'invalid_or_used_code'; end if;
  insert into organisations(name,is_demo) values (left(_org_name,120), false) returning id into o;
  perform ensure_profile();
  insert into memberships(org_id,user_id,role) values (o,u,'admin');
  update bootstrap_codes set used_at=now(), used_by=u where id=b.id;
  return o;
end $$;

-- invitations
create or replace function public.create_invitation(_org uuid, _email text, _role invite_role, _case uuid default null)
returns jsonb language plpgsql security definer set search_path=public, extensions as $$
declare tok text; iid uuid;
begin
  perform _uid();
  if not is_org_admin(_org) then raise exception 'forbidden'; end if;
  if _role='applicant' then
    if _case is null or not exists(select 1 from cases where id=_case and org_id=_org and applicant_user_id is null) then raise exception 'invalid_case'; end if;
  else _case := null; end if;
  tok := encode(extensions.gen_random_bytes(24),'hex');
  insert into invitations(org_id,email,role,case_id,token_hash,expires_at,created_by)
    values (_org, lower(trim(_email)), _role, _case, _hash(tok), now()+interval '7 days', auth.uid()) returning id into iid;
  insert into monitoring_events(org_id,is_demo,pseudo_user,role,event,object_id,dedupe_key)
    select _org, o.is_demo, pseudo_id(auth.uid()), 'admin','invitation_sent', iid::text, 'inv:'||iid from organisations o where o.id=_org;
  return jsonb_build_object('id',iid,'token',tok);
end $$;

create or replace function public.revoke_invitation(_id uuid) returns void language plpgsql security definer set search_path=public as $$
begin
  if not exists(select 1 from invitations where id=_id and is_org_admin(org_id)) then raise exception 'forbidden'; end if;
  update invitations set status='revoked' where id=_id and status='pending';
end $$;

create or replace function public.lookup_invitation(_token text) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare i record;
begin
  select inv.*, o.name as org_name into i from invitations inv join organisations o on o.id=inv.org_id where token_hash=_hash(_token);
  if not found then return jsonb_build_object('state','invalid'); end if;
  return jsonb_build_object(
    'state', case when i.status='revoked' then 'revoked' when i.status='accepted' then 'used' when i.expires_at<now() then 'expired' else 'valid' end,
    'role', i.role, 'org_name', i.org_name,
    'email_hint', left(i.email,2)||'***@'||split_part(i.email,'@',2));
end $$;
grant execute on function public.lookup_invitation(text) to anon;

create or replace function public.accept_invitation(_token text) returns jsonb language plpgsql security definer set search_path=public as $$
declare i record; u uuid := _uid(); em text := lower(coalesce(auth.jwt()->>'email',''));
begin
  select * into i from invitations where token_hash=_hash(_token) for update;
  if not found then raise exception 'invalid_invitation'; end if;
  if i.status<>'pending' then raise exception 'invitation_not_pending'; end if;
  if i.expires_at<now() then raise exception 'invitation_expired'; end if;
  if i.email<>em then raise exception 'invitation_email_mismatch'; end if;
  perform ensure_profile();
  if i.role='applicant' then
    if exists(select 1 from cases where applicant_user_id=u) then raise exception 'already_applicant'; end if;
    update cases set applicant_user_id=u where id=i.case_id and applicant_user_id is null;
    if not found then raise exception 'case_unavailable'; end if;
  else
    insert into memberships(org_id,user_id,role) values (i.org_id,u,i.role::text::org_role) on conflict do nothing;
  end if;
  update invitations set status='accepted', accepted_by=u, accepted_at=now() where id=i.id;
  insert into monitoring_events(org_id,is_demo,pseudo_user,role,event,object_id,dedupe_key)
    select i.org_id, o.is_demo, pseudo_id(u), i.role::text, 'invitation_accepted', i.id::text, 'inva:'||i.id from organisations o where o.id=i.org_id;
  return jsonb_build_object('role',i.role);
end $$;

-- memberships & grants
create or replace function public.remove_membership(_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare m record;
begin
  select * into m from memberships where id=_id;
  if not found or not is_org_admin(m.org_id) then raise exception 'forbidden'; end if;
  delete from memberships where id=_id;
  if m.role='practitioner' then
    update case_grants g set revoked_at=now() from cases c where c.id=g.case_id and c.org_id=m.org_id and g.user_id=m.user_id and g.revoked_at is null;
  end if;
end $$;

create or replace function public.add_membership_role(_org uuid, _user uuid, _role org_role) returns void language plpgsql security definer set search_path=public as $$
begin
  if not is_org_admin(_org) then raise exception 'forbidden'; end if;
  if not exists(select 1 from memberships where org_id=_org and user_id=_user) then raise exception 'not_a_member'; end if;
  insert into memberships(org_id,user_id,role) values (_org,_user,_role) on conflict do nothing;
end $$;

create or replace function public.grant_case_access(_case uuid, _user uuid, _docs boolean, _internal boolean) returns uuid language plpgsql security definer set search_path=public as $$
declare o uuid := case_org(_case); gid uuid;
begin
  if o is null or not is_org_admin(o) then raise exception 'forbidden'; end if;
  if not exists(select 1 from memberships where org_id=o and user_id=_user and role='practitioner') then raise exception 'not_a_practitioner'; end if;
  insert into case_grants(case_id,user_id,can_view_documents,can_view_internal,granted_by) values (_case,_user,_docs,_internal,auth.uid())
    on conflict (case_id,user_id) where revoked_at is null do update set can_view_documents=excluded.can_view_documents, can_view_internal=excluded.can_view_internal
    returning id into gid;
  return gid;
end $$;

create or replace function public.revoke_case_access(_grant uuid) returns void language plpgsql security definer set search_path=public as $$
begin
  if not exists(select 1 from case_grants where id=_grant and is_case_admin(case_id)) then raise exception 'forbidden'; end if;
  update case_grants set revoked_at=now() where id=_grant and revoked_at is null;
end $$;

create or replace function public.create_case(_org uuid, _label text, _procedure text) returns uuid language plpgsql security definer set search_path=public as $$
declare cid uuid;
begin
  if not is_org_admin(_org) then raise exception 'forbidden'; end if;
  insert into cases(org_id,display_label,procedure_path,is_demo) select _org,left(_label,120),left(_procedure,120),is_demo from organisations where id=_org returning id into cid;
  return cid;
end $$;

-- timeline
create or replace function public.add_timeline_entry(_case uuid, _title text, _body text, _source provenance default null, _doc uuid default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare eid uuid; staff boolean := has_case_grant(_case); src provenance;
begin
  perform _uid();
  if not can_access_case(_case) then raise exception 'forbidden'; end if;
  if length(trim(coalesce(_title,'')))=0 then raise exception 'title_required'; end if;
  if _doc is not null and not exists(select 1 from documents where id=_doc and case_id=_case) then raise exception 'invalid_document'; end if;
  if staff then src := coalesce(_source,'practitioner_reviewed'); if src='officially_synchronised' then raise exception 'reserved_source'; end if;
  else src := case when _doc is not null then 'linked_correspondence'::provenance else 'applicant_reported'::provenance end; end if;
  insert into timeline_entries(case_id,title,body,source,review_state,author_id,linked_document_id,reviewed_by,reviewed_at)
    values (_case,left(_title,200),left(_body,4000),src, case when staff then 'reviewed'::review_state else 'unreviewed'::review_state end, auth.uid(), _doc,
      case when staff then auth.uid() end, case when staff then now() end) returning id into eid;
  return eid;
end $$;

create or replace function public.request_correction(_entry uuid, _note text) returns void language plpgsql security definer set search_path=public as $$
declare e record;
begin
  select * into e from timeline_entries where id=_entry;
  if not found or not is_case_applicant(e.case_id) then raise exception 'forbidden'; end if;
  update timeline_entries set correction_requested=true, correction_note=left(_note,2000) where id=_entry;
end $$;

create or replace function public.review_timeline_entry(_entry uuid, _expected_version int, _title text, _body text, _source provenance, _reason text)
returns int language plpgsql security definer set search_path=public as $$
declare e record; changed boolean;
begin
  select * into e from timeline_entries where id=_entry for update;
  if not found or not has_case_grant(e.case_id) then raise exception 'forbidden'; end if;
  if e.version<>_expected_version then raise exception 'version_conflict'; end if;
  if _source='officially_synchronised' then raise exception 'reserved_source'; end if;
  changed := e.title is distinct from _title or e.body is distinct from _body or e.source is distinct from _source;
  insert into timeline_revisions(entry_id,case_id,version,title,body,source,review_state,changed_by,reason)
    values (e.id,e.case_id,e.version,e.title,e.body,e.source,e.review_state,auth.uid(),left(_reason,1000));
  update timeline_entries set title=left(_title,200), body=left(_body,4000), source=_source,
    review_state=case when changed then 'corrected'::review_state else 'reviewed'::review_state end,
    correction_requested=false, version=version+1, reviewed_by=auth.uid(), reviewed_at=now() where id=_entry;
  return e.version+1;
end $$;

create or replace function public.set_case_stage(_case uuid, _stage text, _path text, _source provenance) returns void language plpgsql security definer set search_path=public as $$
begin
  if not has_case_grant(_case) then raise exception 'forbidden'; end if;
  if _source='officially_synchronised' then raise exception 'reserved_source'; end if;
  update cases set stage=left(_stage,200), procedure_path=left(_path,200), stage_source=_source, stage_recorded_at=now() where id=_case;
end $$;

-- actions
create or replace function public.create_action(_case uuid, _title text, _instruction text, _owner text, _source provenance, _due date, _due_confirmed boolean, _doc uuid, _requests_document boolean)
returns uuid language plpgsql security definer set search_path=public as $$
declare aid uuid;
begin
  if not has_case_grant(_case) then raise exception 'forbidden'; end if;
  if _source='officially_synchronised' then raise exception 'reserved_source'; end if;
  if _doc is not null and not exists(select 1 from documents where id=_doc and case_id=_case) then raise exception 'invalid_document'; end if;
  insert into actions(case_id,title,instruction,owner,source,due_date,due_confirmed,document_id,requests_document,created_by)
    values (_case,left(_title,200),left(_instruction,4000),_owner,_source,_due,coalesce(_due_confirmed,false) and _due is not null,_doc,coalesce(_requests_document,false),auth.uid()) returning id into aid;
  insert into action_events(action_id,case_id,kind,actor_id) values (aid,_case,'created',auth.uid());
  return aid;
end $$;

create or replace function public.update_action_due(_action uuid, _expected_version int, _due date, _confirmed boolean) returns void language plpgsql security definer set search_path=public as $$
declare a record;
begin
  select * into a from actions where id=_action for update;
  if not found or not has_case_grant(a.case_id) then raise exception 'forbidden'; end if;
  if a.version<>_expected_version then raise exception 'version_conflict'; end if;
  update actions set due_date=_due, due_confirmed=coalesce(_confirmed,false) and _due is not null, version=version+1 where id=_action;
  insert into action_events(action_id,case_id,kind,note,actor_id) values (_action,a.case_id,'due_changed',coalesce(_due::text,'none'),auth.uid());
end $$;

create or replace function public.report_action_complete(_action uuid, _expected_version int, _completed_on date, _outcome text, _doc uuid default null)
returns void language plpgsql security definer set search_path=public as $$
declare a record;
begin
  select * into a from actions where id=_action for update;
  if not found or not can_access_case(a.case_id) then raise exception 'forbidden'; end if;
  if a.version<>_expected_version then raise exception 'version_conflict'; end if;
  if a.status<>'pending' then raise exception 'invalid_status'; end if;
  if _completed_on is null then raise exception 'date_required'; end if;
  if _doc is not null and not exists(select 1 from documents where id=_doc and case_id=a.case_id) then raise exception 'invalid_document'; end if;
  update actions set status='reported_complete', completed_on=_completed_on, outcome=nullif(left(_outcome,2000),''), reported_at=now(),
    document_id=coalesce(_doc,document_id), version=version+1 where id=_action;
  insert into action_events(action_id,case_id,kind,note,actor_id) values (_action,a.case_id,'reported_complete',left(_outcome,500),auth.uid());
end $$;

create or replace function public.verify_action(_action uuid, _expected_version int, _note text default null) returns void language plpgsql security definer set search_path=public as $$
declare a record;
begin
  select * into a from actions where id=_action for update;
  if not found or not has_case_grant(a.case_id) then raise exception 'forbidden'; end if;
  if a.version<>_expected_version then raise exception 'version_conflict'; end if;
  if a.status not in ('reported_complete','pending') then raise exception 'invalid_status'; end if;
  update actions set status='verified_complete', verified_by=auth.uid(), verified_at=now(), completed_on=coalesce(completed_on,current_date), version=version+1 where id=_action;
  insert into action_events(action_id,case_id,kind,note,actor_id) values (_action,a.case_id,'verified',left(_note,500),auth.uid());
end $$;

create or replace function public.return_action(_action uuid, _expected_version int, _note text) returns void language plpgsql security definer set search_path=public as $$
declare a record;
begin
  select * into a from actions where id=_action for update;
  if not found or not has_case_grant(a.case_id) then raise exception 'forbidden'; end if;
  if a.version<>_expected_version then raise exception 'version_conflict'; end if;
  if a.status<>'reported_complete' then raise exception 'invalid_status'; end if;
  update actions set status='pending', version=version+1 where id=_action;
  insert into action_events(action_id,case_id,kind,note,actor_id) values (_action,a.case_id,'returned',left(_note,500),auth.uid());
end $$;

create or replace function public.cancel_action(_action uuid, _expected_version int, _reason text) returns void language plpgsql security definer set search_path=public as $$
declare a record;
begin
  select * into a from actions where id=_action for update;
  if not found or not has_case_grant(a.case_id) then raise exception 'forbidden'; end if;
  if a.version<>_expected_version then raise exception 'version_conflict'; end if;
  if length(trim(coalesce(_reason,'')))=0 then raise exception 'reason_required'; end if;
  update actions set status='cancelled', cancel_reason=left(_reason,1000), version=version+1 where id=_action;
  insert into action_events(action_id,case_id,kind,note,actor_id) values (_action,a.case_id,'cancelled',left(_reason,500),auth.uid());
end $$;

-- appointments
create or replace function public.upsert_appointment(_id uuid, _case uuid, _title text, _starts_at timestamptz, _confirmed boolean, _location text, _remote_link text, _support_user uuid, _checklist jsonb, _doc_ids uuid[])
returns uuid language plpgsql security definer set search_path=public as $$
declare aid uuid := _id;
begin
  if not has_case_grant(_case) then raise exception 'forbidden'; end if;
  if _remote_link is not null and _remote_link<>'' and _remote_link !~ '^https://' then raise exception 'invalid_link'; end if;
  if aid is null then
    insert into appointments(case_id,title,starts_at,confirmed,location,remote_link,support_user_id,checklist,document_ids)
      values (_case,left(_title,200),_starts_at,coalesce(_confirmed,false) and _starts_at is not null,left(_location,300),nullif(_remote_link,''),_support_user,coalesce(_checklist,'[]'),coalesce(_doc_ids,'{}')) returning id into aid;
  else
    update appointments set title=left(_title,200), starts_at=_starts_at, confirmed=coalesce(_confirmed,false) and _starts_at is not null, location=left(_location,300),
      remote_link=nullif(_remote_link,''), support_user_id=_support_user, checklist=coalesce(_checklist,'[]'), document_ids=coalesce(_doc_ids,'{}'), change_request=null
      where id=aid and case_id=_case;
    if not found then raise exception 'not_found'; end if;
  end if;
  return aid;
end $$;

create or replace function public.report_appointment_change(_appt uuid, _note text) returns void language plpgsql security definer set search_path=public as $$
declare a record;
begin
  select * into a from appointments where id=_appt;
  if not found or not can_access_case(a.case_id) then raise exception 'forbidden'; end if;
  update appointments set change_request=left(_note,1000) where id=_appt;
end $$;

create or replace function public.toggle_appointment_item(_appt uuid, _idx int, _done boolean) returns void language plpgsql security definer set search_path=public as $$
declare a record;
begin
  select * into a from appointments where id=_appt;
  if not found or not can_access_case(a.case_id) then raise exception 'forbidden'; end if;
  update appointments set checklist=jsonb_set(checklist, array[_idx::text,'done'], to_jsonb(_done)) where id=_appt and jsonb_array_length(checklist)>_idx;
end $$;

create or replace function public.save_recap(_appt uuid, _recap text) returns void language plpgsql security definer set search_path=public as $$
declare a record;
begin
  select * into a from appointments where id=_appt;
  if not found or not has_case_grant(a.case_id) then raise exception 'forbidden'; end if;
  update appointments set recap=left(_recap,6000), recap_reviewed_by=auth.uid(), recap_reviewed_at=now() where id=_appt;
end $$;

-- renewal
create or replace function public.upsert_renewal(_case uuid, _document_type text, _expiry date, _expiry_reviewed boolean, _prep_start date, _instructions text, _checklist jsonb)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not has_case_grant(_case) then raise exception 'forbidden'; end if;
  insert into renewal_records(case_id,document_type,expiry_date,expiry_reviewed,prep_start_date,instructions,checklist,reviewed_by,reviewed_at)
    values (_case,left(_document_type,120),_expiry,coalesce(_expiry_reviewed,false),_prep_start,left(_instructions,4000),coalesce(_checklist,'[]'),auth.uid(),now())
  on conflict (case_id) do update set document_type=excluded.document_type, expiry_date=excluded.expiry_date, expiry_reviewed=excluded.expiry_reviewed,
    prep_start_date=excluded.prep_start_date, instructions=excluded.instructions, checklist=excluded.checklist, reviewed_by=auth.uid(), reviewed_at=now();
end $$;

create or replace function public.toggle_renewal_item(_case uuid, _idx int, _done boolean) returns void language plpgsql security definer set search_path=public as $$
begin
  if not can_access_case(_case) then raise exception 'forbidden'; end if;
  update renewal_records set checklist=jsonb_set(checklist, array[_idx::text,'done'], to_jsonb(_done)) where case_id=_case and jsonb_array_length(checklist)>_idx;
end $$;

create or replace function public.record_correspondence(_case uuid, _kind text, _summary text, _occurred date) returns uuid language plpgsql security definer set search_path=public as $$
declare cid uuid;
begin
  if not can_access_case(_case) then raise exception 'forbidden'; end if;
  insert into correspondence(case_id,kind,summary,occurred_on,recorded_by) values (_case,left(_kind,80),left(_summary,2000),_occurred,auth.uid()) returning id into cid;
  return cid;
end $$;

-- help
create or replace function public.create_help_request(_case uuid, _category text, _message text) returns uuid language plpgsql security definer set search_path=public as $$
declare hid uuid; owner uuid;
begin
  if not can_access_case(_case) then raise exception 'forbidden'; end if;
  if length(trim(coalesce(_message,'')))=0 then raise exception 'message_required'; end if;
  select user_id into owner from case_grants where case_id=_case and revoked_at is null order by created_at limit 1;
  insert into help_requests(case_id,category,message,owner_id,created_by) values (_case,left(_category,80),left(_message,2000),owner,auth.uid()) returning id into hid;
  return hid;
end $$;

create or replace function public.respond_help_request(_id uuid, _status help_status, _response text) returns void language plpgsql security definer set search_path=public as $$
declare h record;
begin
  select * into h from help_requests where id=_id;
  if not found or not has_case_grant(h.case_id) then raise exception 'forbidden'; end if;
  update help_requests set status=_status, response=coalesce(nullif(left(_response,2000),''),response), responded_at=now(), owner_id=coalesce(owner_id,auth.uid()) where id=_id;
end $$;

create or replace function public.add_internal_note(_case uuid, _body text) returns uuid language plpgsql security definer set search_path=public as $$
declare nid uuid;
begin
  if not can_case_internal(_case) then raise exception 'forbidden'; end if;
  insert into internal_notes(case_id,body,author_id) values (_case,left(_body,4000),auth.uid()) returning id into nid;
  return nid;
end $$;

-- documents
create or replace function public.register_document(_case uuid, _doc_type text, _safe_name text, _mime text, _size int, _expiry date, _action uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare did uuid; staff boolean := has_case_grant(_case);
begin
  if not can_case_docs(_case) then raise exception 'forbidden'; end if;
  if _mime not in ('application/pdf','image/jpeg','image/png') then raise exception 'invalid_type'; end if;
  if _size<=0 or _size>10485760 then raise exception 'too_large'; end if;
  if _action is not null and not exists(select 1 from actions where id=_action and case_id=_case) then raise exception 'invalid_action'; end if;
  insert into documents(case_id,doc_type,safe_name,mime,size_bytes,uploaded_by,source,review_state,expiry_date,action_id)
    values (_case,left(_doc_type,80),left(_safe_name,120),_mime,_size,auth.uid(),
      case when staff then 'practitioner_reviewed'::provenance else 'applicant_reported'::provenance end,
      case when staff then 'reviewed'::review_state else 'unreviewed'::review_state end,_expiry,_action) returning id into did;
  update documents set storage_path=_case||'/'||did where id=did;
  return jsonb_build_object('id',did,'path',_case||'/'||did);
end $$;

create or replace function public.request_document_removal(_doc uuid) returns void language plpgsql security definer set search_path=public as $$
declare d record;
begin
  select * into d from documents where id=_doc;
  if not found or not can_case_docs(d.case_id) then raise exception 'forbidden'; end if;
  update documents set removal_requested=true where id=_doc;
end $$;

create or replace function public.review_document(_doc uuid, _state review_state, _expiry date) returns void language plpgsql security definer set search_path=public as $$
declare d record;
begin
  select * into d from documents where id=_doc;
  if not found or not has_case_grant(d.case_id) or not can_case_docs(d.case_id) then raise exception 'forbidden'; end if;
  update documents set review_state=_state, expiry_date=_expiry where id=_doc;
end $$;

-- resources/contacts (admin)
create or replace function public.upsert_resource(_id uuid, _org uuid, _title text, _summary text, _publisher text, _url text, _applicability text, _locale text, _reviewed date, _reviewer text, _status text)
returns uuid language plpgsql security definer set search_path=public as $$
declare rid uuid := _id;
begin
  if not is_org_admin(_org) then raise exception 'forbidden'; end if;
  if _url is not null and _url<>'' and _url !~ '^https://' then raise exception 'invalid_link'; end if;
  if _status='published' and (_reviewed is null or coalesce(_reviewer,'')='') then raise exception 'review_required'; end if;
  if rid is null then
    insert into resources(org_id,title,summary,publisher,source_url,applicability,locale,last_reviewed_on,reviewer_name,status)
      values (_org,_title,_summary,_publisher,nullif(_url,''),_applicability,_locale,_reviewed,_reviewer,_status) returning id into rid;
  else
    update resources set title=_title, summary=_summary, publisher=_publisher, source_url=nullif(_url,''), applicability=_applicability, locale=_locale,
      last_reviewed_on=_reviewed, reviewer_name=_reviewer, status=_status where id=rid and org_id=_org;
  end if;
  return rid;
end $$;

create or replace function public.upsert_contact(_id uuid, _org uuid, _name text, _role_label text, _phone text, _email text, _hours text, _external boolean, _verified boolean)
returns uuid language plpgsql security definer set search_path=public as $$
declare rid uuid := _id;
begin
  if not is_org_admin(_org) then raise exception 'forbidden'; end if;
  if rid is null then
    insert into support_contacts(org_id,name,role_label,phone,email,hours,is_external,verified) values (_org,_name,_role_label,_phone,_email,_hours,_external,_verified) returning id into rid;
  else
    update support_contacts set name=_name, role_label=_role_label, phone=_phone, email=_email, hours=_hours, is_external=_external, verified=_verified where id=rid and org_id=_org;
  end if;
  return rid;
end $$;

-- data requests
create or replace function public.create_data_request(_kind text, _notes text) returns uuid language plpgsql security definer set search_path=public as $$
declare cid uuid; rid uuid;
begin
  select id into cid from cases where applicant_user_id=_uid();
  if cid is null then raise exception 'forbidden'; end if;
  insert into data_requests(case_id,kind,notes,requested_by) values (cid,_kind,left(_notes,2000),auth.uid()) returning id into rid;
  return rid;
end $$;

create or replace function public.review_data_request(_id uuid, _status text, _notes text) returns void language plpgsql security definer set search_path=public as $$
declare d record;
begin
  select * into d from data_requests where id=_id;
  if not found or not is_case_admin(d.case_id) then raise exception 'forbidden'; end if;
  update data_requests set status=_status, review_notes=left(_notes,2000) where id=_id;
end $$;

create or replace function public.mark_notifications_read() returns void language plpgsql security definer set search_path=public as $$
begin
  update notifications set read_at=now() where user_id=_uid() and read_at is null;
  update reminder_outbox o set opened_at=now() from notifications n where n.outbox_id=o.id and n.user_id=auth.uid() and o.opened_at is null;
end $$;

-- monitoring
create or replace function public.log_event(_event text, _object text default null, _session text default null, _device text default null) returns void language plpgsql security definer set search_path=public as $$
declare u uuid := auth.uid(); o uuid; demo boolean; r text; coh text;
begin
  if u is null then return; end if;
  select c.org_id, c.is_demo, 'applicant', c.rollout_wave into o, demo, r, coh from cases c where c.applicant_user_id=u;
  if o is null then select m.org_id, og.is_demo, m.role::text into o, demo, r from memberships m join organisations og on og.id=m.org_id where m.user_id=u limit 1; end if;
  if o is null then return; end if;
  insert into monitoring_events(org_id,is_demo,pseudo_user,role,event,session_id,object_id,cohort,device,dedupe_key)
    values (o,demo,pseudo_id(u),r,_event,left(_session,64),left(_object,64),coh,case when _device in ('mobile','tablet','desktop') then _device end,
      case when _object is not null then _event||':'||pseudo_id(u)||':'||_object end)
    on conflict (dedupe_key) do nothing;
end $$;

create or replace function public.record_assessment(_case uuid, _kind text, _correct_action boolean, _correct_source boolean, _outcome text, _baseline int, _followup int)
returns uuid language plpgsql security definer set search_path=public as $$
declare c record; aid uuid;
begin
  select * into c from cases where id=_case;
  if not found or not has_case_grant(_case) then raise exception 'forbidden'; end if;
  insert into assessments(org_id,is_demo,pseudo_user,kind,correct_action,correct_source,outcome,baseline_seconds,followup_seconds,paired,cohort,recorded_by)
    values (c.org_id,c.is_demo,case when _kind='practitioner_timing' then pseudo_id(auth.uid()) else coalesce(pseudo_id(c.applicant_user_id),'case_'||left(c.id::text,8)) end,
      _kind,_correct_action,_correct_source,_outcome,_baseline,_followup,_baseline is not null and _followup is not null,c.rollout_wave,auth.uid()) returning id into aid;
  return aid;
end $$;

create or replace function public.monitoring_summary(_org uuid, _from timestamptz, _to timestamptz, _cohort text default null)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare demo boolean; res jsonb;
begin
  if not is_org_admin(_org) then raise exception 'forbidden'; end if;
  select is_demo into demo from organisations where id=_org;
  with
  ev as (select * from monitoring_events where org_id=_org and is_demo=demo and occurred_at>=_from and occurred_at<_to and (_cohort is null or cohort=_cohort)),
  asm as (select * from assessments where org_id=_org and is_demo=demo and assessed_at>=_from and assessed_at<_to and (_cohort is null or cohort=_cohort)),
  cs as (select * from cases where org_id=_org and is_demo=demo and (_cohort is null or rollout_wave=_cohort)),
  act as (select a.* from actions a join cs on cs.id=a.case_id where a.due_confirmed and a.due_date>=_from::date and a.due_date<_to::date and a.status<>'cancelled'),
  rem as (select o.* from reminder_outbox o join cs on cs.id=o.case_id where o.send_at>=_from and o.send_at<_to and o.status<>'cancelled')
  select jsonb_build_object(
    'is_demo', demo,
    'workspaces', (select count(*) from cs),
    'active_applicants', (select count(distinct pseudo_user) from ev where role='applicant'),
    'understanding', jsonb_build_object(
       'num', (select count(distinct pseudo_user) from asm where kind='comprehension' and correct_action and correct_source),
       'den', (select count(distinct pseudo_user) from asm where kind='comprehension')),
    'core_flow', jsonb_build_object(
       'num', (select count(*) from asm where kind='task_flow' and outcome='independent'),
       'den', (select count(*) from asm where kind='task_flow'),
       'assisted', (select count(*) from asm where kind='task_flow' and outcome='assisted')),
    'on_time', jsonb_build_object(
       'num', (select count(*) from act where status='verified_complete' and completed_on<=due_date),
       'den', (select count(*) from act),
       'unknown', (select count(*) from act where status in ('pending','reported_complete') and outcome is null and due_date<current_date)),
    'reminders', jsonb_build_object(
       'num', (select count(*) from rem where provider_accepted_at is not null),
       'den', (select count(*) from rem),
       'failed', (select count(*) from rem where status='delivery_failed')),
    'coordination', jsonb_build_object(
       'pairs', (select count(*) from asm where kind='practitioner_timing' and paired),
       'baseline_avg', (select round(avg(baseline_seconds)) from asm where kind='practitioner_timing' and paired),
       'followup_avg', (select round(avg(followup_seconds)) from asm where kind='practitioner_timing' and paired)),
    'events', coalesce((select jsonb_object_agg(event, n) from (select event, count(distinct coalesce(dedupe_key, id::text)) n from ev group by event) x),'{}'::jsonb)
  ) into res;
  return res;
end $$;

-- caseload for practitioners
create or replace function public.my_caseload(_search text default null, _filter text default null, _limit int default 25, _offset int default 0)
returns table(case_id uuid, label text, workspace_ref text, stage text, is_demo boolean, actions_due int, overdue int, awaiting_review int, next_due date, expiry date, open_help int, total bigint)
language sql stable security definer set search_path=public as $$
  with base as (
    select c.* from cases c where has_case_grant(c.id)
      and (_search is null or c.display_label ilike '%'||_search||'%' or c.workspace_ref ilike '%'||_search||'%')
  ), agg as (
    select b.id, b.display_label, b.workspace_ref, b.stage, b.is_demo,
      (select count(*) from actions a where a.case_id=b.id and a.status='pending' and a.due_confirmed)::int as actions_due,
      (select count(*) from actions a where a.case_id=b.id and a.status='pending' and a.due_confirmed and a.due_date<current_date)::int as overdue,
      ((select count(*) from actions a where a.case_id=b.id and a.status='reported_complete')
        + (select count(*) from timeline_entries t where t.case_id=b.id and (t.review_state='unreviewed' or t.correction_requested)))::int as awaiting_review,
      (select min(due_date) from actions a where a.case_id=b.id and a.status='pending' and a.due_confirmed) as next_due,
      (select expiry_date from renewal_records r where r.case_id=b.id) as expiry,
      (select count(*) from help_requests h where h.case_id=b.id and h.status<>'resolved')::int as open_help
    from base b
  )
  select id, display_label, workspace_ref, stage, is_demo, actions_due, overdue, awaiting_review, next_due, expiry, open_help, count(*) over()
  from agg
  where _filter is null
     or (_filter='awaiting_review' and awaiting_review>0)
     or (_filter='actions_due' and actions_due>0)
     or (_filter='overdue' and overdue>0)
     or (_filter='expiry' and expiry is not null and expiry < current_date + 90)
     or (_filter='help' and open_help>0)
  order by overdue desc, awaiting_review desc, next_due nulls last, display_label
  limit least(_limit,100) offset _offset
$$;

-- lock down helpers from anon
revoke execute on all functions in schema public from anon;
grant execute on function public.lookup_invitation(text) to anon;
