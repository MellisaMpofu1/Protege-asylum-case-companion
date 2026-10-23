CREATE TABLE public.consent_documents (
  purpose text PRIMARY KEY,
  version text NOT NULL,
  required boolean NOT NULL,
  status text NOT NULL DEFAULT 'draft_awaiting_review',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.consent_documents TO anon, authenticated;
GRANT ALL ON public.consent_documents TO service_role;
ALTER TABLE public.consent_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "consent docs readable" ON public.consent_documents FOR SELECT TO anon, authenticated USING (true);
INSERT INTO public.consent_documents(purpose,version,required) VALUES
 ('terms','2026-10-draft-1',true),('privacy_notice','2026-10-draft-1',true),('usage_analytics','2026-10-draft-1',false);

CREATE TABLE public.consent_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  purpose text NOT NULL REFERENCES public.consent_documents(purpose),
  version text NOT NULL,
  choice boolean NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX consent_records_user_idx ON public.consent_records(user_id, purpose, recorded_at DESC);
GRANT SELECT ON public.consent_records TO authenticated;
GRANT ALL ON public.consent_records TO service_role;
ALTER TABLE public.consent_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own consent read" ON public.consent_records FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE TRIGGER consent_records_immutable BEFORE UPDATE OR DELETE ON public.consent_records FOR EACH ROW EXECUTE FUNCTION public.audit_immutable();

CREATE OR REPLACE FUNCTION public.consent_current(_u uuid, _purpose text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT r.choice FROM consent_records r JOIN consent_documents d ON d.purpose=r.purpose
    WHERE r.user_id=_u AND r.purpose=_purpose AND r.version=d.version ORDER BY r.recorded_at DESC, r.id LIMIT 1), false)
$$;

CREATE OR REPLACE FUNCTION public.onboarding_complete(_u uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT EXISTS (SELECT 1 FROM consent_documents d WHERE d.required AND NOT public.consent_current(_u, d.purpose))
$$;

CREATE OR REPLACE FUNCTION public.record_consents(_choices jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare u uuid := auth.uid(); k text; v jsonb; d consent_documents;
begin
  if u is null then raise exception 'not_authenticated'; end if;
  for k, v in select * from jsonb_each(_choices) loop
    select * into d from consent_documents where purpose=k;
    if d.purpose is null then raise exception 'unknown_purpose'; end if;
    if jsonb_typeof(v) <> 'boolean' then raise exception 'invalid_choice'; end if;
    if d.required and v = 'false'::jsonb then raise exception 'required_consent'; end if;
    if public.consent_current(u,k) is distinct from (v::text)::boolean
       or not exists (select 1 from consent_records where user_id=u and purpose=k and version=d.version) then
      insert into consent_records(user_id,purpose,version,choice) values (u,k,d.version,(v::text)::boolean);
    end if;
  end loop;
end $$;

CREATE OR REPLACE FUNCTION public.require_onboarding_trg() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin
  if auth.uid() is not null and not public.onboarding_complete(auth.uid()) then
    raise exception 'onboarding_required';
  end if;
  return NEW;
end $$;
CREATE TRIGGER help_requests_onboarding BEFORE INSERT ON public.help_requests FOR EACH ROW EXECUTE FUNCTION public.require_onboarding_trg();
CREATE TRIGGER documents_onboarding BEFORE INSERT ON public.documents FOR EACH ROW EXECUTE FUNCTION public.require_onboarding_trg();
CREATE TRIGGER timeline_onboarding BEFORE INSERT ON public.timeline_entries FOR EACH ROW EXECUTE FUNCTION public.require_onboarding_trg();
CREATE TRIGGER profiles_onboarding BEFORE UPDATE ON public.profiles FOR EACH ROW
  WHEN (OLD.preferred_language IS DISTINCT FROM NEW.preferred_language OR OLD.needs_language_assistance IS DISTINCT FROM NEW.needs_language_assistance OR OLD.display_name IS DISTINCT FROM NEW.display_name)
  EXECUTE FUNCTION public.require_onboarding_trg();

CREATE OR REPLACE FUNCTION public.log_event(_event text, _object text DEFAULT NULL::text, _session text DEFAULT NULL::text, _device text DEFAULT NULL::text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
declare u uuid := auth.uid(); o uuid; demo boolean; r text; coh text;
begin
  if u is null then return; end if;
  if not public.consent_current(u,'usage_analytics') then return; end if;
  select c.org_id, c.is_demo, 'applicant', c.rollout_wave into o, demo, r, coh from cases c where c.applicant_user_id=u;
  if o is null then select m.org_id, og.is_demo, m.role::text into o, demo, r from memberships m join organisations og on og.id=m.org_id where m.user_id=u limit 1; end if;
  if o is null then return; end if;
  insert into monitoring_events(org_id,is_demo,pseudo_user,role,event,session_id,object_id,cohort,device,dedupe_key)
    values (o,demo,pseudo_id(u),r,_event,left(_session,64),left(_object,64),coh,case when _device in ('mobile','tablet','desktop') then _device end,
      case when _object is not null then _event||':'||pseudo_id(u)||':'||_object end)
    on conflict (dedupe_key) do nothing;
end $function$;

CREATE OR REPLACE FUNCTION public.my_context() RETURNS jsonb
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
declare u uuid := _uid();
begin
  return jsonb_build_object(
    'user_id', u,
    'profile', (select to_jsonb(p) from profiles p where id=u),
    'memberships', coalesce((select jsonb_agg(jsonb_build_object('org_id',m.org_id,'role',m.role,'org_name',o.name,'is_demo',o.is_demo)) from memberships m join organisations o on o.id=m.org_id where m.user_id=u),'[]'),
    'case', (select jsonb_build_object('id',c.id,'org_id',c.org_id,'label',c.display_label,'is_demo',c.is_demo,'org_name',o.name) from cases c join organisations o on o.id=c.org_id where c.applicant_user_id=u),
    'unread', (select count(*) from notifications where user_id=u and read_at is null),
    'onboarded', public.onboarding_complete(u),
    'consents', (select jsonb_object_agg(d.purpose, public.consent_current(u,d.purpose)) from consent_documents d)
  );
end $function$;

REVOKE ALL ON FUNCTION public.record_consents(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.record_consents(jsonb), public.consent_current(uuid,text), public.onboarding_complete(uuid) TO authenticated;