-- Portal separation: an identity is either staff (membership) or an applicant (case owner), never both.
update public.cases set applicant_user_id = null
 where applicant_user_id in (select user_id from public.memberships);

create or replace function public.guard_portal_separation() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'cases' then
    if new.applicant_user_id is not null and exists(select 1 from memberships where user_id = new.applicant_user_id) then
      raise exception 'forbidden: staff account cannot own an applicant workspace';
    end if;
    if new.applicant_user_id is not null and exists(select 1 from cases where applicant_user_id = new.applicant_user_id and id <> new.id) then
      raise exception 'forbidden: applicant already linked to a workspace';
    end if;
  else
    if exists(select 1 from cases where applicant_user_id = new.user_id) then
      raise exception 'forbidden: applicant account cannot hold a staff role';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists portal_sep_cases on public.cases;
create trigger portal_sep_cases before insert or update of applicant_user_id on public.cases
  for each row execute function public.guard_portal_separation();
drop trigger if exists portal_sep_members on public.memberships;
create trigger portal_sep_members before insert or update of user_id on public.memberships
  for each row execute function public.guard_portal_separation();