-- Move every Arabic text the database writes from colloquial Egyptian to plain
-- Modern Standard Arabic: notification titles and bodies, service document
-- lists, and the demo seed. Function bodies are rewritten in place, so their
-- logic stays exactly as it was.
do $$
declare
  pairs text[][] := array[
    ['طلب جديد مستني ردك', 'طلب جديد بانتظار ردك'],
    ['المكتب قبل طلبك', 'قبل المكتب طلبك'],
    ['المكتب اعتذر عن طلبك', 'اعتذر المكتب عن طلبك'],
    ['خلصت مرحلة: ', 'اكتملت مرحلة: '],
    ['خلص طلبك، قيّم المكتب', 'اكتمل طلبك، قيّم المكتب'],
    ['صاحب العمل لغى الطلب', 'ألغى صاحب العمل الطلب'],
    ['طلب مستني ردك من أكتر من يوم', 'طلب بانتظار ردك منذ أكثر من يوم'],
    ['المكتب لسه مارد على طلبك', 'لم يرد المكتب على طلبك بعد'],
    ['تقدر تلغي الطلب وتختار مكتب تاني', 'يمكنك إلغاء الطلب واختيار مكتب آخر'],
    ['مكتب مارد على طلب من يومين', 'مكتب لم يرد على طلب منذ يومين'],
    ['مرحلة اتأخرت عند المكتب: ', 'تأخرت مرحلة لدى المكتب: '],
    ['مرحلة متأخرة أكتر من ', 'مرحلة متأخرة أكثر من '],
    ['خطوة متأخرة عندك: ', 'خطوة متأخرة لديك: '],
    ['عدّيت المدة اللي أعلنتها', 'تجاوزت المدة التي أعلنتها'],
    ['المكتب عدّى المدة اللي أعلنها', 'تجاوز المكتب المدة التي أعلنها'],
    ['مكتب عدّى مدته المعلنة بأكتر من ', 'تجاوز مكتب مدته المعلنة بأكثر من '],
    ['جدده في أسرع وقت', 'جدّده في أسرع وقت'],
    [' هينتهي خلال أسبوع', ' ينتهي خلال أسبوع'],
    ['عندنا ضغط شغل الأسبوع ده', 'لدينا ضغط عمل هذا الأسبوع']
  ];
  fn text;
  def text;
  i int;
begin
  foreach fn in array array['handle_event_notify', 'rasmy_check', 'seed_demo'] loop
    select pg_get_functiondef(('public.' || fn)::regproc) into def;
    for i in 1 .. array_length(pairs, 1) loop
      def := replace(def, pairs[i][1], pairs[i][2]);
    end loop;
    -- "<title> انتهى" becomes "انتهت صلاحية <title>".
    def := replace(def, 'x.title || '' انتهى''', '''انتهت صلاحية '' || x.title');
    execute def;
  end loop;

  for i in 1 .. array_length(pairs, 1) loop
    update public.notifications set title = replace(title, pairs[i][1], pairs[i][2]), body = replace(body, pairs[i][1], pairs[i][2])
      where title like '%' || pairs[i][1] || '%' or body like '%' || pairs[i][1] || '%';
    update public.events set note = replace(note, pairs[i][1], pairs[i][2]) where note like '%' || pairs[i][1] || '%';
  end loop;
  update public.notifications set title = 'انتهت صلاحية ' || left(title, length(title) - length(' انتهى'))
    where kind = 'expired' and title like '% انتهى';
end $$;

update public.services set docs = replace(replace(docs::text,
    'تلات أسماء مقترحة للشركة', 'ثلاثة أسماء مقترحة للشركة'),
    'توكيل للمحاسب لو هو اللي هيقدم', 'توكيل للمحاسب إذا كان هو من سيقدّم الطلب')::jsonb
  where docs::text like '%تلات أسماء%' or docs::text like '%لو هو اللي هيقدم%';

update public.services set agency = 'البنك الذي تختاره' where agency = 'البنك اللي تختاره';
