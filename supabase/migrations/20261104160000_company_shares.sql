-- Fixed share links: an owner picks documents (and loose files) to share;
-- anyone with the link sees the files those documents have now, so a new
-- scan reaches the same link. Links can be paused or have their token
-- replaced, and count their views. The share function reads them with the
-- service role; owners manage their own through RLS.

create table public.company_shares (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  token text not null unique default replace(replace(replace(encode(extensions.gen_random_bytes(18), 'base64'), '/', '_'), '+', '-'), '=', ''),
  title text not null check (length(title) between 1 and 80),
  document_ids uuid[] not null default '{}',
  file_ids uuid[] not null default '{}',
  active boolean not null default true,
  views int not null default 0,
  last_viewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index company_shares_company on public.company_shares (company_id);
alter table public.company_shares enable row level security;
create policy company_shares_owner on public.company_shares for all to authenticated
  using ((select public.owns_company(company_id))) with check ((select public.owns_company(company_id)));
grant select, insert, update, delete on public.company_shares to authenticated;

-- A new token for a link, so the old address stops working.
create or replace function public.renew_share_token(sid uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare t text := replace(replace(replace(encode(extensions.gen_random_bytes(18), 'base64'), '/', '_'), '+', '-'), '=', '');
begin
  update public.company_shares set token = t where id = sid and public.owns_company(company_id);
  if not found then raise exception 'not_found'; end if;
  return t;
end $$;
revoke all on function public.renew_share_token(uuid) from public, anon;
grant execute on function public.renew_share_token(uuid) to authenticated;
