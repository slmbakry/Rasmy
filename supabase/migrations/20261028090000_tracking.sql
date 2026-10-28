-- Phase 5: notifications, delay alerts, escalation, renewal reminders, objective office stats.

create extension if not exists pg_cron;

alter table public.requests add column if not exists escalated_at timestamptz;

-- One notification goes to a person, an office (all its users) or the admins.
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  office_id uuid references public.offices(id) on delete cascade,
  for_admin boolean not null default false,
  kind text not null,
  title text not null,
  body text,
  link text,
  dedup text unique,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  check (user_id is not null or office_id is not null or for_admin)
);
create index on public.notifications(user_id, created_at desc);
create index on public.notifications(office_id, created_at desc);
alter table public.notifications enable row level security;
create policy notifications_read on public.notifications for select to authenticated
  using (user_id = (select auth.uid()) or (office_id is not null and office_id = (select public.my_office())) or (select public.is_admin()));
create policy notifications_mark on public.notifications for update to authenticated
  using (user_id = (select auth.uid()) or (office_id is not null and office_id = (select public.my_office())) or (select public.is_admin()))
  with check (user_id = (select auth.uid()) or (office_id is not null and office_id = (select public.my_office())) or (select public.is_admin()));
revoke insert, update, delete on public.notifications from anon, authenticated;
grant update (read_at) on public.notifications to authenticated;

create or replace function public.notify(p_user uuid, p_office uuid, p_admin boolean, p_kind text, p_title text, p_body text, p_link text, p_dedup text)
returns void language sql security definer set search_path = '' as $$
  insert into public.notifications (user_id, office_id, for_admin, kind, title, body, link, dedup)
  values (p_user, p_office, p_admin, p_kind, p_title, p_body, p_link, p_dedup)
  on conflict (dedup) do nothing;
$$;
revoke all on function public.notify(uuid, uuid, boolean, text, text, text, text, text) from public, anon, authenticated;

-- Every request event tells the other side, never the person who acted.
create or replace function public.handle_event_notify() returns trigger
language plpgsql security definer set search_path = '' as $$
declare r public.requests%rowtype; svc text; co text; actor_office uuid;
  to_owner boolean; to_office boolean; t text; b text;
begin
  select * into r from public.requests where id = new.request_id;
  select title into svc from public.services where id = r.service_id;
  select name into co from public.companies where id = r.company_id;
  select office_id into actor_office from public.profiles where id = new.actor_id;
  to_owner := new.actor_id is distinct from r.owner_id;
  to_office := r.office_id is not null and actor_office is distinct from r.office_id;
  b := svc || ' · ' || co;
  case new.kind
    when 'created' then
      if to_office then perform public.notify(null, r.office_id, false, 'new_request', 'طلب جديد مستني ردك', b, '#job/' || r.id, null); end if;
    when 'accepted' then
      if to_owner then perform public.notify(r.owner_id, null, false, 'accepted', 'المكتب قبل طلبك', b, '#request/' || r.id, null); end if;
    when 'declined' then
      if to_owner then perform public.notify(r.owner_id, null, false, 'declined', 'المكتب اعتذر عن طلبك', b || coalesce(' · ' || new.note, ''), '#request/' || r.id, null); end if;
    when 'stage_done' then
      if to_owner then perform public.notify(r.owner_id, null, false, 'stage_done', 'خلصت مرحلة: ' || coalesce(new.note, ''), b, '#request/' || r.id, null); end if;
    when 'done' then
      if to_owner then perform public.notify(r.owner_id, null, false, 'done', 'خلص طلبك، قيّم المكتب', b, '#request/' || r.id, null); end if;
    when 'cancelled' then
      if to_office then perform public.notify(null, r.office_id, false, 'cancelled', 'صاحب العمل لغى الطلب', b, '#job/' || r.id, null); end if;
    when 'note', 'file' then
      t := case new.kind when 'note' then 'ملاحظة جديدة' else 'ملف جديد' end;
      if to_owner then perform public.notify(r.owner_id, null, false, new.kind, t, b || coalesce(' · ' || new.note, ''), '#request/' || r.id, null); end if;
      if to_office and not to_owner then perform public.notify(null, r.office_id, false, new.kind, t, b || coalesce(' · ' || new.note, ''), '#job/' || r.id, null); end if;
    else null;
  end case;
  return new;
