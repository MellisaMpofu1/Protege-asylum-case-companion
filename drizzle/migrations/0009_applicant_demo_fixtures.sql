create table public.applicant_demo_fixtures (
  id text primary key,
  applicant_user_id uuid not null,
  case_id uuid not null references public.cases(id) on delete cascade,
  kind text not null check (kind in ('document','appointment','life')),
  title text not null,
  occurred_on date,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index on public.applicant_demo_fixtures(applicant_user_id, kind);
grant select on public.applicant_demo_fixtures to authenticated;
grant all on public.applicant_demo_fixtures to service_role;
alter table public.applicant_demo_fixtures enable row level security;
create policy adf_own on public.applicant_demo_fixtures for select to authenticated
  using (applicant_user_id = auth.uid() and public.is_case_applicant(case_id));
comment on table public.applicant_demo_fixtures is 'Applicant-only DEMO fixtures; never read by staff, monitoring or reminder jobs.';