-- Store unreleased scenario payloads outside the API schema and gate faculty actions
-- with a short-lived server-checked token. The existing shared Supabase login/chart remains.

create table if not exists meditech_private.ehr_faculty_config (
  app text not null,
  session_id text not null,
  passphrase_hash text not null,
  updated_at timestamptz not null default clock_timestamp(),
  primary key(app, session_id)
);
revoke all on meditech_private.ehr_faculty_config from public, anon, authenticated;

create table if not exists meditech_private.ehr_faculty_sessions (
  app text not null,
  session_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default clock_timestamp(),
  last_used_at timestamptz not null default clock_timestamp(),
  primary key(app, session_id, user_id, token_hash)
);
create index if not exists ehr_faculty_sessions_expiry on meditech_private.ehr_faculty_sessions(expires_at);
revoke all on meditech_private.ehr_faculty_sessions from public, anon, authenticated;

create table if not exists meditech_private.ehr_faculty_attempts (
  app text not null,
  session_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  failed_attempts integer not null default 0,
  locked_until timestamptz,
  primary key(app, session_id, user_id)
);
revoke all on meditech_private.ehr_faculty_attempts from public, anon, authenticated;

create table if not exists meditech_private.ehr_scenario_items (
  app text not null,
  session_id text not null,
  patient_id text not null,
  event_id text not null,
  base_event jsonb,
  current_event jsonb not null,
  updated_at timestamptz not null default clock_timestamp(),
  primary key(app, session_id, patient_id, event_id),
  check(jsonb_typeof(current_event)='object' and current_event->>'id'=event_id),
  check(base_event is null or (jsonb_typeof(base_event)='object' and base_event->>'id'=event_id))
);
revoke all on meditech_private.ehr_scenario_items from public, anon, authenticated;

create table if not exists meditech_private.ehr_scenario_catalog (
  app text not null,
  session_id text not null,
  catalog jsonb not null check(jsonb_typeof(catalog)='object'),
  updated_at timestamptz not null default clock_timestamp(),
  primary key(app,session_id)
);
revoke all on meditech_private.ehr_scenario_catalog from public, anon, authenticated;

create table if not exists public.ehr_scenario_releases (
  app text not null,
  session_id text not null,
  patient_id text not null,
  epoch integer not null,
  event_id text not null,
  released_at bigint not null,
  event_payload jsonb not null,
  primary key(app, session_id, patient_id, epoch, event_id),
  check(jsonb_typeof(event_payload)='object' and event_payload->>'id'=event_id)
);
create index if not exists ehr_scenario_releases_patient on public.ehr_scenario_releases(app,session_id,patient_id,epoch);
alter table public.ehr_scenario_releases enable row level security;
revoke all on public.ehr_scenario_releases from public, anon, authenticated;
grant select on public.ehr_scenario_releases to authenticated;
drop policy if exists "approved session readers" on public.ehr_scenario_releases;
create policy "approved session readers" on public.ehr_scenario_releases for select to authenticated
  using (meditech_private.member_role(app,session_id) is not null);

create or replace function meditech_private.contains_protected_scenario_keys(p_value jsonb)
returns boolean language sql immutable set search_path='' as $$
  select case jsonb_typeof(p_value)
    when 'object' then exists(
      select 1 from jsonb_each(p_value) as e(key,value)
      where lower(e.key) in ('events','facultynotes','facultyguides','instructornotes','instructorguide','scenarioitems','pendingevents')
         or meditech_private.contains_protected_scenario_keys(e.value)
    )
    when 'array' then exists(select 1 from jsonb_array_elements(p_value) as e(value)
      where meditech_private.contains_protected_scenario_keys(e.value))
    else false
  end
$$;
revoke all on function meditech_private.contains_protected_scenario_keys(jsonb) from public, anon, authenticated;

-- Legacy faculty RPCs remain available to other apps, but stop working for any app/session
-- that has a passphrase configured. Normal charting by the shared account continues.
create or replace function meditech_private.require_role(p_app text,p_session text,p_roles text[])
returns void language plpgsql stable security definer set search_path='' as $$
declare v_role text;
begin
  if auth.uid() is null then raise exception 'This hospital login is not approved for this action.' using errcode='42501'; end if;
  v_role := meditech_private.member_role(p_app,p_session);
  if v_role is null then raise exception 'This hospital login is not approved for this action.' using errcode='42501'; end if;
  if exists(select 1 from meditech_private.ehr_faculty_config c where c.app=p_app and c.session_id=p_session)
     and v_role='faculty' and 'faculty'=any(p_roles) then
    if not ('student'=any(p_roles)) then
      raise exception 'Faculty passphrase required.' using errcode='42501';
    else
      return;
    end if;
  end if;
  if not v_role=any(p_roles) then raise exception 'This hospital login is not approved for this action.' using errcode='42501'; end if;
