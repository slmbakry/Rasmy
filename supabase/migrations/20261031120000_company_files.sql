-- Company files: scans of each company's documents, kept per company with a
-- storage allowance and image quality set by the company's plan.
--
-- Upload flow: the browser first inserts a company_files row (the trigger
-- checks the plan's allowance against what is already stored), then uploads
-- the object at that row's path. Storage only accepts an object under
-- companies/<id>/ when a matching row exists, so nothing bypasses the check.
-- Usage counts the larger of the declared and the stored size of each file.

create table public.plans (
  id text primary key,
  title text not null,
  storage_bytes bigint not null,
  image_max_side int not null,
  image_quality real not null,
  sort int not null default 0
);
alter table public.plans enable row level security;
create policy plans_read on public.plans for select to authenticated using (true);
create policy plans_admin on public.plans for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

insert into public.plans (id, title, storage_bytes, image_max_side, image_quality, sort) values
  ('free', 'المجانية', 50::bigint * 1024 * 1024, 1600, 0.7, 1),
  ('pro', 'المدفوعة', 2048::bigint * 1024 * 1024, 2600, 0.85, 2);

alter table public.companies add column plan text not null default 'free' references public.plans (id);

-- Only an admin changes a company's plan (later, payments will).
create or replace function public.guard_company_plan() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.plan is distinct from old.plan and not public.is_admin() then
    raise exception 'plan_change_not_allowed';
  end if;
  return new;
end $$;
revoke all on function public.guard_company_plan() from public, anon, authenticated;
create trigger companies_plan_guard before update of plan on public.companies
  for each row execute function public.guard_company_plan();

create or replace function public.owns_company(cid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.companies c where c.id = cid and (c.owner_id = auth.uid() or public.is_admin()));
$$;
revoke all on function public.owns_company(uuid) from public, anon;
grant execute on function public.owns_company(uuid) to authenticated;

create table public.company_files (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  document_id uuid references public.documents (id) on delete set null,
  name text not null,
  path text not null unique,
  mime text not null check (mime in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  size bigint not null check (size > 0 and size <= 10 * 1024 * 1024),
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);
create index company_files_company on public.company_files (company_id);
alter table public.company_files enable row level security;
create policy company_files_owner on public.company_files for all to authenticated
  using ((select public.owns_company(company_id))) with check ((select public.owns_company(company_id)));

-- Bytes a company uses now, counting files still being uploaded at their declared size.
create or replace function public.company_usage(cid uuid) returns bigint
language sql stable security definer set search_path = '' as $$
  select coalesce(sum(greatest(f.size, coalesce((o.metadata ->> 'size')::bigint, 0))), 0)::bigint
  from public.company_files f
  left join storage.objects o on o.bucket_id = 'files' and o.name = f.path
  where f.company_id = cid and public.owns_company(cid);
$$;
revoke all on function public.company_usage(uuid) from public, anon;
grant execute on function public.company_usage(uuid) to authenticated;

create or replace function public.check_company_file() returns trigger
language plpgsql security definer set search_path = '' as $$
declare lim bigint;
begin
  if new.path not like 'companies/' || new.company_id || '/%' then
    raise exception 'bad_path';
  end if;
  if new.document_id is not null and not exists (
      select 1 from public.documents d where d.id = new.document_id and d.company_id = new.company_id) then
    raise exception 'bad_document';
  end if;
  select p.storage_bytes into lim from public.companies c join public.plans p on p.id = c.plan where c.id = new.company_id;
  if public.company_usage(new.company_id) + new.size > lim then
    raise exception 'quota_exceeded';
  end if;
  return new;
end $$;
revoke all on function public.check_company_file() from public, anon, authenticated;
create trigger company_files_check before insert on public.company_files
  for each row execute function public.check_company_file();

-- Storage: company files need their row first; packs (the merged file sent
-- on WhatsApp) live under packs/<company>/ and are not counted.
create policy files_company_read on storage.objects for select to authenticated using (
  bucket_id = 'files' and (storage.foldername(name))[1] in ('companies', 'packs')
  and (select public.owns_company(((storage.foldername(name))[2])::uuid)));
create policy files_company_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'files' and (
    ((storage.foldername(name))[1] = 'companies'
      and exists (select 1 from public.company_files f where f.path = objects.name and public.owns_company(f.company_id)))
    or ((storage.foldername(name))[1] = 'packs'
      and (select public.owns_company(((storage.foldername(name))[2])::uuid)))));
create policy files_company_delete on storage.objects for delete to authenticated using (
  bucket_id = 'files' and (storage.foldername(name))[1] in ('companies', 'packs')
  and (select public.owns_company(((storage.foldername(name))[2])::uuid)));

update storage.buckets set file_size_limit = 25 * 1024 * 1024 where id = 'files';
