-- Run once in YOUR new Supabase project's SQL editor.
-- Only approved signed-in members can access simulation chart data.
create table if not exists public.simulation_members (
 user_id uuid references auth.users(id) on delete cascade,
 session_id text not null,
 primary key (user_id,session_id)
);
alter table public.simulation_members enable row level security;
create policy "members see their own membership" on public.simulation_members
 for select to authenticated using (user_id = (select auth.uid()));
grant select on public.simulation_members to authenticated;
revoke all on public.simulation_members from anon;

create table if not exists public.ehr_sync (
 collection text not null default 'app',
 item_id text not null,
 payload jsonb not null default '{}'::jsonb,
 revision bigint not null default 0,
 updated_by text,
 updated_at timestamptz not null default now(),
 primary key(collection,item_id)
);
alter table public.ehr_sync enable row level security;
create policy "approved simulation members" on public.ehr_sync
 for all to authenticated
 using (exists (select 1 from public.simulation_members m where m.user_id=(select auth.uid()) and m.session_id=item_id))
 with check (exists (select 1 from public.simulation_members m where m.user_id=(select auth.uid()) and m.session_id=item_id));
grant select,update on public.ehr_sync to authenticated;
revoke all on public.ehr_sync from anon;

create or replace function public.save_simulation_state(p_session text,p_revision bigint,p_payload jsonb,p_client text)
returns boolean language plpgsql security invoker set search_path='' as $$
begin
 update public.ehr_sync set payload=p_payload,revision=revision+1,updated_by=p_client,updated_at=now()
 where collection='app' and item_id=p_session and revision=p_revision;
 return found;
end;
$$;
revoke all on function public.save_simulation_state(text,bigint,jsonb,text) from public,anon;
grant execute on function public.save_simulation_state(text,bigint,jsonb,text) to authenticated;
insert into public.ehr_sync(collection,item_id) values('app','simulation-state') on conflict do nothing;
alter publication supabase_realtime add table public.ehr_sync;

-- After creating each user in Authentication > Users, approve the account using:
-- insert into public.simulation_members(user_id,session_id)
-- select id,'simulation-state' from auth.users where email='APPROVED_ACCOUNT_EMAIL'
-- on conflict do nothing;

-- Private uploaded diagnostic attachments for approved hospital members.
insert into storage.buckets(id,name,public) values ('diagnostics','diagnostics',false) on conflict do nothing;
create policy "approved diagnostic readers" on storage.objects for select to authenticated using(bucket_id='diagnostics' and exists(select 1 from public.simulation_members where user_id=(select auth.uid()) and session_id='simulation-state'));
create policy "approved diagnostic uploads" on storage.objects for insert to authenticated with check(bucket_id='diagnostics' and exists(select 1 from public.simulation_members where user_id=(select auth.uid()) and session_id='simulation-state'));