end $$;
revoke all on function meditech_private.require_role(text,text,text[]) from public, anon, authenticated;
grant execute on function meditech_private.require_role(text,text,text[]) to authenticated;

create or replace function meditech_private.require_faculty_token(p_app text,p_session text,p_token text)
returns void language plpgsql security definer set search_path='' as $$
declare v_hash text;
begin
  if auth.uid() is null or meditech_private.member_role(p_app,p_session) is distinct from 'faculty' then
    raise exception 'Faculty access required.' using errcode='42501';
  end if;
  if p_token is null or length(p_token)<40 or length(p_token)>200 then
    raise exception 'Faculty access expired. Unlock Faculty again.' using errcode='42501';
  end if;
  v_hash := encode(extensions.digest(convert_to(p_token,'UTF8'),'sha256'),'hex');
  update meditech_private.ehr_faculty_sessions s set last_used_at=clock_timestamp()
    where s.app=p_app and s.session_id=p_session and s.user_id=auth.uid()
      and s.token_hash=v_hash and s.expires_at>clock_timestamp();
  if not found then raise exception 'Faculty access expired. Unlock Faculty again.' using errcode='42501'; end if;
end $$;
revoke all on function meditech_private.require_faculty_token(text,text,text) from public, anon, authenticated;
grant execute on function meditech_private.require_faculty_token(text,text,text) to authenticated;

