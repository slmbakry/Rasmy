-- Services for changing a company after it is founded, used by the paths in
-- the platform's guide. Fees are unknown until providers confirm them, so the
-- government fee starts at zero; documents start as requirement items.

alter table public.services drop constraint services_kind_check;
alter table public.services add constraint services_kind_check check (kind in ('founding', 'compliance', 'renewal', 'amendment', 'closure'));

insert into public.services (id, title, kind, agency, gov_fee, self_days, validity_days, place_kind, sort, docs, stages) values
('capital_change', 'زيادة رأس المال أو تخفيضه', 'amendment', 'الهيئة العامة للاستثمار والسجل التجاري', 0, 21, null, 'registry', 200,
  '["محضر قرار جماعة الشركاء بتعديل رأس المال", "مشروع عقد التعديل", "شهادة بنكية بإيداع الزيادة النقدية كاملة", "تقرير تقييم الحصص العينية من خبير أو لجنة معتمدة", "مستخرج حديث من السجل التجاري لم يمر عليه أكثر من ثلاثة أشهر", "صور بطاقات الرقم القومي للشركاء"]',
  '[{"days": 3, "title": "إعداد محضر القرار وعقد التعديل"}, {"days": 7, "title": "اعتماد الهيئة العامة للاستثمار"}, {"days": 3, "title": "التصديق والتوثيق"}, {"days": 3, "title": "التأشير في السجل التجاري"}]'),
('share_transfer', 'التنازل عن الحصص ودخول شريك أو خروجه', 'amendment', 'الهيئة العامة للاستثمار والسجل التجاري', 0, 45, null, 'registry', 210,
  '["عقد بيع الحصص بمحرر رسمي أو مصدق على التوقيعات", "ما يثبت إبلاغ باقي الشركاء بالعرض ومرور شهر دون استرداد", "محضر قرار جماعة الشركاء بتعديل العقد", "مشروع عقد التعديل", "مستخرج حديث من السجل التجاري لم يمر عليه أكثر من ثلاثة أشهر", "صور بطاقات الرقم القومي للشركاء القدامى والجدد"]',
  '[{"days": 30, "title": "إبلاغ الشركاء وانتظار مدة الاسترداد"}, {"days": 3, "title": "توقيع عقد البيع وتوثيقه"}, {"days": 7, "title": "اعتماد الهيئة العامة للاستثمار"}, {"days": 3, "title": "التأشير في السجل التجاري"}]'),
('manager_change', 'تغيير المدير أو المفوضين بالتوقيع', 'amendment', 'الهيئة العامة للاستثمار والسجل التجاري', 0, 10, null, 'registry', 220,
  '["محضر قرار جماعة الشركاء بالتعيين أو العزل", "إقرار من المدير الجديد بقبول التعيين", "صورة بطاقة الرقم القومي للمدير الجديد", "مستخرج حديث من السجل التجاري لم يمر عليه أكثر من ثلاثة أشهر"]',
  '[{"days": 2, "title": "إعداد محضر القرار"}, {"days": 5, "title": "اعتماد الهيئة العامة للاستثمار"}, {"days": 3, "title": "التأشير في السجل التجاري"}]'),
('address_change', 'تغيير مقر الشركة', 'amendment', 'الهيئة العامة للاستثمار والسجل التجاري ومأمورية الضرائب', 0, 14, null, 'registry', 230,
  '["عقد إيجار ثابت التاريخ أو مستند ملكية موثق للمقر الجديد", "محضر قرار جماعة الشركاء بتغيير المقر", "مشروع عقد التعديل إذا كان المقر واردًا في العقد", "مستخرج حديث من السجل التجاري لم يمر عليه أكثر من ثلاثة أشهر"]',
  '[{"days": 2, "title": "تجهيز عقد المقر ومحضر القرار"}, {"days": 7, "title": "اعتماد الهيئة العامة للاستثمار"}, {"days": 3, "title": "التأشير في السجل التجاري"}, {"days": 2, "title": "تحديث البيانات لدى مأمورية الضرائب"}]'),
('activity_change', 'إضافة نشاط أو تعديله', 'amendment', 'الهيئة العامة للاستثمار والسجل التجاري ومأمورية الضرائب', 0, 21, null, 'registry', 240,
  '["محضر قرار جماعة الشركاء بأغلبية ثلاثة أرباع رأس المال", "مشروع عقد التعديل", "موافقة الجهة المختصة إذا كان النشاط يحتاج ترخيصًا خاصًا", "مستخرج حديث من السجل التجاري لم يمر عليه أكثر من ثلاثة أشهر"]',
  '[{"days": 3, "title": "إعداد محضر القرار وعقد التعديل"}, {"days": 10, "title": "اعتماد الهيئة العامة للاستثمار والموافقات"}, {"days": 3, "title": "التأشير في السجل التجاري"}, {"days": 2, "title": "تحديث البيانات لدى مأمورية الضرائب"}]'),
('accounts_approval', 'اعتماد الميزانية السنوية', 'compliance', 'الشركة، ثم الهيئة العامة للاستثمار', 0, 14, null, 'none', 250,
  '["القوائم المالية للسنة المنتهية", "تقرير مراقب الحسابات", "تقرير المدير عن نشاط الشركة", "دعوة الشركاء بكتاب موصى عليه مع علم الوصول مرفقًا بها المستندات", "محضر اجتماع جماعة الشركاء باعتماد الميزانية"]',
  '[{"days": 7, "title": "إعداد القوائم المالية وتقرير مراقب الحسابات"}, {"days": 5, "title": "دعوة الشركاء وإرسال المستندات"}, {"days": 1, "title": "اجتماع جماعة الشركاء والاعتماد"}]');

insert into public.requirement_items (service_id, text, status, created_by)
select s.id, d.value, 'approved', null from public.services s, jsonb_array_elements_text(s.docs) d
where s.id in ('capital_change', 'share_transfer', 'manager_change', 'address_change', 'activity_change', 'accounts_approval');
-- The insert guard marks new items pending; these come from the platform itself.
update public.requirement_items set status = 'approved'
where created_by is null and status = 'pending'
  and service_id in ('capital_change', 'share_transfer', 'manager_change', 'address_change', 'activity_change', 'accounts_approval');
