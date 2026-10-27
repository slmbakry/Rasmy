alter table public.companies add column is_demo boolean not null default false;
alter table public.requests add column is_demo boolean not null default false;
