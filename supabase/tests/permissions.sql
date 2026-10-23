-- Backend permission tests. Runs inside a transaction and rolls back.
-- psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/permissions.sql
begin;

create temp table ids as
select
  (select user_id from memberships where role='practitioner' and org_id='00000000-0000-4000-8000-00000000d001' limit 1) prac,
  (select user_id from memberships where role='practitioner' and org_id='00000000-0000-4000-8000-00000000d002' limit 1) iso,
  (select user_id from memberships where role='admin' and org_id='00000000-0000-4000-8000-00000000d001' limit 1) adm,
  (select applicant_user_id from cases where cohort_ref='PGU0001') app,
  (select id from cases where cohort_ref='PGU0001') c1,
  (select id from cases where cohort_ref='PGU0150') c_unassigned,
  (select id from cases where workspace_ref='ISO001') c_iso;
grant select on ids to authenticated;

create or replace function pg_temp.as_user(u uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.expect_error(sql text, pattern text) returns void language plpgsql as $$
begin
  begin execute sql; exception when others then
    if sqlerrm !~ pattern then raise exception 'unexpected error: %', sqlerrm; end if;
    return;
  end;
  raise exception 'expected failure: %', sql;
end $$;

-- 1. cross-case: applicant sees only own case
select pg_temp.as_user((select app from ids));
do $$ begin
  if (select count(*) from cases) <> 1 then raise exception 'applicant sees other cases'; end if;
  if exists(select 1 from timeline_entries where case_id <> (select c1 from ids)) then raise exception 'applicant sees other timelines'; end if;
  if exists(select 1 from audit_log) then raise exception 'applicant can read audit'; end if;
  if exists(select 1 from internal_notes) then raise exception 'applicant sees internal notes'; end if;
end $$;
-- 2. review-only verification: applicant cannot verify
select pg_temp.expect_error(format('select verify_action(%L, 1)', (select id from actions where case_id=(select c1 from ids) limit 1)), 'forbidden');
-- 3. self-promotion impossible
select pg_temp.expect_error($q$insert into memberships(org_id,user_id,role) values ('00000000-0000-4000-8000-00000000d001', auth.uid(), 'admin')$q$, 'permission denied|row-level security');
select pg_temp.expect_error(format('select grant_case_access(%L, auth.uid(), true, true)', (select c1 from ids)), 'forbidden');
-- 4. unauthorised export (monitoring)
select pg_temp.expect_error($q$select monitoring_summary('00000000-0000-4000-8000-00000000d001', now()-interval '1 year', now())$q$, 'forbidden');
reset role;

-- 5. practitioner: only assigned cases; cross-org isolation
select pg_temp.as_user((select prac from ids));
do $$ begin
  if exists(select 1 from cases where id=(select c_unassigned from ids)) then raise exception 'practitioner sees unassigned case'; end if;
  if exists(select 1 from cases where id=(select c_iso from ids)) then raise exception 'cross-org leak'; end if;
  if (select count(*) from my_caseload(null,null,100,0)) <> 40 then raise exception 'caseload size wrong'; end if;
end $$;
select pg_temp.expect_error(format('select add_timeline_entry(%L, %L, null)', (select c_unassigned from ids), 'x'), 'forbidden');
reset role;
select pg_temp.as_user((select iso from ids));
do $$ begin if exists(select 1 from cases where org_id='00000000-0000-4000-8000-00000000d001') then raise exception 'isolation org sees org A'; end if; end $$;
reset role;

-- 6. admin without grant cannot read case narrative/documents
select pg_temp.as_user((select adm from ids));
do $$ begin
  if exists(select 1 from timeline_entries) then raise exception 'admin reads narratives'; end if;
  if exists(select 1 from documents) then raise exception 'admin reads documents'; end if;
end $$;
-- last administrator cannot be removed
select pg_temp.expect_error(format('select remove_membership(%L)', (select id from memberships where user_id=(select adm from ids) and role='admin')), 'last administrator');
reset role;

-- 7. correction/concurrency: stale version rejected, history kept
select pg_temp.as_user((select prac from ids));
do $$ declare e uuid; v int; begin
  select id, version into e, v from timeline_entries where case_id=(select c1 from ids) limit 1;
  perform review_timeline_entry(e, v, 'Corrected title', 'b', 'practitioner_reviewed', 'test');
  begin perform review_timeline_entry(e, v, 'Stale', 'b', 'practitioner_reviewed', 'test'); raise exception 'stale write accepted';
  exception when others then if sqlerrm !~ 'version_conflict' then raise; end if; end;
  if (select count(*) from timeline_revisions where entry_id=e) < 1 then raise exception 'history missing'; end if;
  begin perform review_timeline_entry(e, v+1, 'x', 'b', 'officially_synchronised', 'r'); raise exception 'reserved provenance accepted';
  exception when others then if sqlerrm !~ 'reserved_source' then raise; end if; end;
end $$;

-- 8. reminders: only confirmed dates; reschedule cancels old; no duplicates
do $$ declare a uuid; n int; begin
  a := create_action((select c1 from ids), 'Test', null, 'applicant', 'practitioner_reviewed', '2030-05-10', false, null, false);
  if exists(select 1 from reminder_outbox where target_id=a) then raise exception 'unconfirmed date scheduled a reminder'; end if;
  perform update_action_due(a, 1, '2030-05-10', true);
  perform update_action_due(a, 2, '2030-05-10', true);
  if (select count(*) from reminder_outbox where target_id=a and status='scheduled') <> 1 then raise exception 'duplicate reminder'; end if;
  if (select send_at from reminder_outbox where target_id=a and status='scheduled') <> '2030-05-08 08:00:00+00' then raise exception 'wrong Lisbon send time'; end if;
  perform update_action_due(a, 3, '2030-06-01', true);
  if (select count(*) from reminder_outbox where target_id=a and status='scheduled') <> 1 then raise exception 'reschedule left duplicate'; end if;
  if not exists(select 1 from reminder_outbox where target_id=a and status='cancelled') then raise exception 'old reminder not cancelled'; end if;
end $$;
reset role;

-- 9. demo exclusion and zero denominators: live org has no data
do $$ declare o uuid; s jsonb; begin
  insert into organisations(name) values ('Test live org') returning id into o;
  insert into memberships(org_id,user_id,role) values (o,(select adm from ids),'admin');
  perform set_config('request.jwt.claims', json_build_object('sub', (select adm from ids), 'role','authenticated')::text, true);
  s := monitoring_summary(o, now()-interval '10 years', now()+interval '10 years');
  if (s->'understanding'->>'den')::int <> 0 or (s->>'is_demo')::boolean then raise exception 'demo leaked into live metrics'; end if;
end $$;

-- 10. private documents: no storage policy lets clients read the bucket
do $$ begin
  if exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname ilike '%case-documents%') then raise exception 'unexpected storage policy'; end if;
end $$;

do $$ begin raise exception 'ALL PERMISSION TESTS PASSED (rolled back)'; end $$;
rollback;
