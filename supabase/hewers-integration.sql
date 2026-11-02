begin;
alter table public.hewers_workspaces add column if not exists state jsonb;
alter table public.hewers_workspaces add column if not exists migrated_at timestamptz;
create table if not exists public.hewers_photo_uploads(storage_path text primary key,workspace_id text not null references public.hewers_workspaces(id),site_id text not null,created_at timestamptz not null default now(),foreign key(workspace_id,site_id) references public.hewers_sites(workspace_id,id));
alter table public.hewers_photo_uploads enable row level security;
revoke all on public.hewers_photo_uploads from anon,authenticated;
grant all on public.hewers_photo_uploads to service_role;
create index if not exists hewers_upload_site on public.hewers_photo_uploads(workspace_id,site_id);
create or replace function public.hewers_project_state() returns trigger language plpgsql security invoker set search_path='' as $$
begin
insert into public.hewers_sites(workspace_id,id,name,location) select new.id,x->>'id',x->>'name',x->>'location' from jsonb_array_elements(coalesce(new.state->'sites','[]'::jsonb)) x on conflict(workspace_id,id) do update set name=excluded.name,location=excluded.location;
insert into public.hewers_workers(workspace_id,id,site_id,full_name,trade) select new.id,x->>'id',x->>'siteId',x->>'name',x->>'trade' from jsonb_array_elements(coalesce(new.state->'workers','[]'::jsonb)) x on conflict(workspace_id,id) do update set site_id=excluded.site_id,full_name=excluded.full_name,trade=excluded.trade;
insert into public.hewers_materials(workspace_id,id,site_id,name,unit,balance,minimum_stock) select new.id,x->>'id',x->>'siteId',x->>'name',x->>'unit',(x->>'balance')::numeric,(x->>'minimum')::numeric from jsonb_array_elements(coalesce(new.state->'materials','[]'::jsonb)) x on conflict(workspace_id,id) do update set site_id=excluded.site_id,name=excluded.name,unit=excluded.unit,balance=excluded.balance,minimum_stock=excluded.minimum_stock;
insert into public.hewers_attendance(workspace_id,id,site_id,worker_id,time_in,time_out,method,time_out_method,note) select new.id,x->>'id',x->>'siteId',x->>'workerId',(x->>'timeIn')::timestamptz,(x->>'timeOut')::timestamptz,x->>'method',x->>'timeOutMethod',coalesce(x->>'note','') from jsonb_array_elements(coalesce(new.state->'attendance','[]'::jsonb)) x on conflict(workspace_id,id) do update set site_id=excluded.site_id,worker_id=excluded.worker_id,time_in=excluded.time_in,time_out=excluded.time_out,method=excluded.method,time_out_method=excluded.time_out_method,note=excluded.note;
insert into public.hewers_stock_movements(workspace_id,id,site_id,material_id,movement_type,quantity,note,recorded_by,created_at) select new.id,x->>'id',x->>'siteId',x->>'materialId',x->>'type',(x->>'quantity')::numeric,coalesce(x->>'note',''),x->>'actor',(x->>'created')::timestamptz from jsonb_array_elements(coalesce(new.state->'movements','[]'::jsonb)) x on conflict(workspace_id,id) do update set site_id=excluded.site_id,material_id=excluded.material_id,movement_type=excluded.movement_type,quantity=excluded.quantity,note=excluded.note,recorded_by=excluded.recorded_by,created_at=excluded.created_at;
insert into public.hewers_photos(workspace_id,id,site_id,transaction_id,storage_path,caption,category,uploaded_by,uploaded_at) select new.id,x->>'id',x->>'siteId',nullif(x->>'transactionId',''),replace(split_part(x->>'url','key=',2),'%2F','/'),x->>'caption',x->>'category',x->>'actor',(x->>'created')::timestamptz from jsonb_array_elements(coalesce(new.state->'photos','[]'::jsonb)) x on conflict(workspace_id,id) do update set site_id=excluded.site_id,transaction_id=excluded.transaction_id,storage_path=excluded.storage_path,caption=excluded.caption,category=excluded.category,uploaded_by=excluded.uploaded_by,uploaded_at=excluded.uploaded_at;
insert into public.hewers_audit_log(workspace_id,id,site_id,action,kind,actor,created_at) select new.id,x->>'id',nullif(x->>'siteId',''),x->>'action',x->>'kind',x->>'actor',(x->>'created')::timestamptz from jsonb_array_elements(coalesce(new.state->'audit','[]'::jsonb)) x on conflict(workspace_id,id) do update set site_id=excluded.site_id,action=excluded.action,kind=excluded.kind,actor=excluded.actor,created_at=excluded.created_at;
return new;end $$;
revoke all on function public.hewers_project_state() from public,anon,authenticated;
grant execute on function public.hewers_project_state() to service_role;
create trigger hewers_state_projection after insert or update of state on public.hewers_workspaces for each row execute function public.hewers_project_state();
create or replace function public.hewers_commit(p_owner text,p_revision bigint,p_state jsonb) returns boolean language plpgsql security invoker set search_path='' as $$
begin
 update public.hewers_workspaces set state=p_state,revision=revision+1 where id=p_owner and revision=p_revision;
 return found;
end $$;
revoke all on function public.hewers_commit(text,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.hewers_commit(text,bigint,jsonb) to service_role;
create or replace function public.hewers_save_staff(p_owner text,p_staff jsonb) returns void language plpgsql security invoker set search_path='' as $$
declare sid text;
begin
 insert into public.hewers_staff(workspace_id,id,user_id,email,full_name,role,active,created_at)
 values(p_owner,p_staff->>'id',p_staff->>'user_id',p_staff->>'email',p_staff->>'name',p_staff->>'role',coalesce((p_staff->>'active')::boolean,true),coalesce((p_staff->>'created')::timestamptz,now()))
 on conflict(workspace_id,email) do update set full_name=excluded.full_name,role=excluded.role,active=excluded.active returning id into sid;
 delete from public.hewers_staff_sites where workspace_id=p_owner and staff_id=sid;
 insert into public.hewers_staff_sites(workspace_id,staff_id,site_id) select p_owner,sid,value from jsonb_array_elements_text(p_staff->'siteIds');
end $$;
revoke all on function public.hewers_save_staff(text,jsonb) from public,anon,authenticated;
grant execute on function public.hewers_save_staff(text,jsonb) to service_role;
commit;
