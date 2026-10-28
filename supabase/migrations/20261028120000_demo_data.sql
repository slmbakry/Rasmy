-- Phase 5b: demo data the admin can rebuild, and a seeding switch for the workflow triggers.

create or replace function public.handle_stage_done() returns trigger
language plpgsql security definer set search_path = '' as $$
declare remaining int;
begin
  if current_setting('rasmy.seeding', true) = 'on' then return new; end if;
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

create or replace function public.handle_request_done() returns trigger
language plpgsql security definer set search_path = '' as $$
declare svc public.services%rowtype; ren public.services%rowtype; ren_id text;
begin
  if current_setting('rasmy.seeding', true) = 'on' then return new; end if;
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

create or replace function public.handle_event_notify() returns trigger
language plpgsql security definer set search_path = '' as $$
declare r public.requests%rowtype; svc text; co text; actor_office uuid;
  to_owner boolean; to_office boolean; t text; b text;
begin
  if current_setting('rasmy.seeding', true) = 'on' then return new; end if;
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

-- Demo data: three offices with different track records, three companies,
-- documents in every state and requests at every step. Dates are relative to
-- now. It is seeded once and skipped if the demo set already exists.
alter table public.offices add column if not exists is_demo boolean not null default false;

-- One demo request with a believable timeline: stages spread between
-- acceptance and completion, or done up to the current stage.
create or replace function public._demo_request(p_owner uuid, p_co uuid, p_office uuid, p_svc text, p_status text,
  p_created timestamptz, p_accepted timestamptz default null, p_done timestamptz default null,
  p_cur int default null, p_cur_start timestamptz default null, p_doc uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare rid uuid; fee numeric; dys int; n int; st record; t0 timestamptz; t1 timestamptz;
begin
  if p_office is null then
    select gov_fee, self_days into fee, dys from public.services where id = p_svc;
  else
    select os.fee + s.gov_fee, os.days into fee, dys from public.office_services os join public.services s on s.id = os.service_id
      where os.office_id = p_office and os.service_id = p_svc;
  end if;
  insert into public.requests (company_id, owner_id, service_id, document_id, office_id, status, quoted_fee, quoted_days, created_at, is_demo)
    values (p_co, p_owner, p_svc, p_doc, p_office, 'new', fee, dys, p_created, true) returning id into rid;
  update public.events set created_at = p_created where request_id = rid;
  update public.requests set status = p_status, accepted_at = p_accepted, completed_at = p_done where id = rid;
  select count(*) into n from public.request_stages where request_id = rid;
  t0 := coalesce(p_accepted, p_created);
  if p_accepted is not null then
    insert into public.events (request_id, kind, created_at) values (rid, 'accepted', p_accepted);
  end if;
  for st in select * from public.request_stages where request_id = rid order by idx loop
    if p_status = 'done' then
      t1 := t0 + (p_done - coalesce(p_accepted, p_created)) / n;
      update public.request_stages set started_at = t0, done_at = t1 where id = st.id;
      insert into public.events (request_id, kind, note, created_at) values (rid, 'stage_done', st.title, t1);
      t0 := t1;
    elsif p_cur is not null and st.idx < p_cur then
      t1 := t0 + (p_cur_start - coalesce(p_accepted, p_created)) / greatest(p_cur, 1);
      update public.request_stages set started_at = t0, done_at = t1 where id = st.id;
      insert into public.events (request_id, kind, note, created_at) values (rid, 'stage_done', st.title, t1);
      t0 := t1;
    elsif p_cur is not null and st.idx = p_cur then
      update public.request_stages set started_at = p_cur_start where id = st.id;
    end if;
  end loop;
  if p_status = 'done' then
    insert into public.events (request_id, kind, created_at) values (rid, 'done', p_done);
  end if;
  return rid;
end $$;
revoke all on function public._demo_request(uuid, uuid, uuid, text, text, timestamptz, timestamptz, timestamptz, int, timestamptz, uuid) from public, anon, authenticated;

create or replace function public.seed_demo() returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid; oa uuid; ob uuid; oc uuid; c1 uuid; c2 uuid; c3 uuid; d uuid; r uuid; o record; s record;
  base jsonb := '{"name_reservation":500,"incorporation":2500,"commercial_register":1500,"tax_card":800,"vat_registration":1200,
    "shop_license":3500,"social_insurance":1000,"bank_account":600,"monthly_tax_return":700,"cr_renewal":1000,
    "license_renewal":2500,"tax_card_renewal":600,"industrial_renewal":3000}';
  day constant interval := interval '1 day';