create or replace function public.ehr_faculty_unlock(p_app text,p_session text,p_passphrase text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_hash text; v_failed integer; v_locked timestamptz; v_token text; v_expiry timestamptz;
begin
  if auth.uid() is null or meditech_private.member_role(p_app,p_session) is distinct from 'faculty' then return null; end if;
  insert into meditech_private.ehr_faculty_attempts(app,session_id,user_id) values(p_app,p_session,auth.uid()) on conflict do nothing;
  select failed_attempts,locked_until into v_failed,v_locked from meditech_private.ehr_faculty_attempts
    where app=p_app and session_id=p_session and user_id=auth.uid() for update;
  if v_locked is not null and v_locked>clock_timestamp() then return null; end if;
  select passphrase_hash into v_hash from meditech_private.ehr_faculty_config where app=p_app and session_id=p_session;
  if v_hash is null or p_passphrase is null or length(p_passphrase)>256
     or extensions.crypt(p_passphrase,v_hash) is distinct from v_hash then
    update meditech_private.ehr_faculty_attempts set
      failed_attempts=case when v_failed+1>=5 then 0 else v_failed+1 end,
      locked_until=case when v_failed+1>=5 then clock_timestamp()+interval '10 minutes' else null end
      where app=p_app and session_id=p_session and user_id=auth.uid();
    return null;
  end if;
  update meditech_private.ehr_faculty_attempts set failed_attempts=0,locked_until=null
    where app=p_app and session_id=p_session and user_id=auth.uid();
  v_token := gen_random_uuid()::text || gen_random_uuid()::text;
  v_expiry := clock_timestamp()+interval '4 hours';
  insert into meditech_private.ehr_faculty_sessions(app,session_id,user_id,token_hash,expires_at)
    values(p_app,p_session,auth.uid(),encode(extensions.digest(convert_to(v_token,'UTF8'),'sha256'),'hex'),v_expiry);
  return jsonb_build_object('token',v_token,'expires_at',v_expiry);
end $$;
revoke all on function public.ehr_faculty_unlock(text,text,text) from public, anon;
grant execute on function public.ehr_faculty_unlock(text,text,text) to authenticated;

create or replace function public.ehr_faculty_lock(p_app text,p_session text,p_token text)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or p_token is null then return false; end if;
  delete from meditech_private.ehr_faculty_sessions where app=p_app and session_id=p_session and user_id=auth.uid()
    and token_hash=encode(extensions.digest(convert_to(p_token,'UTF8'),'sha256'),'hex');
  return found;
end $$;
revoke all on function public.ehr_faculty_lock(text,text,text) from public, anon;
grant execute on function public.ehr_faculty_lock(text,text,text) to authenticated;

create or replace function public.ehr_faculty_get_events(p_app text,p_session text,p_token text)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  perform meditech_private.require_faculty_token(p_app,p_session,p_token);
  return (select coalesce(jsonb_agg(jsonb_build_object('patient_id',i.patient_id,'event',i.current_event) order by i.patient_id,i.event_id),'[]'::jsonb)
    from meditech_private.ehr_scenario_items i where i.app=p_app and i.session_id=p_session);
end $$;
revoke all on function public.ehr_faculty_get_events(text,text,text) from public, anon;
grant execute on function public.ehr_faculty_get_events(text,text,text) to authenticated;

create or replace function public.ehr_faculty_get_catalog(p_app text,p_session text,p_token text)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  perform meditech_private.require_faculty_token(p_app,p_session,p_token);
  return (select catalog from meditech_private.ehr_scenario_catalog c where c.app=p_app and c.session_id=p_session);
end $$;
revoke all on function public.ehr_faculty_get_catalog(text,text,text) from public, anon;
grant execute on function public.ehr_faculty_get_catalog(text,text,text) to authenticated;

create or replace function public.ehr_faculty_save_event(p_app text,p_session text,p_patient text,p_token text,p_event jsonb)
returns text language plpgsql security definer set search_path='' as $$
declare v_id text;
begin
  perform meditech_private.require_faculty_token(p_app,p_session,p_token);
  if jsonb_typeof(p_event) is distinct from 'object' or length(coalesce(p_event->>'id','')) not between 1 and 120
     or octet_length(p_event::text)>1200000 then raise exception 'Invalid scenario item.'; end if;
  v_id:=p_event->>'id';
  if exists(select 1 from public.ehr_scenario_releases r where r.app=p_app and r.session_id=p_session and r.patient_id=p_patient and r.event_id=v_id) then
    raise exception 'Released items must be corrected in the chart.';
  end if;
  insert into meditech_private.ehr_scenario_items(app,session_id,patient_id,event_id,base_event,current_event)
    values(p_app,p_session,p_patient,v_id,null,p_event)
    on conflict(app,session_id,patient_id,event_id) do update set current_event=excluded.current_event,updated_at=clock_timestamp();
  return 'ok';
end $$;
revoke all on function public.ehr_faculty_save_event(text,text,text,text,jsonb) from public, anon;
grant execute on function public.ehr_faculty_save_event(text,text,text,text,jsonb) to authenticated;

create or replace function public.ehr_faculty_correct_event(p_app text,p_session text,p_patient text,p_epoch integer,p_token text,p_event jsonb)
returns text language plpgsql security definer set search_path='' as $$
declare v_id text;
begin
  perform meditech_private.require_faculty_token(p_app,p_session,p_token);
  if jsonb_typeof(p_event) is distinct from 'object' or length(coalesce(p_event->>'id','')) not between 1 and 120
     or octet_length(p_event::text)>1200000 then raise exception 'Invalid chart correction.'; end if;
  v_id:=p_event->>'id';
  update meditech_private.ehr_scenario_items set current_event=p_event,updated_at=clock_timestamp()
    where app=p_app and session_id=p_session and patient_id=p_patient and event_id=v_id;
  update public.ehr_scenario_releases set event_payload=p_event
    where app=p_app and session_id=p_session and patient_id=p_patient and epoch=p_epoch and event_id=v_id;
  if not found then raise exception 'This item is no longer released in the current chart.'; end if;
  return 'ok';
end $$;
revoke all on function public.ehr_faculty_correct_event(text,text,text,integer,text,jsonb) from public, anon;
grant execute on function public.ehr_faculty_correct_event(text,text,text,integer,text,jsonb) to authenticated;

create or replace function public.ehr_faculty_release(p_app text,p_session text,p_patient text,p_epoch integer,p_event text,p_on boolean,p_at bigint,p_token text)
returns text language plpgsql security definer set search_path='' as $$
declare v_event jsonb;
begin
  perform meditech_private.require_faculty_token(p_app,p_session,p_token);
  if meditech_private.lock_patient(p_app,p_session,p_patient)<>p_epoch then return 'stale'; end if;
  if p_on then
    select current_event into v_event from meditech_private.ehr_scenario_items
      where app=p_app and session_id=p_session and patient_id=p_patient and event_id=p_event for update;
    if not found then return 'missing'; end if;
    insert into public.ehr_scenario_releases(app,session_id,patient_id,epoch,event_id,released_at,event_payload)
      values(p_app,p_session,p_patient,p_epoch,p_event,p_at,v_event)
      on conflict(app,session_id,patient_id,epoch,event_id) do update set released_at=excluded.released_at,event_payload=excluded.event_payload;
    update public.ehr_patients set released=released||jsonb_build_object(p_event,p_at),updated_at=clock_timestamp()
      where app=p_app and session_id=p_session and patient_id=p_patient;
  else
    delete from public.ehr_scenario_releases where app=p_app and session_id=p_session and patient_id=p_patient and epoch=p_epoch and event_id=p_event;
    update public.ehr_patients set released=released-p_event,updated_at=clock_timestamp()
      where app=p_app and session_id=p_session and patient_id=p_patient;
  end if;
  return 'ok';
end $$;
revoke all on function public.ehr_faculty_release(text,text,text,integer,text,boolean,bigint,text) from public, anon;
grant execute on function public.ehr_faculty_release(text,text,text,integer,text,boolean,bigint,text) to authenticated;

create or replace function public.ehr_faculty_set_clock(p_app text,p_session text,p_patient text,p_epoch integer,p_start bigint,p_token text)
returns text language plpgsql security definer set search_path='' as $$
begin
  perform meditech_private.require_faculty_token(p_app,p_session,p_token);
  if meditech_private.lock_patient(p_app,p_session,p_patient)<>p_epoch then return 'stale'; end if;
  update public.ehr_patients set real_start=p_start,updated_at=clock_timestamp() where app=p_app and session_id=p_session and patient_id=p_patient;
  return 'ok';
end $$;
revoke all on function public.ehr_faculty_set_clock(text,text,text,integer,bigint,text) from public, anon;
grant execute on function public.ehr_faculty_set_clock(text,text,text,integer,bigint,text) to authenticated;

create or replace function public.ehr_faculty_edit_patient(p_app text,p_session text,p_patient text,p_epoch integer,p_revision integer,p_edits jsonb,p_token text)
returns text language plpgsql security definer set search_path='' as $$
begin
  perform meditech_private.require_faculty_token(p_app,p_session,p_token);
  if jsonb_typeof(p_edits) is distinct from 'object' or meditech_private.contains_protected_scenario_keys(p_edits) then
    raise exception 'Scenario releases must be saved in Faculty controls.';
  end if;
  if meditech_private.lock_patient(p_app,p_session,p_patient)<>p_epoch then return 'stale'; end if;
  update public.ehr_patients set edits=p_edits,edit_revision=edit_revision+1,updated_at=clock_timestamp()
    where app=p_app and session_id=p_session and patient_id=p_patient and edit_revision=p_revision;
  return case when found then 'ok' else 'conflict' end;
end $$;
revoke all on function public.ehr_faculty_edit_patient(text,text,text,integer,integer,jsonb,text) from public, anon;
grant execute on function public.ehr_faculty_edit_patient(text,text,text,integer,integer,jsonb,text) to authenticated;

create or replace function public.ehr_faculty_reset_patient(p_app text,p_session text,p_patient text,p_epoch integer,p_token text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_epoch integer;
begin
  perform meditech_private.require_faculty_token(p_app,p_session,p_token);
  if meditech_private.lock_patient(p_app,p_session,p_patient)<>p_epoch then return jsonb_build_object('status','stale'); end if;
  update public.ehr_patients set epoch=epoch+1,real_start=null,released='{}'::jsonb,edits='{}'::jsonb,
    edit_revision=0,updated_at=clock_timestamp()
    where app=p_app and session_id=p_session and patient_id=p_patient returning epoch into v_epoch;
  delete from public.ehr_entries where app=p_app and session_id=p_session and patient_id=p_patient;
  delete from public.ehr_scenario_releases where app=p_app and session_id=p_session and patient_id=p_patient;
  update meditech_private.ehr_scenario_items set current_event=base_event,updated_at=clock_timestamp()
    where app=p_app and session_id=p_session and patient_id=p_patient and base_event is not null;
  delete from meditech_private.ehr_scenario_items where app=p_app and session_id=p_session and patient_id=p_patient and base_event is null;
  return jsonb_build_object('status','ok','epoch',v_epoch);
end $$;
revoke all on function public.ehr_faculty_reset_patient(text,text,text,integer,text) from public, anon;
grant execute on function public.ehr_faculty_reset_patient(text,text,text,integer,text) to authenticated;

create or replace function public.ehr_faculty_add_entry(p_app text,p_session text,p_patient text,p_epoch integer,p_section text,p_id text,p_entry jsonb,p_token text)
returns text language plpgsql security definer set search_path='' as $$
begin
  perform meditech_private.require_faculty_token(p_app,p_session,p_token);
  if p_section<>'orders' or coalesce(p_entry->'data'->>'kind','') not in ('approval','faculty','dc','correction','chart-correction') then
    raise exception 'This faculty action is not allowed.' using errcode='42501';
  end if;
  if meditech_private.lock_patient(p_app,p_session,p_patient)<>p_epoch then return 'stale'; end if;
  insert into public.ehr_entries(app,session_id,id,patient_id,epoch,section,entry,author)
    values(p_app,p_session,p_id,p_patient,p_epoch,p_section,p_entry,auth.uid()) on conflict do nothing;
  return 'ok';
end $$;
revoke all on function public.ehr_faculty_add_entry(text,text,text,integer,text,text,jsonb,text) from public, anon;
grant execute on function public.ehr_faculty_add_entry(text,text,text,integer,text,text,jsonb,text) to authenticated;

