-- Atomic migration. Keep ehr_sync as the pre-migration recovery copy; do not delete it.
begin;
-- Freeze legacy writers while copying; queued old saves will receive the reload message.
lock table public.ehr_sync in access exclusive mode;
create table if not exists public.ehr_sync_heads (
 item_id text primary key, revision bigint not null, updated_by text, updated_at timestamptz not null default now()
);
create table if not exists public.ehr_sync_records (
 item_id text not null references public.ehr_sync_heads(item_id), collection text not null, record_id text not null,
 value jsonb, deleted boolean not null default false, revision bigint not null,
 primary key(item_id,collection,record_id)
);
create index if not exists ehr_sync_records_changes on public.ehr_sync_records(item_id,revision);
create table if not exists public.ehr_simulation_reports (
 item_id text not null references public.ehr_sync_heads(item_id), report_id text not null, payload jsonb not null,
 primary key(item_id,report_id)
);
alter table public.ehr_sync_heads enable row level security;
alter table public.ehr_sync_records enable row level security;
alter table public.ehr_simulation_reports enable row level security;
do $$ declare t text; begin
 foreach t in array array['ehr_sync_heads','ehr_sync_records','ehr_simulation_reports'] loop
  if not exists(select 1 from pg_policies where schemaname='public' and tablename=t and policyname='approved hospital readers') then
   execute format('create policy "approved hospital readers" on public.%I for select to authenticated using (exists (select 1 from public.simulation_members m where m.user_id=(select auth.uid()) and m.session_id=item_id))',t);
  end if;
  execute format('revoke all on public.%I from anon, authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
 end loop;
end $$;

-- Match the browser codec: one record per array id or object key, plus a small layout record.
do $$ declare s record; k text; v jsonb; e jsonb; shape jsonb; rid text; inserted integer; begin
 for s in select * from public.ehr_sync where collection='app' loop
  insert into public.ehr_sync_heads(item_id,revision,updated_by) values(s.item_id,s.revision,s.updated_by) on conflict do nothing;
  get diagnostics inserted=row_count;
  if inserted=0 then continue; end if;
  for k,v in select * from jsonb_each(s.payload) loop
   if jsonb_typeof(v)='array' and not exists(select 1 from jsonb_array_elements(v) x where jsonb_typeof(x->'id') is distinct from 'string')
      and (select count(*)=count(distinct x->>'id') from jsonb_array_elements(v) x) then
    shape=jsonb_build_object('kind','array','ids',coalesce((select jsonb_agg(x->'id') from jsonb_array_elements(v) x),'[]'::jsonb));
    for e in select * from jsonb_array_elements(v) loop
     rid=e->>'id';
     if k='simulationReports' then
      if not(e ? 'collections') then raise exception 'An existing report is incomplete; migration stopped.'; end if;
      insert into public.ehr_simulation_reports values(s.item_id,rid,e);
      e=(e-'collections'-'chartRecords')||'{"archived":true}'::jsonb;
     end if;
     insert into public.ehr_sync_records values(s.item_id,k,'r:'||rid,e,false,s.revision);
    end loop;
   elsif jsonb_typeof(v)='object' then
    shape=jsonb_build_object('kind','object','keys',coalesce((select jsonb_agg(x) from jsonb_object_keys(v) x),'[]'::jsonb));
    for rid,e in select * from jsonb_each(v) loop
     insert into public.ehr_sync_records values(s.item_id,k,'r:'||rid,e,false,s.revision);
    end loop;
   else shape=jsonb_build_object('kind','value','value',v);
   end if;
   insert into public.ehr_sync_records values(s.item_id,k,'$',shape,false,s.revision);
  end loop;
 end loop;
end $$;

-- A single SQL snapshot reads the head and its changed records consistently.
create or replace function public.read_simulation_changes(p_session text,p_since bigint)
returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('revision',h.revision,'updated_by',h.updated_by,'records',coalesce((
  select jsonb_agg(jsonb_build_object('collection',r.collection,'record_id',r.record_id,'value',r.value,'deleted',r.deleted))
  from public.ehr_sync_records r where r.item_id=h.item_id and r.revision>p_since
 ),'[]'::jsonb)) from public.ehr_sync_heads h where h.item_id=p_session;
$$;
create or replace function public.get_simulation_report(p_session text,p_id text)
returns jsonb language sql stable security invoker set search_path='' as $$
 select payload from public.ehr_simulation_reports where item_id=p_session and report_id=p_id;
$$;
create or replace function public.save_simulation_changes(p_session text,p_revision bigint,p_changes jsonb,p_reports jsonb,p_client text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare current_revision bigint; next_revision bigint; c jsonb; r jsonb; begin
 if not exists(select 1 from public.simulation_members where user_id=(select auth.uid()) and session_id=p_session) then
  raise exception 'This account is not approved for this hospital.' using errcode='42501';
 end if;
 select revision into current_revision from public.ehr_sync_heads where item_id=p_session for update;
 if current_revision is null then raise exception 'Simulation session not found.'; end if;
 if current_revision<>p_revision then return jsonb_build_object('ok',false,'revision',current_revision); end if;
 if jsonb_typeof(p_changes) is distinct from 'array' or jsonb_typeof(p_reports) is distinct from 'array' then raise exception 'Invalid chart changes.'; end if;
 if jsonb_array_length(p_changes)=0 and jsonb_array_length(p_reports)=0 then return jsonb_build_object('ok',true,'revision',current_revision); end if;
 next_revision=current_revision+1;
 for r in select * from jsonb_array_elements(p_reports) loop
  if jsonb_typeof(r->'id') is distinct from 'string' or not(r ? 'collections') or not(r ? 'chartRecords') then raise exception 'Incomplete archive.'; end if;
  insert into public.ehr_simulation_reports(item_id,report_id,payload) values(p_session,r->>'id',r) on conflict do nothing;
 end loop;
 for c in select * from jsonb_array_elements(p_changes) loop
  if jsonb_typeof(c->'collection') is distinct from 'string' or jsonb_typeof(c->'record_id') is distinct from 'string' or c->>'collection' in ('__proto__','constructor','prototype') then raise exception 'Invalid record.'; end if;
  if c->>'collection'='simulationReports' and c->>'record_id'<>'$' then
   if coalesce((c->>'deleted')::boolean,false) then raise exception 'Archived reports cannot be removed.'; end if;
   if not exists(select 1 from public.ehr_simulation_reports where item_id=p_session and report_id=c->'value'->>'id') then raise exception 'Archive must be saved before its index.'; end if;
   if c->'value' ? 'collections' or c->'value' ? 'chartRecords' then raise exception 'Only report summaries belong in live synchronization.'; end if;
  end if;
  insert into public.ehr_sync_records(item_id,collection,record_id,value,deleted,revision)
   values(p_session,c->>'collection',c->>'record_id',c->'value',coalesce((c->>'deleted')::boolean,false),next_revision)
   on conflict(item_id,collection,record_id) do update set value=excluded.value,deleted=excluded.deleted,revision=excluded.revision;
 end loop;
 update public.ehr_sync_heads set revision=next_revision,updated_by=p_client,updated_at=now() where item_id=p_session;
 return jsonb_build_object('ok',true,'revision',next_revision);
end;
$$;
revoke all on function public.read_simulation_changes(text,bigint) from public,anon;
revoke all on function public.get_simulation_report(text,text) from public,anon;
revoke all on function public.save_simulation_changes(text,bigint,jsonb,jsonb,text) from public,anon;
grant execute on function public.read_simulation_changes(text,bigint), public.get_simulation_report(text,text), public.save_simulation_changes(text,bigint,jsonb,jsonb,text) to authenticated;

-- Old tabs must reload. Prevent old clients from downloading or replacing the frozen recovery copy.
create or replace function public.save_simulation_state(p_session text,p_revision bigint,p_payload jsonb,p_client text)
returns boolean language plpgsql security invoker set search_path='' as $$
begin raise exception 'The hospital was updated. Reload this tab to reconnect. Unsaved chart entries remain on this computer.'; end;
$$;
revoke select,update on public.ehr_sync from authenticated;
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  if exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='ehr_sync') then alter publication supabase_realtime drop table public.ehr_sync; end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='ehr_sync_heads') then alter publication supabase_realtime add table public.ehr_sync_heads; end if;
 end if;
end $$;
commit;
