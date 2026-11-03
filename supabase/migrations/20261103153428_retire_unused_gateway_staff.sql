-- Retire only the two verified-empty, obsolete gateway-staff tables.
-- Deploy the application change retiring /api/staff on Supabase first.
-- No tables or data are created or deleted. ALTER ... SET SCHEMA is reversible.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
lock table public.hewers_staff,public.hewers_staff_sites in access exclusive mode;
do $$begin
 if exists(select 1 from public.hewers_staff) or exists(select 1 from public.hewers_staff_sites) then
  raise exception 'Legacy staff data exists. Stop and migrate it before retiring these tables.';
 end if;
 if exists(select 1 from pg_constraint where contype='f' and confrelid in ('public.hewers_staff'::regclass,'public.hewers_staff_sites'::regclass) and conrelid not in ('public.hewers_staff'::regclass,'public.hewers_staff_sites'::regclass)) then
  raise exception 'An active table still depends on legacy staff. Stop and review the dependency.';
 end if;
end $$;
create schema if not exists hewers_legacy;
revoke all on schema hewers_legacy from public,anon,authenticated,service_role;
alter table public.hewers_staff_sites set schema hewers_legacy;
alter table public.hewers_staff set schema hewers_legacy;
alter function public.hewers_save_staff(text,jsonb) set schema hewers_legacy;
revoke all on hewers_legacy.hewers_staff,hewers_legacy.hewers_staff_sites from public,anon,authenticated,service_role;
revoke all on function hewers_legacy.hewers_save_staff(text,jsonb) from public,anon,authenticated,service_role;
comment on schema hewers_legacy is 'Inactive empty gateway-staff schema retained only for rollback; not exposed to the application.';
notify pgrst,'reload schema';
commit;
