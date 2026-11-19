begin;

create table if not exists public.hewers_weekly_payroll (
  workspace_id text not null,
  idnum text not null,
  name text not null check (btrim(name) <> ''),
  rate numeric(12, 4) check (rate between 0 and 99999999.9999),
  hr_rate numeric(12, 4) not null check (hr_rate between 0 and 99999999.9999),
  week_start date not null,
  hours_to_pay numeric(8, 4) not null check (hours_to_pay between 0 and 168),
  weekly_pay numeric(16, 2) generated always as (round(hr_rate * hours_to_pay, 2)) stored,
  primary key (workspace_id, idnum, week_start),
  foreign key (workspace_id, idnum) references public.hewers_workers (workspace_id, id)
);

alter table public.hewers_weekly_payroll enable row level security;
revoke all on public.hewers_weekly_payroll from public, anon, authenticated;
grant select, insert, update, delete on public.hewers_weekly_payroll to service_role;

comment on column public.hewers_weekly_payroll.rate is
  'Optional reference rate. Weekly gross pay uses hr_rate and hours_to_pay.';
comment on column public.hewers_weekly_payroll.hours_to_pay is
  'Reviewed payable hours for the seven-day period beginning on week_start.';

commit;
