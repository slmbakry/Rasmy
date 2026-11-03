-- Daily reminders for recurring obligations: a week before each due date,
-- and once more if it passes without being marked done. Periods and due
-- dates follow lib/obligations.ts, so the page and the reminders agree.

create or replace function public.company_obligations(p_company uuid, p_from date, p_to date)
returns table (rule_id text, title text, period text, due date)
language sql stable security definer set search_path = '' as $$
  with c as (
    select co.*, case when co.legal_form = 'منشأة فردية' then 'natural' else 'company' end entity
    from public.companies co where co.id = p_company
  ), r as (
    select r.* from public.obligation_rules r, c
    where r.active
      and (r.applies->>'entity' is null or r.applies->>'entity' = c.entity)
      and (r.applies->'vat' is null or c.vat_registered = (r.applies->>'vat')::boolean)
      and (r.applies->'employees' is null or c.has_employees = (r.applies->>'employees')::boolean)
      and (r.applies->'simplified' is null or coalesce(c.simplified_tax, false) = (r.applies->>'simplified')::boolean)
  ), periods as (
    -- monthly: the month itself; quarterly: the quarter's last month; annual: the year's last month
    select r.id, r.title, r.due d, to_char(m, 'YYYY-MM') period, m::date end_month
    from r, generate_series(date_trunc('month', current_date) - interval '4 months', date_trunc('month', current_date) + interval '13 months', interval '1 month') m
    where r.frequency = 'monthly'
    union all
    select r.id, r.title, r.due, y || '-Q' || q, make_date(y, q * 3, 1)
    from r, generate_series(extract(year from current_date)::int - 1, extract(year from current_date)::int + 1) y, generate_series(1, 4) q
    where r.frequency = 'quarterly'
    union all
    select r.id, r.title, r.due, y::text, make_date(y, case when r.due->>'type' = 'fixed' then 12 else (select fiscal_year_end from c) end, 1)
    from r, generate_series(extract(year from current_date)::int - 1, extract(year from current_date)::int + 1) y
    where r.frequency = 'annual'
  ), dated as (
    select id, title, period, case d->>'type'
      when 'month_end' then (end_month + make_interval(months => coalesce((d->>'after')::int, 0) + 1) - interval '1 day')::date
      when 'day' then (end_month + make_interval(months => coalesce((d->>'after')::int, 0)) + make_interval(days => coalesce((d->>'day')::int, 1) - 1))::date
      when 'fy_months' then (end_month + make_interval(months => coalesce((d->>'months')::int, 0) + 1) - interval '1 day')::date
      else make_date(extract(year from end_month)::int + 1, (d->>'month')::int, (d->>'day')::int)
    end due from periods
  )
  select id, title, period, due from dated where due between p_from and p_to
    and not exists (select 1 from public.obligation_done o where o.company_id = p_company and o.rule_id = dated.id and o.period = dated.period);
$$;
revoke all on function public.company_obligations(uuid, date, date) from public, anon, authenticated;

create or replace function public.obligation_reminders() returns void
language plpgsql security definer set search_path = '' as $$
declare c record; o record;
begin
  for c in select id, owner_id, name from public.companies where status <> 'closed' and not is_demo loop
    for o in select * from public.company_obligations(c.id, current_date - 30, current_date + 7) loop
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

select cron.schedule('obligation-reminders', '23 5 * * *', 'select public.obligation_reminders()');
