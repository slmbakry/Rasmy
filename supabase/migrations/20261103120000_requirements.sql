-- What each service really requires, confirmed by the people who do it.
--
-- Service providers (accounting and law offices, or individuals) confirm the
-- items they ask for, per governorate; owners confirm what they were asked for
-- after a request of theirs is done, for their company's governorate. New
-- items wait for an admin. Only counts are shown, never who confirmed.

alter table public.companies add column governorate text;
alter table public.offices add column kind text not null default 'accounting'
  check (kind in ('accounting', 'law', 'individual'));

create table public.requirement_items (
  id uuid primary key default gen_random_uuid(),
  service_id text not null references public.services (id),
  text text not null check (length(trim(text)) between 2 and 200),
  status text not null default 'pending' check (status in ('approved', 'pending', 'merged')),
  merged_into uuid references public.requirement_items (id),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index requirement_items_service on public.requirement_items (service_id);
alter table public.requirement_items enable row level security;

create table public.requirement_votes (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.requirement_items (id) on delete cascade,
  voter_id uuid not null default auth.uid(),
  voter_kind text not null check (voter_kind in ('provider', 'owner')),
  office_id uuid references public.offices (id) on delete cascade,
  company_id uuid references public.companies (id) on delete cascade,
  governorate text not null,
  created_at timestamptz not null default now(),
  unique (item_id, voter_id, governorate)
);
create index requirement_votes_item on public.requirement_votes (item_id);
alter table public.requirement_votes enable row level security;

-- The platform's current document lists are the starting items.
insert into public.requirement_items (service_id, text, status, created_by)
select s.id, d.value, 'approved', null from public.services s, jsonb_array_elements_text(s.docs) d;

-- Items: everyone signed in reads approved ones and their own pending ones;
-- providers and owners suggest new ones, which stay pending until an admin approves.
create policy requirement_items_read on public.requirement_items for select to authenticated
  using (status = 'approved' or created_by = (select auth.uid()) or (select public.is_admin()));
create policy requirement_items_suggest on public.requirement_items for insert to authenticated
  with check ((select public.my_role()) in ('office', 'owner', 'admin'));
create policy requirement_items_admin on public.requirement_items for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create or replace function public.guard_requirement_item() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.created_by := auth.uid();
  if not public.is_admin() then new.status := 'pending'; new.merged_into := null; end if;
  return new;
end $$;
revoke all on function public.guard_requirement_item() from public, anon, authenticated;
create trigger requirement_items_guard before insert on public.requirement_items
  for each row execute function public.guard_requirement_item();

-- Votes: people see and remove only their own; counts come from requirement_stats.
create policy requirement_votes_own on public.requirement_votes for select to authenticated
  using (voter_id = (select auth.uid()) or (select public.is_admin()));
create policy requirement_votes_insert on public.requirement_votes for insert to authenticated
  with check (voter_id = (select auth.uid()));
create policy requirement_votes_delete on public.requirement_votes for delete to authenticated
  using (voter_id = (select auth.uid()));

-- A provider votes for its own office; an owner votes for a company of theirs,
-- only after a request for that service is done, and with the company's governorate.
create or replace function public.check_requirement_vote() returns trigger
language plpgsql security definer set search_path = '' as $$
declare svc text; gov text;
begin
  new.voter_id := auth.uid();
  select service_id into svc from public.requirement_items where id = new.item_id and status = 'approved';
  if svc is null then raise exception 'item_not_open'; end if;
  if new.voter_kind = 'provider' then
    if public.my_office() is null and not public.is_admin() then raise exception 'not_provider'; end if;
    new.office_id := coalesce(public.my_office(), new.office_id);
    new.company_id := null;
    if new.governorate is null or length(new.governorate) = 0 then raise exception 'governorate_required'; end if;
  else
    select c.governorate into gov from public.companies c where c.id = new.company_id and public.owns_company(c.id);
    if gov is null then raise exception 'company_governorate_required'; end if;
    if not exists (select 1 from public.requests r where r.company_id = new.company_id and r.service_id = svc and r.status = 'done') then
      raise exception 'request_not_done';
    end if;
    new.governorate := gov;
    new.office_id := null;
  end if;
  return new;
end $$;
revoke all on function public.check_requirement_vote() from public, anon, authenticated;
create trigger requirement_votes_check before insert on public.requirement_votes
  for each row execute function public.check_requirement_vote();

-- Counts for one service, optionally for one governorate, without who voted.
create or replace function public.requirement_stats(p_service text, p_governorate text default null)
returns table (item_id uuid, text text, providers int, owners int, total int, last_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select i.id, i.text,
    count(distinct v.voter_id) filter (where v.voter_kind = 'provider')::int,
    count(distinct v.voter_id) filter (where v.voter_kind = 'owner')::int,
    count(distinct v.voter_id)::int,
    max(v.created_at)
  from public.requirement_items i
  left join public.requirement_votes v on v.item_id = i.id and (p_governorate is null or v.governorate = p_governorate)
  where i.service_id = p_service and i.status = 'approved'
  group by i.id, i.text
  order by 5 desc, i.created_at;
$$;
revoke all on function public.requirement_stats(text, text) from public, anon;
grant execute on function public.requirement_stats(text, text) to authenticated;

-- Admin: fold a duplicate item into another, keeping its votes. Votes the
-- other item already has stay on the merged item, which is no longer counted.
create or replace function public.merge_requirement(p_from uuid, p_into uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'admin_only'; end if;
  if p_from = p_into then raise exception 'same_item'; end if;
  update public.requirement_votes v set item_id = p_into
    where v.item_id = p_from and not exists (
      select 1 from public.requirement_votes w where w.item_id = p_into and w.voter_id = v.voter_id and w.governorate = v.governorate);
  update public.requirement_items set status = 'merged', merged_into = p_into where id = p_from;
end $$;
revoke all on function public.merge_requirement(uuid, uuid) from public, anon;
grant execute on function public.merge_requirement(uuid, uuid) to authenticated;
