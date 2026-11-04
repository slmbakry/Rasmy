-- Notes from people trying the platform: what they were on, what they said.
-- Admins see them all and get a notification for each new one.

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  email text,
  role text,
  page text,
  body text not null check (length(body) between 1 and 4000),
  created_at timestamptz not null default now(),
  done_at timestamptz
);
alter table public.feedback enable row level security;
create policy feedback_insert on public.feedback for insert to authenticated with check (user_id = (select auth.uid()));
create policy feedback_admin_read on public.feedback for select to authenticated using ((select public.is_admin()));
create policy feedback_admin_update on public.feedback for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
grant select, insert, update on public.feedback to authenticated;

create or replace function public.handle_new_feedback() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.email := (select email from public.profiles where id = new.user_id);
  perform public.notify(null, null, true, 'feedback', 'ملاحظة جديدة من ' || coalesce(new.email, 'مستخدم'),
    left(new.body, 140), '/admin/feedback', 'fb:' || new.id);
  return new;
end $$;
revoke all on function public.handle_new_feedback() from public, anon, authenticated;
create trigger on_feedback_created before insert on public.feedback
  for each row execute function public.handle_new_feedback();
