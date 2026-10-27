create or replace function public.handle_new_invite() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set role = new.role, office_id = new.office_id
  where lower(email) = lower(new.email) and role is null;
  if found then
    new.accepted_at := now();
  end if;
  return new;
end $$;
revoke all on function public.handle_new_invite() from public, anon, authenticated;
create trigger on_invite_created before insert on public.invites
  for each row execute function public.handle_new_invite();
