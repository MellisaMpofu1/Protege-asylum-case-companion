create table public.case_status_history (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  status text not null check (status in ('applied','pending','action_required','approved')),
  previous_status text,
  explanation text not null,
  source provenance not null,
  decision_ref text,
  is_demo boolean not null default false,
  author_id uuid,
  recorded_at timestamptz not null default now(),
  correction_requested boolean not null default false,
  correction_note text,
  correction_requested_at timestamptz
);
create index on public.case_status_history(case_id, recorded_at desc);
grant select on public.case_status_history to authenticated;
grant all on public.case_status_history to service_role;
alter table public.case_status_history enable row level security;
create policy csh_read on public.case_status_history for select to authenticated
  using (public.is_case_applicant(case_id) or public.has_case_grant(case_id));

create or replace function public.record_application_status(_case uuid, _status text, _explanation text, _source provenance, _decision_ref text)
returns uuid language plpgsql security definer set search_path=public as $$
declare prev text; hid uuid; demo boolean;
begin
  perform _uid();
  if not has_case_grant(_case) then raise exception 'forbidden'; end if;
  if _status not in ('applied','pending','action_required','approved') then raise exception 'invalid_status'; end if;
  if _source is null then raise exception 'source_required'; end if;
  if _source='officially_synchronised' then raise exception 'reserved_source'; end if;
  if length(trim(coalesce(_explanation,'')))<5 then raise exception 'explanation_required'; end if;
  if _status='approved' and (_source<>'linked_correspondence' or length(trim(coalesce(_decision_ref,'')))=0) then
    raise exception 'approval_needs_decision';
  end if;
  select status into prev from case_status_history where case_id=_case order by recorded_at desc, id desc limit 1;
  select is_demo into demo from cases where id=_case;
  insert into case_status_history(case_id,status,previous_status,explanation,source,decision_ref,is_demo,author_id)
    values (_case,_status,prev,left(trim(_explanation),2000),_source,nullif(left(trim(coalesce(_decision_ref,'')),300),''),coalesce(demo,false),auth.uid())
    returning id into hid;
  insert into timeline_entries(case_id,title,body,source,review_state,author_id,reviewed_by,reviewed_at)
    values (_case, 'Application status recorded: '||case _status when 'applied' then 'Applied' when 'pending' then 'Pending'
      when 'action_required' then 'Action Required' else 'Approved' end,
      left(trim(_explanation),2000), _source, 'reviewed', auth.uid(), auth.uid(), now());
  perform notify_applicant(_case,'status_updated','/home');
  return hid;
end $$;

create or replace function public.request_status_correction(_entry uuid, _note text) returns void
language plpgsql security definer set search_path=public as $$
declare e record;
begin
  select * into e from case_status_history where id=_entry;
  if not found or not is_case_applicant(e.case_id) then raise exception 'forbidden'; end if;
  if length(trim(coalesce(_note,'')))=0 then raise exception 'note_required'; end if;
  update case_status_history set correction_requested=true, correction_note=left(trim(_note),2000), correction_requested_at=now() where id=_entry;
  perform notify_case_staff(e.case_id,'status_correction');
end $$;

create or replace function public.latest_case_statuses(_cases uuid[])
returns table(case_id uuid, status text, recorded_at timestamptz, correction_requested boolean)
language sql stable security definer set search_path=public as $$
  select distinct on (h.case_id) h.case_id, h.status, h.recorded_at, h.correction_requested
  from case_status_history h
  where h.case_id = any(_cases) and (is_case_applicant(h.case_id) or has_case_grant(h.case_id))
  order by h.case_id, h.recorded_at desc, h.id desc
$$;
revoke execute on function public.record_application_status(uuid,text,text,provenance,text) from public, anon;
revoke execute on function public.request_status_correction(uuid,text) from public, anon;
revoke execute on function public.latest_case_statuses(uuid[]) from public, anon;
grant execute on function public.record_application_status(uuid,text,text,provenance,text) to authenticated;
grant execute on function public.request_status_correction(uuid,text) to authenticated;
grant execute on function public.latest_case_statuses(uuid[]) to authenticated;
alter publication supabase_realtime add table public.case_status_history;