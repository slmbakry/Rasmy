-- Offices can see the contact details of owners who sent them requests
create policy profiles_office_read on public.profiles for select to authenticated
  using (exists (select 1 from public.requests r where r.owner_id = profiles.id and r.office_id is not null and r.office_id = (select public.my_office())));

-- When a stage is marked done: start the next one, and close the request after the last one
create or replace function public.handle_stage_done() returns trigger
language plpgsql security definer set search_path = '' as $$
declare remaining int;
begin
  if new.done_at is null or old.done_at is not null then return new; end if;
  update public.request_stages set started_at = coalesce(started_at, now())
    where request_id = new.request_id and idx = new.idx + 1;
  insert into public.events (request_id, actor_id, kind, note) values (new.request_id, auth.uid(), 'stage_done', new.title);
  select count(*) into remaining from public.request_stages where request_id = new.request_id and done_at is null;
  if remaining = 0 then
    update public.requests set status = 'done', completed_at = now() where id = new.request_id and status <> 'done';
  else
    update public.requests set status = 'in_progress' where id = new.request_id and status in ('new','accepted');
  end if;
  return new;
end $$;
revoke all on function public.handle_stage_done() from public, anon, authenticated;
create trigger on_stage_done after update of done_at on public.request_stages
  for each row execute function public.handle_stage_done();

-- When a request is done: renew or create its document, and activate a founded company
create or replace function public.handle_request_done() returns trigger
language plpgsql security definer set search_path = '' as $$
declare svc public.services%rowtype; ren public.services%rowtype; ren_id text;
begin
  if new.status <> 'done' or old.status = 'done' then return new; end if;
  select * into svc from public.services where id = new.service_id;
  insert into public.events (request_id, actor_id, kind) values (new.id, auth.uid(), 'done');
  if new.document_id is not null and svc.validity_days is not null then
    update public.documents
      set expires_on = (greatest(coalesce(expires_on, current_date), current_date) + svc.validity_days)
      where id = new.document_id;
    return new;
  end if;
  ren_id := case new.service_id when 'commercial_register' then 'cr_renewal'
                                when 'tax_card' then 'tax_card_renewal'
                                when 'shop_license' then 'license_renewal' end;
  if ren_id is not null and svc.validity_days is not null then
    select * into ren from public.services where id = ren_id;
    insert into public.documents (company_id, service_id, title, expires_on)
      values (new.company_id, ren.id, replace(ren.title, 'تجديد ', ''), current_date + svc.validity_days);
  end if;
  if svc.kind = 'founding' and not exists (
    select 1 from public.requests where company_id = new.company_id and status not in ('done','cancelled') and id <> new.id) then
    update public.companies set status = 'active' where id = new.company_id and status = 'founding';
  end if;
  return new;
end $$;
revoke all on function public.handle_request_done() from public, anon, authenticated;
create trigger on_request_done after update of status on public.requests
  for each row execute function public.handle_request_done();

-- Files attached to a request: requests/<request id>/<file>
insert into storage.buckets (id, name, public) values ('files', 'files', false) on conflict (id) do nothing;
create policy files_read on storage.objects for select to authenticated
  using (bucket_id = 'files' and (storage.foldername(name))[1] = 'requests'
         and (select public.can_see_request(((storage.foldername(name))[2])::uuid)));
create policy files_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'files' and (storage.foldername(name))[1] = 'requests'
              and (select public.can_see_request(((storage.foldername(name))[2])::uuid)));
