-- Notifications call offices "service providers", like the rest of the platform.
do $$
declare
  pairs text[][] := array[
    ['قبل المكتب طلبك', 'قبل مقدم الخدمة طلبك'],
    ['اعتذر المكتب عن طلبك', 'اعتذر مقدم الخدمة عن طلبك'],
    ['اكتمل طلبك، قيّم المكتب', 'اكتمل طلبك، قيّم مقدم الخدمة'],
    ['لم يرد المكتب على طلبك بعد', 'لم يرد مقدم الخدمة على طلبك بعد'],
    ['يمكنك إلغاء الطلب واختيار مكتب آخر', 'يمكنك إلغاء الطلب واختيار مقدم خدمة آخر'],
    ['مكتب لم يرد على طلب منذ يومين', 'مقدم خدمة لم يرد على طلب منذ يومين'],
    ['تأخرت مرحلة لدى المكتب: ', 'تأخرت مرحلة لدى مقدم الخدمة: '],
    ['تجاوز المكتب المدة التي أعلنها', 'تجاوز مقدم الخدمة المدة التي أعلنها'],
    ['تجاوز مكتب مدته المعلنة بأكثر من ', 'تجاوز مقدم خدمة مدته المعلنة بأكثر من ']
  ];
  fn text; def text; i int;
begin
  foreach fn in array array['handle_event_notify', 'rasmy_check'] loop
    select pg_get_functiondef(('public.' || fn)::regproc) into def;
    for i in 1 .. array_length(pairs, 1) loop def := replace(def, pairs[i][1], pairs[i][2]); end loop;
    execute def;
  end loop;
  for i in 1 .. array_length(pairs, 1) loop
    update public.notifications set title = replace(title, pairs[i][1], pairs[i][2]), body = replace(body, pairs[i][1], pairs[i][2])
      where title like '%' || pairs[i][1] || '%' or body like '%' || pairs[i][1] || '%';
  end loop;
end $$;
