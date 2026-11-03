begin;
alter table public.hewers_stock_movements drop constraint hewers_stock_movements_movement_type_check;
alter table public.hewers_stock_movements add constraint hewers_stock_movements_movement_type_check check (movement_type in ('Opening','Delivery','Issue','Return','Damage','Loss','Adjustment'));
alter table public.hewers_stock_movements add column if not exists adjustment_delta numeric, add column if not exists reconciliation_id text;
alter table public.hewers_attendance add column if not exists correction_id text;
-- Workspace JSON remains authoritative; these tables provide queryable approval history.
create table if not exists public.hewers_operation_reviews (
 workspace_id text not null references public.hewers_workspaces(id), id text not null,
 site_id text not null, kind text not null check(kind in ('attendance','stock')),
 status text not null check(status in ('pending','accepted','declined')),
 created_at timestamptz not null, created_by text not null, reviewed_at timestamptz, reviewed_by text,
 details jsonb not null, primary key(workspace_id,id),
 foreign key(workspace_id,site_id) references public.hewers_sites(workspace_id,id)
);
create index if not exists hewers_operation_reviews_pending on public.hewers_operation_reviews(workspace_id,status,created_at desc);
create index if not exists hewers_operation_reviews_site on public.hewers_operation_reviews(workspace_id,site_id);
alter table public.hewers_operation_reviews enable row level security;
revoke all on public.hewers_operation_reviews from public,anon,authenticated;
grant all on public.hewers_operation_reviews to service_role;
create or replace function public.hewers_project_operation_reviews() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 insert into public.hewers_operation_reviews(workspace_id,id,site_id,kind,status,created_at,created_by,reviewed_at,reviewed_by,details)
 select new.id,x->>'id',x->>'siteId','attendance',x->>'status',(x->>'created')::timestamptz,x->>'createdBy',(x->>'reviewedAt')::timestamptz,x->>'reviewedBy',x
 from jsonb_array_elements(coalesce(new.state->'attendanceCorrections','[]'::jsonb)) x
 union all
 select new.id,x->>'id',x->>'siteId','stock',x->>'status',(x->>'created')::timestamptz,x->>'createdBy',(x->>'reviewedAt')::timestamptz,x->>'reviewedBy',x
 from jsonb_array_elements(coalesce(new.state->'stockReconciliations','[]'::jsonb)) x
 on conflict(workspace_id,id) do update set status=excluded.status,reviewed_at=excluded.reviewed_at,reviewed_by=excluded.reviewed_by,details=excluded.details;
 update public.hewers_attendance a set correction_id=x->>'correctionId'
 from jsonb_array_elements(coalesce(new.state->'attendance','[]'::jsonb)) x where a.workspace_id=new.id and a.id=x->>'id';
 update public.hewers_stock_movements m set adjustment_delta=(x->>'adjustmentDelta')::numeric,reconciliation_id=x->>'reconciliationId'
 from jsonb_array_elements(coalesce(new.state->'movements','[]'::jsonb)) x where m.workspace_id=new.id and m.id=x->>'id';
 return new;
end $$;
revoke all on function public.hewers_project_operation_reviews() from public,anon,authenticated;
grant execute on function public.hewers_project_operation_reviews() to service_role;
-- Alphabetical trigger order places this after the existing state projection.
create trigger hewers_z_operation_reviews after insert or update of state on public.hewers_workspaces for each row execute function public.hewers_project_operation_reviews();
commit;
