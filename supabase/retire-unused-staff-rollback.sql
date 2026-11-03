-- Administrator-only rollback. Restores the existing tables and routine; creates no tables.
begin;
set local lock_timeout='5s';
alter table hewers_legacy.hewers_staff set schema public;
alter table hewers_legacy.hewers_staff_sites set schema public;
alter function hewers_legacy.hewers_save_staff(text,jsonb) set schema public;
grant all on public.hewers_staff,public.hewers_staff_sites to service_role;
grant execute on function public.hewers_save_staff(text,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
-- Restore the previous application release only if gateway staff access is needed again.