begin
  me := (select id from public.profiles where role = 'admin' order by created_at limit 1);
  if me is null then return; end if;
  perform set_config('rasmy.seeding', 'on', true);

  -- Seed once: skip if the demo set is already there.
  if exists (select 1 from public.offices where is_demo) then return; end if;

  insert into public.offices (name, phone, license_no, is_demo) values ('مكتب الأمانة للمحاسبة', '01001234567', 'AC-1042', true) returning id into oa;
  insert into public.offices (name, phone, license_no, is_demo) values ('مكتب النيل للاستشارات', '01112345678', 'NL-2210', true) returning id into ob;
  insert into public.offices (name, phone, license_no, is_demo) values ('مكتب الريادة', '01223456789', 'RD-3307', true) returning id into oc;
  for o in select * from (values (oa, 1.2, 0.6), (ob, 1.0, 0.8), (oc, 0.8, 1.0)) v(id, f, t) loop
    for s in select * from public.services loop
      insert into public.office_services (office_id, service_id, fee, days)
        values (o.id, s.id, round((base->>s.id)::numeric * o.f / 50) * 50, greatest(1, round(s.self_days * o.t)));
    end loop;
  end loop;

  -- Companies and their documents.
  insert into public.companies (owner_id, name, legal_form, status, is_demo, created_at) values (me, 'شركة النور للتجارة', 'شركة ذات مسئولية محدودة', 'active', true, now() - 400 * day) returning id into c1;
  insert into public.companies (owner_id, name, legal_form, status, is_demo, created_at) values (me, 'مخبز الصفا', 'منشأة فردية', 'active', true, now() - 300 * day) returning id into c2;
  insert into public.companies (owner_id, name, legal_form, status, is_demo, created_at) values (me, 'ستوديو فكرة للتصميم', 'شركة شخص واحد', 'founding', true, now() - 5 * day) returning id into c3;
  insert into public.documents (company_id, service_id, title, expires_on) values
    (c1, 'cr_renewal', 'السجل التجاري', current_date + 400),
    (c1, 'tax_card_renewal', 'البطاقة الضريبية', current_date - 5),
    (c2, 'license_renewal', 'ترخيص المحل', current_date + 200),
    (c2, 'industrial_renewal', 'السجل الصناعي', current_date + 40);
  insert into public.documents (company_id, service_id, title, expires_on) values (c1, 'license_renewal', 'ترخيص المحل', current_date + 18) returning id into d;
  perform public._demo_request(me, c1, oa, 'license_renewal', 'in_progress', now() - 3 * day, now() - 2 * day, null, 1, now() - 20 * interval '1 hour', d);
  insert into public.documents (company_id, service_id, title, expires_on) values (c2, 'cr_renewal', 'السجل التجاري', current_date + 12) returning id into d;
  perform public._demo_request(me, c2, oc, 'cr_renewal', 'in_progress', now() - 10 * day, now() - 9 * day, null, 1, now() - 7 * day, d);

  -- Open requests: one unanswered for days, one just sent, one the owner does alone.
  perform public._demo_request(me, c3, ob, 'name_reservation', 'new', now() - 3 * day);
  perform public._demo_request(me, c3, oa, 'incorporation', 'new', now() - 2 * interval '1 hour');
  perform public._demo_request(me, c1, null, 'monthly_tax_return', 'in_progress', now() - 1 * day, null, null, 0, now() - 1 * day);

  -- History that gives each office its track record and ratings.
  for o in select * from (values
      (oa, c1, 'tax_card_renewal', 100, 3, 5, 5), (oa, c2, 'monthly_tax_return', 80, 2, 5, 4), (oa, c1, 'monthly_tax_return', 50, 1, 4, 5),
      (oa, c2, 'license_renewal', 40, 10, 5, 5), (oa, c1, 'cr_renewal', 20, 4, null, null),
      (ob, c1, 'license_renewal', 110, 18, 4, 4), (ob, c2, 'tax_card_renewal', 90, 4, 4, 3), (ob, c2, 'monthly_tax_return', 60, 2, 3, 4),
      (ob, c1, 'cr_renewal', 30, 9, null, null),
      (oc, c2, 'license_renewal', 120, 29, 3, 2), (oc, c1, 'tax_card_renewal', 85, 9, 4, 2), (oc, c2, 'monthly_tax_return', 55, 3, 3, 1),
      (oc, c1, 'cr_renewal', 25, 7, null, null)
    ) v(office, co, svc, ago, took, pro, spd) loop
    r := public._demo_request(me, o.co, o.office, o.svc, 'done', now() - o.ago * day, now() - (o.ago - 1) * day, now() - (o.ago - 1 - o.took) * day);
    if o.pro is not null then
      insert into public.ratings (request_id, office_id, owner_id, professionalism, speed, created_at)
        values (r, o.office, me, o.pro, o.spd, now() - (o.ago - 2 - o.took) * day);
    end if;
  end loop;

  -- An office that declined.
  r := public._demo_request(me, c3, oc, 'name_reservation', 'cancelled', now() - 6 * day);
  insert into public.events (request_id, kind, note, created_at) values (r, 'declined', 'عندنا ضغط شغل الأسبوع ده', now() - 5 * day);

  perform set_config('rasmy.seeding', 'off', true);
  perform public.rasmy_check();
end $$;
revoke all on function public.seed_demo() from public, anon, authenticated;

select public.seed_demo();

-- Demo offices are measured on their demo requests; real offices on real ones only.
create or replace function public.office_stats()
returns table (office_id uuid, done int, on_time int, answered int, accepted int, reply_hours numeric)
language sql stable security definer set search_path = '' as $$
  select r.office_id,
    count(*) filter (where r.status = 'done')::int,
    count(*) filter (where r.status = 'done' and r.completed_at <= coalesce(r.accepted_at, r.created_at) + make_interval(days => coalesce(r.quoted_days, 0)) + interval '12 hours')::int,
    count(*) filter (where r.accepted_at is not null or exists (select 1 from public.events e where e.request_id = r.id and e.kind = 'declined'))::int,
    count(*) filter (where r.accepted_at is not null)::int,
    round(avg(extract(epoch from r.accepted_at - r.created_at) / 3600) filter (where r.accepted_at is not null), 1)
  from public.requests r join public.offices o on o.id = r.office_id
  where (not r.is_demo or o.is_demo) and (select public.my_role()) is not null
  group by r.office_id;
$$;
