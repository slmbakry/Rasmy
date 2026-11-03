-- Reminders are on by default, and owners turn them off for the whole
-- company or for one obligation.
alter table public.companies add column reminders_on boolean not null default true;

create table public.obligation_mutes (
  company_id uuid not null references public.companies (id) on delete cascade,
  rule_id text not null references public.obligation_rules (id),
  muted_at timestamptz not null default now(),
  primary key (company_id, rule_id)
);
alter table public.obligation_mutes enable row level security;
create policy obligation_mutes_owner on public.obligation_mutes for all to authenticated
  using ((select public.owns_company(company_id))) with check ((select public.owns_company(company_id)));

create or replace function public.obligation_reminders() returns void
language plpgsql security definer set search_path = '' as $$
declare c record; o record;
begin
  for c in select id, owner_id, name from public.companies where status <> 'closed' and not is_demo and reminders_on loop
    for o in select * from public.company_obligations(c.id, current_date - 30, current_date + 7) ob
        where not exists (select 1 from public.obligation_mutes m where m.company_id = c.id and m.rule_id = ob.rule_id) loop
      if o.due < current_date then
        perform public.notify(c.owner_id, null, false, 'overdue', 'فات موعد: ' || o.title,
          c.name || ' · كان الموعد ' || to_char(o.due, 'YYYY-MM-DD') || '. إذا أنجزته فعلّمه كمكتمل.', '/obligations',
          'ob-late:' || c.id || ':' || o.rule_id || ':' || o.period);
      else
        perform public.notify(c.owner_id, null, false, 'renew', 'يحل قريبًا: ' || o.title,
          c.name || ' · الموعد ' || to_char(o.due, 'YYYY-MM-DD'), '/obligations',
          'ob-soon:' || c.id || ':' || o.rule_id || ':' || o.period);
      end if;
    end loop;
  end loop;
end $$;
revoke all on function public.obligation_reminders() from public, anon, authenticated;
