do $$ declare t text; begin
  for t in select tablename from pg_tables where schemaname='public' loop
    execute format('revoke insert, update, delete, truncate on public.%I from anon, authenticated', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;
revoke execute on all functions in schema public from public;
grant execute on all functions in schema public to authenticated, service_role;
revoke execute on function public.process_reminders(int) from authenticated;
revoke execute on function public.schedule_reminder(uuid,text,uuid,timestamptz,text) from authenticated;
grant execute on function public.lookup_invitation(text) to anon;