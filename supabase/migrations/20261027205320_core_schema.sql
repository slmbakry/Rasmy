-- Roles and people
create table public.offices (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  license_no text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role text check (role in ('owner','office','admin')),
  office_id uuid references public.offices(id),
  consent_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.invites (
  email text primary key,
  role text not null check (role in ('owner','office','admin')),
  office_id uuid references public.offices(id),
  invited_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

-- Procedures library
create table public.services (
  id text primary key check (id ~ '^[a-z0-9_]+$'),
  title text not null,
  kind text not null check (kind in ('founding','compliance','renewal')),
  agency text not null,
  docs jsonb not null default '[]',
  stages jsonb not null default '[]',      -- [{"title": "...", "days": 2}]
  gov_fee numeric not null default 0,
  self_days int not null default 0,
  validity_days int,                       -- for documents that expire
  sort int not null default 0,
  active boolean not null default true
);

create table public.office_services (
  office_id uuid references public.offices(id) on delete cascade,
  service_id text references public.services(id) on delete cascade,
  fee numeric not null,
  days int not null,
  primary key (office_id, service_id)
);

-- Owners' companies and documents
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  legal_form text,
  status text not null default 'active' check (status in ('founding','active','closed')),
  created_at timestamptz not null default now()
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  service_id text references public.services(id),
  title text not null,
  expires_on date,
  file_path text,
  created_at timestamptz not null default now()
);

-- Requests and tracking
create table public.requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  owner_id uuid not null references auth.users(id),
  service_id text not null references public.services(id),
  office_id uuid references public.offices(id),      -- null = owner does it alone
  document_id uuid references public.documents(id),  -- for renewals
  status text not null default 'new' check (status in ('new','accepted','in_progress','done','cancelled')),
  quoted_fee numeric,
  quoted_days int,
  final_fee numeric,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  completed_at timestamptz
);

create table public.request_stages (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete cascade,
  idx int not null,
  title text not null,
  planned_days int not null default 1,
  started_at timestamptz,
  done_at timestamptz,
  unique (request_id, idx)
);

create table public.events (
  id bigint generated always as identity primary key,
  request_id uuid not null references public.requests(id) on delete cascade,
  actor_id uuid references auth.users(id),
  kind text not null,
  note text,
  created_at timestamptz not null default now()
);

create table public.ratings (
  request_id uuid primary key references public.requests(id) on delete cascade,
  office_id uuid not null references public.offices(id),
  owner_id uuid not null references auth.users(id),
  professionalism int not null check (professionalism between 1 and 5),
  speed int not null check (speed between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

create index on public.companies(owner_id);
create index on public.documents(company_id);
create index on public.requests(company_id);
create index on public.requests(office_id);
create index on public.requests(owner_id);
create index on public.request_stages(request_id);
create index on public.events(request_id);
create index on public.ratings(office_id);
create index on public.office_services(service_id);
create index on public.profiles(office_id);

-- Helpers (security definer, fixed search_path; callable only by signed-in users)
create or replace function public.my_role() returns text
language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = auth.uid()
$$;
create or replace function public.my_office() returns uuid
language sql stable security definer set search_path = '' as $$
  select office_id from public.profiles where id = auth.uid()
$$;
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false)
$$;
create or replace function public.can_see_request(rid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.requests r
    where r.id = rid and (
      r.owner_id = auth.uid()
      or (r.office_id is not null and r.office_id = (select office_id from public.profiles where id = auth.uid()))
      or (select role = 'admin' from public.profiles where id = auth.uid())
    )
  )
$$;
create or replace function public.office_has_company(cid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.requests r
    where r.company_id = cid and r.office_id is not null
      and r.office_id = (select office_id from public.profiles where id = auth.uid())
  )
$$;
revoke all on function public.my_role(), public.my_office(), public.is_admin(),
  public.can_see_request(uuid), public.office_has_company(uuid) from public, anon;
grant execute on function public.my_role(), public.my_office(), public.is_admin(),
  public.can_see_request(uuid), public.office_has_company(uuid) to authenticated;

-- New sign-ups: profile gets a role only if the email was invited
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare inv public.invites%rowtype;
begin
  select * into inv from public.invites where lower(email) = lower(new.email);
  insert into public.profiles (id, email, role, office_id)
  values (new.id, new.email, inv.role, inv.office_id);
  if found then
    update public.invites set accepted_at = now() where lower(email) = lower(new.email);
  end if;
  return new;
end $$;
revoke all on function public.handle_new_user() from public, anon, authenticated;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- New request: copy stages from the library and log the event
create or replace function public.handle_new_request() returns trigger
language plpgsql security definer set search_path = '' as $$
declare s jsonb; i int := 0;
begin
  for s in select * from jsonb_array_elements((select stages from public.services where id = new.service_id)) loop
    insert into public.request_stages (request_id, idx, title, planned_days)
    values (new.id, i, s->>'title', coalesce((s->>'days')::int, 1));
    i := i + 1;
  end loop;
  insert into public.events (request_id, actor_id, kind) values (new.id, auth.uid(), 'created');
  return new;
end $$;
revoke all on function public.handle_new_request() from public, anon, authenticated;
create trigger on_request_created after insert on public.requests
  for each row execute function public.handle_new_request();

-- RLS
alter table public.offices enable row level security;
alter table public.profiles enable row level security;
alter table public.invites enable row level security;
alter table public.services enable row level security;
alter table public.office_services enable row level security;
alter table public.companies enable row level security;
alter table public.documents enable row level security;
alter table public.requests enable row level security;
alter table public.request_stages enable row level security;
alter table public.events enable row level security;
alter table public.ratings enable row level security;

create policy offices_read on public.offices for select to authenticated using ((select public.my_role()) is not null);
create policy offices_admin on public.offices for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy profiles_self on public.profiles for select to authenticated using (id = (select auth.uid()) or (select public.is_admin()));
create policy profiles_self_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()) and role is not distinct from (select public.my_role()) and office_id is not distinct from (select public.my_office()));
create policy profiles_admin on public.profiles for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy invites_admin on public.invites for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy services_read on public.services for select to authenticated using ((select public.my_role()) is not null);
create policy services_admin on public.services for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy os_read on public.office_services for select to authenticated using ((select public.my_role()) is not null);
create policy os_office on public.office_services for all to authenticated
  using (office_id = (select public.my_office()) or (select public.is_admin()))
  with check (office_id = (select public.my_office()) or (select public.is_admin()));

