-- What each service really requires, confirmed by the people who do it.
--
-- Requirements differ by the authority a company deals with: its commercial
-- registry office, its tax office, or its governorate, depending on the
-- service. Service providers (accounting and law offices, or individuals)
-- confirm the items they ask for at a given authority; owners confirm what
-- they were asked for once a request of theirs is done, at their company's
-- authority. New items wait for an admin. Only counts are exposed.

alter table public.companies
  add column governorate text,
  add column registry_office text,
  add column tax_office text;
alter table public.offices add column kind text not null default 'accounting'
  check (kind in ('accounting', 'law', 'individual'));

-- Which of the company's authorities a service is handled at.
alter table public.services add column place_kind text not null default 'governorate'
  check (place_kind in ('governorate', 'registry', 'tax_office', 'none'));
update public.services set place_kind = 'registry' where id in ('commercial_register', 'cr_renewal');
update public.services set place_kind = 'tax_office' where id in ('tax_card', 'vat_registration', 'monthly_tax_return', 'tax_card_renewal');
update public.services set place_kind = 'none' where id = 'bank_account';

create table public.requirement_items (
  id uuid primary key default gen_random_uuid(),
  service_id text not null references public.services (id),
  text text not null check (length(trim(text)) between 2 and 200),
  status text not null default 'pending' check (status in ('approved', 'pending', 'rejected', 'merged')),
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
  place text not null default '',
  created_at timestamptz not null default now(),
  unique (item_id, voter_id, place)
);
create index requirement_votes_item on public.requirement_votes (item_id);
alter table public.requirement_votes enable row level security;

-- The platform's current document lists are the starting items.
insert into public.requirement_items (service_id, text, status, created_by)
select s.id, d.value, 'approved', null from public.services s, jsonb_array_elements_text(s.docs) d;

-- Items: everyone signed in reads approved ones and their own suggestions;
-- providers and owners suggest new ones, which stay pending until an admin decides.
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
  new.text := trim(new.text);
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

-- A provider votes for its own office at an authority it names; an owner votes
-- for a company of theirs, after a request for that service is done, at the
-- company's own authority for that service.
create or replace function public.check_requirement_vote() returns trigger
language plpgsql security definer set search_path = '' as $$
declare svc text; kind text; here text;
begin
  new.voter_id := auth.uid();
  select i.service_id, s.place_kind into svc, kind
    from public.requirement_items i join public.services s on s.id = i.service_id
    where i.id = new.item_id and i.status = 'approved';
  if svc is null then raise exception 'item_not_open'; end if;
  if new.voter_kind = 'provider' then
    if public.my_office() is null and not public.is_admin() then raise exception 'not_provider'; end if;
    new.office_id := coalesce(public.my_office(), new.office_id);
    new.company_id := null;
    new.place := case when kind = 'none' then '' else trim(coalesce(new.place, '')) end;
    if kind <> 'none' and new.place = '' then raise exception 'place_required'; end if;
  else
    select case kind when 'registry' then c.registry_office when 'tax_office' then c.tax_office
                     when 'governorate' then c.governorate else '' end
      into here from public.companies c where c.id = new.company_id and public.owns_company(c.id);
    if here is null or (kind <> 'none' and here = '') then raise exception 'company_place_required'; end if;
    if not exists (select 1 from public.requests r where r.company_id = new.company_id and r.service_id = svc and r.status = 'done') then
      raise exception 'request_not_done';
    end if;
    new.place := here;
    new.office_id := null;
  end if;
  return new;
end $$;
revoke all on function public.check_requirement_vote() from public, anon, authenticated;
create trigger requirement_votes_check before insert on public.requirement_votes
  for each row execute function public.check_requirement_vote();

-- Counts for one service, everywhere and at one authority, without who voted.
create or replace function public.requirement_stats(p_service text, p_place text default null)
returns table (item_id uuid, text text, providers int, owners int, total int,
               providers_here int, owners_here int, total_here int, last_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select i.id, i.text,
    count(distinct v.voter_id) filter (where v.voter_kind = 'provider')::int,
    count(distinct v.voter_id) filter (where v.voter_kind = 'owner')::int,
    count(distinct v.voter_id)::int,
    count(distinct v.voter_id) filter (where v.voter_kind = 'provider' and v.place = p_place)::int,
    count(distinct v.voter_id) filter (where v.voter_kind = 'owner' and v.place = p_place)::int,
    count(distinct v.voter_id) filter (where v.place = p_place)::int,
    max(v.created_at)
  from public.requirement_items i
  left join public.requirement_votes v on v.item_id = i.id
  where i.service_id = p_service and i.status = 'approved'
  group by i.id, i.text
  order by 8 desc, 5 desc, i.created_at;
$$;
revoke all on function public.requirement_stats(text, text) from public, anon;
grant execute on function public.requirement_stats(text, text) to authenticated;

-- Authority names already in use, to suggest them and keep spellings consistent.
create or replace function public.place_names(p_kind text) returns setof text
language sql stable security definer set search_path = '' as $$
  select distinct n from (
    select case p_kind when 'registry' then registry_office when 'tax_office' then tax_office end n from public.companies
    union all
    select v.place from public.requirement_votes v join public.requirement_items i on i.id = v.item_id
      join public.services s on s.id = i.service_id where s.place_kind = p_kind
  ) x where n is not null and n <> '' order by 1;
$$;
revoke all on function public.place_names(text) from public, anon;
grant execute on function public.place_names(text) to authenticated;

-- Admin: fold a duplicate item into another, keeping its votes. Votes the
-- other item already has stay on the merged item, which is no longer counted.
create or replace function public.merge_requirement(p_from uuid, p_into uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'admin_only'; end if;
  if p_from = p_into then raise exception 'same_item'; end if;
  update public.requirement_votes v set item_id = p_into
    where v.item_id = p_from and not exists (
      select 1 from public.requirement_votes w where w.item_id = p_into and w.voter_id = v.voter_id and w.place = v.place);
  update public.requirement_items set status = 'merged', merged_into = p_into where id = p_from;
end $$;
revoke all on function public.merge_requirement(uuid, uuid) from public, anon;
grant execute on function public.merge_requirement(uuid, uuid) to authenticated;

-- Admin: one spelling for an authority, across companies and votes.
create or replace function public.rename_place(p_kind text, p_from text, p_to text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'admin_only'; end if;
  if p_kind = 'registry' then update public.companies set registry_office = p_to where registry_office = p_from;
  elsif p_kind = 'tax_office' then update public.companies set tax_office = p_to where tax_office = p_from;
  end if;
  update public.requirement_votes v set place = p_to
    from public.requirement_items i, public.services s
    where i.id = v.item_id and s.id = i.service_id and s.place_kind = p_kind and v.place = p_from
      and not exists (select 1 from public.requirement_votes w where w.item_id = v.item_id and w.voter_id = v.voter_id and w.place = p_to);
end $$;
revoke all on function public.rename_place(text, text, text) from public, anon;
grant execute on function public.rename_place(text, text, text) to authenticated;
