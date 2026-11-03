-- Services for ending a business, used by the closure path. Fees are unknown
-- until providers confirm them, so the government fee starts at zero.

insert into public.services (id, title, kind, agency, gov_fee, self_days, validity_days, place_kind, sort, docs, stages) values
('liquidation', 'حل الشركة وتصفيتها وشطبها', 'closure', 'الهيئة العامة للاستثمار والسجل التجاري ومأمورية الضرائب والتأمينات', 0, 180, null, 'registry', 300,
  '["محضر قرار الحل ووضع الشركة تحت التصفية وتعيين المصفي وتحديد مهامه ومدته وأجره", "إقرار المصفي بقبول التعيين وصورة بطاقته", "مستخرج حديث من السجل التجاري لم يمر عليه أكثر من ثلاثة أشهر", "ما يثبت نشر قرار التصفية", "ميزانية التصفية والحساب الختامي معتمدين من المصفي ومراقب الحسابات", "محضر اعتماد الحساب الختامي وتوزيع ناتج التصفية وإخلاء عهدة المصفي", "مخالصة من مصلحة الضرائب", "ما يثبت سداد اشتراكات التأمينات وإنهاء ملف المنشأة بالاستمارة رقم ٦"]',
  '[{"days": 7, "title": "قرار الحل وتعيين المصفي واعتماده"}, {"days": 14, "title": "قيد التصفية في السجل التجاري ونشرها"}, {"days": 90, "title": "جرد الأصول والديون وتسويتها"}, {"days": 30, "title": "الحساب الختامي واعتماده"}, {"days": 21, "title": "المخالصة من الضرائب والتأمينات"}, {"days": 14, "title": "شهر انتهاء التصفية وشطب القيد"}]'),
('sole_closure', 'شطب المنشأة الفردية', 'closure', 'مأمورية الضرائب والتأمينات والسجل التجاري', 0, 30, null, 'registry', 310,
  '["طلب كتابي لمأمورية الضرائب بتاريخ التوقف والأنشطة المتوقفة", "مخالصة من مصلحة الضرائب", "ما يثبت سداد اشتراكات التأمينات وإنهاء الملف بالاستمارة رقم ٦ إن كان للمنشأة موظفون", "مستخرج حديث من السجل التجاري", "صورة بطاقة الرقم القومي لصاحب المنشأة"]',
  '[{"days": 3, "title": "إخطار مأمورية الضرائب بالتوقف"}, {"days": 14, "title": "المخالصة من الضرائب والتأمينات"}, {"days": 7, "title": "شطب القيد من السجل التجاري"}]');

insert into public.requirement_items (service_id, text, status, created_by)
select s.id, d.value, 'approved', null from public.services s, jsonb_array_elements_text(s.docs) d
where s.id in ('liquidation', 'sole_closure');
-- The insert guard marks new items pending; these come from the platform itself.
update public.requirement_items set status = 'approved'
where created_by is null and status = 'pending' and service_id in ('liquidation', 'sole_closure');