create policy companies_owner on public.companies for all to authenticated
  using (owner_id = (select auth.uid()) or (select public.is_admin()))
  with check ((owner_id = (select auth.uid()) and (select public.my_role()) = 'owner') or (select public.is_admin()));
create policy companies_office_read on public.companies for select to authenticated using ((select public.office_has_company(id)));

create policy documents_owner on public.documents for all to authenticated
  using (exists (select 1 from public.companies c where c.id = company_id and (c.owner_id = (select auth.uid()) or (select public.is_admin()))))
  with check (exists (select 1 from public.companies c where c.id = company_id and (c.owner_id = (select auth.uid()) or (select public.is_admin()))));
create policy documents_office on public.documents for select to authenticated using ((select public.office_has_company(company_id)));
create policy documents_office_insert on public.documents for insert to authenticated with check ((select public.office_has_company(company_id)));

create policy requests_read on public.requests for select to authenticated using ((select public.can_see_request(id)));
create policy requests_owner_insert on public.requests for insert to authenticated
  with check (owner_id = (select auth.uid()) and exists (select 1 from public.companies c where c.id = company_id and c.owner_id = (select auth.uid())));
create policy requests_update on public.requests for update to authenticated
  using (owner_id = (select auth.uid()) or office_id = (select public.my_office()) or (select public.is_admin()))
  with check (owner_id = (select auth.uid()) or office_id = (select public.my_office()) or (select public.is_admin()));

create policy stages_read on public.request_stages for select to authenticated using ((select public.can_see_request(request_id)));
create policy stages_update on public.request_stages for update to authenticated
  using (exists (select 1 from public.requests r where r.id = request_id and (r.office_id = (select public.my_office()) or r.owner_id = (select auth.uid()) or (select public.is_admin()))))
  with check (exists (select 1 from public.requests r where r.id = request_id and (r.office_id = (select public.my_office()) or r.owner_id = (select auth.uid()) or (select public.is_admin()))));

create policy events_read on public.events for select to authenticated using ((select public.can_see_request(request_id)));
create policy events_insert on public.events for insert to authenticated
  with check (actor_id = (select auth.uid()) and (select public.can_see_request(request_id)));

create policy ratings_read on public.ratings for select to authenticated using ((select public.my_role()) is not null);
create policy ratings_insert on public.ratings for insert to authenticated
  with check (owner_id = (select auth.uid()) and exists (select 1 from public.requests r where r.id = request_id and r.owner_id = (select auth.uid()) and r.status = 'done' and r.office_id = office_id));

-- First admin
insert into public.invites (email, role) values ('slmbakry@gmail.com', 'admin');
