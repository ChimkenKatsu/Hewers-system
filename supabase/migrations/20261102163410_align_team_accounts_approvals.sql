begin;
-- Account metadata only. Password hashes and sessions remain in the private auth database.
create table if not exists public.hewers_team_accounts (
 workspace_id text not null references public.hewers_workspaces(id),
 id text not null, username text not null, full_name text not null,
 role text not null check(role in ('administrator','auditor')),
 active boolean not null, must_change_password boolean not null,
 updated_at timestamptz not null default now(),
 primary key(workspace_id,id), unique(workspace_id,username)
);
create table if not exists public.hewers_team_account_sites (
 workspace_id text not null, account_id text not null, site_id text not null,
 primary key(workspace_id,account_id,site_id),
 foreign key(workspace_id,account_id) references public.hewers_team_accounts(workspace_id,id),
 foreign key(workspace_id,site_id) references public.hewers_sites(workspace_id,id)
);
create index if not exists hewers_team_sites_site on public.hewers_team_account_sites(workspace_id,site_id);
create table if not exists public.hewers_worker_requests (
 workspace_id text not null references public.hewers_workspaces(id), id text not null,
 site_id text not null, full_name text not null, trade text not null,
 status text not null check(status in ('pending','accepted','declined')),
 created_at timestamptz not null, created_by text not null,
 reviewed_at timestamptz, reviewed_by text, worker_id text, reason text,
 primary key(workspace_id,id),
 foreign key(workspace_id,site_id) references public.hewers_sites(workspace_id,id),
 foreign key(workspace_id,worker_id) references public.hewers_workers(workspace_id,id),
 check((status='pending' and reviewed_at is null and reviewed_by is null and worker_id is null)
  or (status='accepted' and reviewed_at is not null and reviewed_by is not null and worker_id is not null)
  or (status='declined' and reviewed_at is not null and reviewed_by is not null and worker_id is null))
);
create index if not exists hewers_requests_status on public.hewers_worker_requests(workspace_id,status,created_at desc);
create index if not exists hewers_requests_site on public.hewers_worker_requests(workspace_id,site_id);
create index if not exists hewers_requests_worker on public.hewers_worker_requests(workspace_id,worker_id);
alter table public.hewers_team_accounts enable row level security;
alter table public.hewers_team_account_sites enable row level security;
alter table public.hewers_worker_requests enable row level security;
revoke all on public.hewers_team_accounts,public.hewers_team_account_sites,public.hewers_worker_requests from public,anon,authenticated;
grant all on public.hewers_team_accounts,public.hewers_team_account_sites,public.hewers_worker_requests to service_role;
create or replace function public.hewers_sync_team_accounts(p_owner text,p_accounts jsonb)
returns void language plpgsql security invoker set search_path='' as $$
declare a jsonb;
begin
 for a in select value from jsonb_array_elements(p_accounts) loop
  insert into public.hewers_team_accounts(workspace_id,id,username,full_name,role,active,must_change_password)
  values(p_owner,a->>'id',a->>'username',a->>'name',a->>'role',(a->>'active')::boolean,(a->>'mustChangePassword')::boolean)
  on conflict(workspace_id,id) do update set username=excluded.username,full_name=excluded.full_name,role=excluded.role,active=excluded.active,must_change_password=excluded.must_change_password,updated_at=now();
  delete from public.hewers_team_account_sites where workspace_id=p_owner and account_id=a->>'id';
  if a->>'role'='auditor' then
   insert into public.hewers_team_account_sites(workspace_id,account_id,site_id)
   select p_owner,a->>'id',value from jsonb_array_elements_text(a->'siteIds');
  end if;
 end loop;
end $$;
revoke all on function public.hewers_sync_team_accounts(text,jsonb) from public,anon,authenticated;
grant execute on function public.hewers_sync_team_accounts(text,jsonb) to service_role;
create or replace function public.hewers_project_worker_requests() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 insert into public.hewers_worker_requests(workspace_id,id,site_id,full_name,trade,status,created_at,created_by,reviewed_at,reviewed_by,worker_id,reason)
 select new.id,x->>'id',x->>'siteId',x->>'name',x->>'trade',x->>'status',(x->>'created')::timestamptz,x->>'createdBy',(x->>'reviewedAt')::timestamptz,x->>'reviewedBy',x->>'workerId',x->>'reason'
 from jsonb_array_elements(coalesce(new.state->'workerRequests','[]'::jsonb)) x
 on conflict(workspace_id,id) do update set status=excluded.status,reviewed_at=excluded.reviewed_at,reviewed_by=excluded.reviewed_by,worker_id=excluded.worker_id,reason=excluded.reason;
 return new;
end $$;
revoke all on function public.hewers_project_worker_requests() from public,anon,authenticated;
grant execute on function public.hewers_project_worker_requests() to service_role;
-- Runs after the existing state projection has inserted sites and accepted workers.
drop trigger if exists hewers_worker_request_projection on public.hewers_workspaces;
create trigger hewers_worker_request_projection after insert or update of state on public.hewers_workspaces
for each row execute function public.hewers_project_worker_requests();
update public.hewers_workspaces set state=state where state is not null;
notify pgrst,'reload schema';
commit;
