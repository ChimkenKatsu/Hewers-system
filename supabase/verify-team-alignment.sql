-- Read-only with respect to persistent records: all fixtures are rolled back.
begin;
insert into public.hewers_workspaces(id,owner_email,state,revision)
values('hewers-schema-check','schema-check@example.test','{"sites":[{"id":"site","name":"Test","location":"Test"}],"workers":[],"workerRequests":[],"materials":[],"attendance":[],"movements":[],"photos":[],"audit":[]}',0);
select public.hewers_sync_team_accounts('hewers-schema-check','[{"id":"admin","username":"admin","name":"Admin","role":"administrator","active":true,"mustChangePassword":false,"siteIds":[]},{"id":"auditor","username":"auditor","name":"Auditor","role":"auditor","active":true,"mustChangePassword":true,"siteIds":["site"]}]');
update public.hewers_workspaces set state=jsonb_set(state,'{workerRequests}','[{"id":"request","name":"Worker","trade":"Mason","siteId":"site","status":"pending","created":"2026-11-02T00:00:00Z","createdBy":"auditor"}]') where id='hewers-schema-check';
do $$begin
 if (select count(*) from public.hewers_team_accounts where workspace_id='hewers-schema-check')<>2 then raise exception 'Account metadata missing'; end if;
 if (select count(*) from public.hewers_team_account_sites where workspace_id='hewers-schema-check')<>1 then raise exception 'Auditor assignment missing'; end if;
 if (select count(*) from public.hewers_worker_requests where workspace_id='hewers-schema-check' and status='pending')<>1 then raise exception 'Pending projection missing'; end if;
 if exists(select 1 from public.hewers_workers where workspace_id='hewers-schema-check') then raise exception 'Pending request became worker'; end if;
end $$;
update public.hewers_workspaces set state=jsonb_set(jsonb_set(state,'{workers}','[{"id":"worker","name":"Worker","trade":"Mason","siteId":"site"}]'),'{workerRequests}','[{"id":"request","name":"Worker","trade":"Mason","siteId":"site","status":"accepted","created":"2026-11-02T00:00:00Z","createdBy":"auditor","reviewedAt":"2026-11-02T01:00:00Z","reviewedBy":"admin","workerId":"worker"}]') where id='hewers-schema-check';
do $$begin
 if not exists(select 1 from public.hewers_worker_requests where workspace_id='hewers-schema-check' and status='accepted' and reviewed_by='admin' and worker_id='worker') then raise exception 'Approval history missing'; end if;
 if has_table_privilege('anon','public.hewers_team_accounts','SELECT') or has_table_privilege('authenticated','public.hewers_worker_requests','SELECT') or has_function_privilege('anon','public.hewers_sync_team_accounts(text,jsonb)','EXECUTE') then raise exception 'Public privilege leak'; end if;
end $$;
rollback;
select 'PASS: account metadata, assigned sites, pending and accepted projections, public access denied; fixtures rolled back' as result;
