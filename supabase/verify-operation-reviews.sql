-- All fixture records are rolled back.
begin;
insert into public.hewers_workspaces(id,owner_email,state,revision)
values('hewers-review-schema-check','schema-check@example.test','{"sites":[{"id":"s","name":"Test","location":"Test"}],"workers":[{"id":"w","name":"Test Worker","trade":"Mason","siteId":"s"}],"materials":[{"id":"m","name":"Cement","unit":"bags","siteId":"s","balance":7,"minimum":2}],"attendance":[{"id":"a","workerId":"w","siteId":"s","timeIn":"2026-11-03T00:00:00Z","timeOut":null,"method":"Manual","note":"Test","correctionId":"c"}],"movements":[{"id":"v","materialId":"m","siteId":"s","type":"Adjustment","quantity":3,"adjustmentDelta":-3,"reconciliationId":"r","note":"Test adjustment","created":"2026-11-03T01:00:00Z","actor":"admin"}],"photos":[],"audit":[],"attendanceCorrections":[{"id":"c","attendanceId":"a","workerId":"w","siteId":"s","status":"accepted","reason":"Test correction","created":"2026-11-03T00:00:00Z","createdBy":"auditor","reviewedAt":"2026-11-03T01:00:00Z","reviewedBy":"admin","originalIn":"2026-11-03T00:05:00Z","originalOut":null,"proposedIn":"2026-11-03T00:00:00Z","proposedOut":null}],"stockReconciliations":[{"id":"r","materialId":"m","siteId":"s","status":"accepted","reason":"Test count","created":"2026-11-03T00:00:00Z","createdBy":"auditor","reviewedAt":"2026-11-03T01:00:00Z","reviewedBy":"admin","systemBalance":10,"countedBalance":7,"movementId":"v"}]}',0);
do $$begin
 if (select count(*) from public.hewers_operation_reviews where workspace_id='hewers-review-schema-check')<>2 then raise exception 'Review projection missing';end if;
 if not exists(select 1 from public.hewers_stock_movements where workspace_id='hewers-review-schema-check' and adjustment_delta=-3 and reconciliation_id='r') then raise exception 'Signed adjustment missing';end if;
 if not exists(select 1 from public.hewers_attendance where workspace_id='hewers-review-schema-check' and correction_id='c') then raise exception 'Correction reference missing';end if;
 if has_table_privilege('anon','public.hewers_operation_reviews','SELECT') or has_table_privilege('authenticated','public.hewers_operation_reviews','SELECT') then raise exception 'Public privilege leak';end if;
 if not(select relrowsecurity from pg_class where oid='public.hewers_operation_reviews'::regclass) then raise exception 'RLS disabled';end if;
end $$;
rollback;
select 'PASS: reviews, correction references, signed adjustments, RLS and public access; fixtures rolled back' as result;