end $$;
revoke all on function public.handle_event_notify() from public, anon, authenticated;
create trigger on_event_notify after insert on public.events
  for each row execute function public.handle_event_notify();

-- Hourly check: unanswered requests, late stages, missed deadlines, renewals.
-- Each alert fires once (dedup key); escalation to admins comes after a grace period.
create or replace function public.rasmy_check() returns void
language plpgsql security definer set search_path = '' as $$
declare x record; grace constant int := 3;
begin
  -- Office has not answered a new request.
  for x in select r.*, s.title svc, c.name co from public.requests r
      join public.services s on s.id = r.service_id join public.companies c on c.id = r.company_id
      where r.status = 'new' and r.office_id is not null and r.created_at < now() - interval '1 day' loop
    perform public.notify(null, x.office_id, false, 'wait', 'طلب مستني ردك من أكتر من يوم', x.svc || ' · ' || x.co, '#job/' || x.id, 'wait:' || x.id);
    if x.created_at < now() - interval '2 days' then
      perform public.notify(x.owner_id, null, false, 'wait', 'المكتب لسه مارد على طلبك', 'تقدر تلغي الطلب وتختار مكتب تاني · ' || x.svc, '#request/' || x.id, 'wait-owner:' || x.id);
      perform public.notify(null, null, true, 'escalated', 'مكتب مارد على طلب من يومين', x.svc || ' · ' || x.co, '#request/' || x.id, 'esc-wait:' || x.id);
      update public.requests set escalated_at = coalesce(escalated_at, now()) where id = x.id;
    end if;
  end loop;

  -- The current stage ran past its planned days.
  for x in select r.id, r.owner_id, r.office_id, st.id stage_id, st.title stage, s.title svc, c.name co,
        st.started_at + make_interval(days => st.planned_days) due
      from public.requests r
      join lateral (select * from public.request_stages where request_id = r.id and done_at is null order by idx limit 1) st on true
      join public.services s on s.id = r.service_id join public.companies c on c.id = r.company_id
      where r.status in ('accepted','in_progress') and st.started_at is not null
        and st.started_at + make_interval(days => st.planned_days) < now() loop
    if x.office_id is not null then
      perform public.notify(null, x.office_id, false, 'late', 'مرحلة متأخرة: ' || x.stage, x.svc || ' · ' || x.co, '#job/' || x.id, 'late:' || x.stage_id);
      perform public.notify(x.owner_id, null, false, 'late', 'مرحلة اتأخرت عند المكتب: ' || x.stage, x.svc || ' · ' || x.co, '#request/' || x.id, 'late-owner:' || x.stage_id);
      if x.due < now() - make_interval(days => grace) then
        perform public.notify(null, null, true, 'escalated', 'مرحلة متأخرة أكتر من ' || grace || ' أيام: ' || x.stage, x.svc || ' · ' || x.co, '#request/' || x.id, 'esc-late:' || x.stage_id);
        update public.requests set escalated_at = coalesce(escalated_at, now()) where id = x.id;
      end if;
    else
      perform public.notify(x.owner_id, null, false, 'late', 'خطوة متأخرة عندك: ' || x.stage, x.svc || ' · ' || x.co, '#request/' || x.id, 'late-owner:' || x.stage_id);
    end if;
  end loop;

  -- The office passed the number of days it quoted.
  for x in select r.*, s.title svc, c.name co from public.requests r
      join public.services s on s.id = r.service_id join public.companies c on c.id = r.company_id
      where r.status in ('accepted','in_progress') and r.office_id is not null and r.quoted_days is not null
        and coalesce(r.accepted_at, r.created_at) + make_interval(days => r.quoted_days) < now() loop
    perform public.notify(null, x.office_id, false, 'overdue', 'عدّيت المدة اللي أعلنتها', x.svc || ' · ' || x.co, '#job/' || x.id, 'overdue:' || x.id);
    perform public.notify(x.owner_id, null, false, 'overdue', 'المكتب عدّى المدة اللي أعلنها', x.svc || ' · ' || x.co, '#request/' || x.id, 'overdue-owner:' || x.id);
    if coalesce(x.accepted_at, x.created_at) + make_interval(days => x.quoted_days + grace) < now() then
      perform public.notify(null, null, true, 'escalated', 'مكتب عدّى مدته المعلنة بأكتر من ' || grace || ' أيام', x.svc || ' · ' || x.co, '#request/' || x.id, 'esc-overdue:' || x.id);
      update public.requests set escalated_at = coalesce(escalated_at, now()) where id = x.id;
    end if;
  end loop;

  -- Renewals: when to start, a week before expiry, and after expiry.
  -- Keys include the expiry date so a renewed document gets fresh reminders.
  for x in select d.id, d.title, d.expires_on, c.owner_id, c.name co,
        d.expires_on - (coalesce(s.self_days, 7) + 14) start_on
      from public.documents d join public.companies c on c.id = d.company_id
      left join public.services s on s.id = d.service_id
      where d.expires_on is not null and c.status <> 'closed'
        and d.expires_on - (coalesce(s.self_days, 7) + 14) <= current_date
        and not exists (select 1 from public.requests r where r.document_id = d.id and r.status not in ('done','cancelled')) loop
    if x.expires_on < current_date then
      perform public.notify(x.owner_id, null, false, 'expired', x.title || ' انتهى', x.co || ' · جدده في أسرع وقت', '#renew/' || x.id, 'expired:' || x.id || ':' || x.expires_on);
    elsif x.expires_on - current_date <= 7 then
      perform public.notify(x.owner_id, null, false, 'renew', x.title || ' هينتهي خلال أسبوع', x.co, '#renew/' || x.id, 'renew7:' || x.id || ':' || x.expires_on);
    else
      perform public.notify(x.owner_id, null, false, 'renew', 'ابدأ تجديد ' || x.title, x.co || ' · ينتهي ' || to_char(x.expires_on, 'YYYY-MM-DD'), '#renew/' || x.id, 'renew:' || x.id || ':' || x.expires_on);
    end if;
  end loop;
end $$;
revoke all on function public.rasmy_check() from public, anon, authenticated;

select cron.schedule('rasmy-check', '17 * * * *', 'select public.rasmy_check()');

-- Objective office numbers from real requests, readable by everyone signed in.
create or replace function public.office_stats()
returns table (office_id uuid, done int, on_time int, answered int, accepted int, reply_hours numeric)
language sql stable security definer set search_path = '' as $$
  select r.office_id,
    count(*) filter (where r.status = 'done')::int,
    count(*) filter (where r.status = 'done' and r.completed_at <= coalesce(r.accepted_at, r.created_at) + make_interval(days => coalesce(r.quoted_days, 0)) + interval '12 hours')::int,
    count(*) filter (where r.accepted_at is not null or exists (select 1 from public.events e where e.request_id = r.id and e.kind = 'declined'))::int,
    count(*) filter (where r.accepted_at is not null)::int,
    round(avg(extract(epoch from r.accepted_at - r.created_at) / 3600) filter (where r.accepted_at is not null), 1)
  from public.requests r
  where r.office_id is not null and not r.is_demo and (select public.my_role()) is not null
  group by r.office_id;
$$;
revoke all on function public.office_stats() from public, anon;
grant execute on function public.office_stats() to authenticated;
