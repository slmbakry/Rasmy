-- Recurring obligations: tax returns, social insurance and the annual
-- meeting, worked out for each company from what it is and does. Each rule
-- names its source; rules whose exact deadline the sources leave unclear are
-- marked estimated until confirmed.

alter table public.companies
  add column vat_registered boolean,
  add column has_employees boolean,
  add column simplified_tax boolean,
  add column fiscal_year_end smallint not null default 12 check (fiscal_year_end between 1 and 12);

-- due: when each period's obligation falls due.
--   {"type":"month_end","after":1}        last day of the month `after` months past the period
--   {"type":"day","after":1,"day":1}       a given day of the month `after` months past the period
--   {"type":"fy_months","months":4}        `months` months after the fiscal year ends (annual only)
--   {"type":"fixed","month":1,"day":31}    a fixed date in the year after the period (annual only)
-- applies: all listed conditions must hold for the company.
--   entity: "natural" (sole proprietorship) or "company"; vat, employees, simplified: true or false
create table public.obligation_rules (
  id text primary key,
  title text not null,
  why text not null,
  agency text not null,
  frequency text not null check (frequency in ('monthly', 'quarterly', 'annual')),
  due jsonb not null,
  applies jsonb not null default '{}',
  certainty text not null default 'sourced' check (certainty in ('sourced', 'estimated')),
  source_title text,
  source_url text,
  checked_on date not null default current_date,
  active boolean not null default true,
  sort int not null default 0
);
alter table public.obligation_rules enable row level security;
create policy obligation_rules_read on public.obligation_rules for select to authenticated using (active or (select public.is_admin()));
create policy obligation_rules_admin on public.obligation_rules for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

insert into public.obligation_rules (id, title, why, agency, frequency, due, applies, certainty, source_title, source_url, sort) values
('vat_monthly', 'إقرار ضريبة القيمة المضافة الشهري', 'كل منشأة مسجلة في القيمة المضافة تقدم إقرارًا عن كل شهر على النموذج رقم ١٠، حتى لو لم يكن لها مبيعات.', 'مصلحة الضرائب', 'monthly',
  '{"type":"month_end","after":1}', '{"vat":true,"simplified":false}', 'sourced',
  'مصلحة الضرائب المصرية: إقرار القيمة المضافة يقدم شهريًا', 'https://eta.gov.eg/ar/news/aqrar-aldrybt-ly-alqymt-almdaft-yqdm-shhryana-ly-nmwdhj-rqm10', 10),
('vat_quarterly', 'إقرار ضريبة القيمة المضافة الربع سنوي', 'المنضمون للنظام الضريبي المبسط يقدمون إقرار القيمة المضافة كل ثلاثة أشهر بدلًا من كل شهر.', 'مصلحة الضرائب', 'quarterly',
  '{"type":"month_end","after":1}', '{"vat":true,"simplified":true}', 'estimated',
  'بوابة الأهرام: مزايا النظام المبسط للمشروعات الصغيرة', 'https://gate.ahram.org.eg/News/5265983.aspx', 11),
('payroll_quarterly', 'إقرار ضريبة المرتبات الربع سنوي', 'صاحب العمل يخصم ضريبة المرتبات من موظفيه ويقدم عنها إقرارًا كل ربع سنة، في يناير وأبريل ويوليو وأكتوبر.', 'مصلحة الضرائب', 'quarterly',
  '{"type":"month_end","after":1}', '{"employees":true,"simplified":false}', 'sourced',
  'اليوم السابع: مواقيت الإقرارات وفق قانون الإجراءات الضريبية الموحد', 'https://www.youm7.com/story/2021/7/28/4-%D9%85%D9%88%D8%A7%D9%82%D9%8A%D8%AA-%D9%84%D9%84%D8%A5%D9%82%D8%B1%D8%A7%D8%B1%D8%A7%D8%AA-%D8%A7%D9%84%D8%B6%D8%B1%D9%8A%D8%A8%D9%8A%D8%A9-%D9%88%D9%81%D9%82-%D9%82%D8%A7%D9%86%D9%88%D9%86-%D8%A7%D9%84%D8%A5%D8%AC%D8%B1%D8%A7%D8%A1%D8%A7%D8%AA-%D8%A7%D9%84%D9%85%D9%88%D8%AD%D8%AF-%D8%A7%D9%84%D8%B4%D9%87%D8%B1%D9%8A%D8%A9-%D9%88%D8%AA%D8%B3%D8%AA%D8%AD%D9%82/5405010', 20),
('payroll_annual', 'التسوية السنوية لضريبة المرتبات', 'في يناير من كل سنة يقدم صاحب العمل إقرار التسوية النهائية لضريبة مرتبات السنة السابقة، ويتحمل الفروق إن وجدت.', 'مصلحة الضرائب', 'annual',
  '{"type":"fixed","month":1,"day":31}', '{"employees":true}', 'sourced',
  'فيتو: مواعيد تقديم الإقرار الضريبي وفقًا لقانون الإجراءات الضريبية الموحد', 'https://www.vetogate.com/5451069', 21),
('insurance_monthly', 'اشتراكات التأمينات الاجتماعية الشهرية', 'صاحب العمل يسدد اشتراكات موظفيه المؤمن عليهم عن كل شهر مع بداية الشهر التالي، والتأخير يرتب مبالغ إضافية.', 'الهيئة القومية للتأمين الاجتماعي', 'monthly',
  '{"type":"day","after":1,"day":1}', '{"employees":true}', 'estimated',
  'قانون التأمينات الاجتماعية والمعاشات رقم ١٤٨ لسنة ٢٠١٩', 'https://www.youm7.com/story/2021/4/17/%D9%83%D9%8A%D9%81-%D9%8A%D8%AA%D8%B9%D8%A7%D9%85%D9%84-%D9%82%D8%A7%D9%86%D9%88%D9%86-%D8%A7%D9%84%D8%AA%D8%A3%D9%85%D9%8A%D9%86%D8%A7%D8%AA-%D8%A7%D9%84%D8%A7%D8%AC%D8%AA%D9%85%D8%A7%D8%B9%D9%8A%D8%A9-%D9%85%D8%B9-%D8%A7%D9%84%D8%AC%D9%87%D8%A7%D8%AA-%D8%A7%D9%84%D9%85%D8%AA%D8%A3%D8%AE%D8%B1%D8%A9-%D9%81%D9%89-%D8%B3%D8%AF%D8%A7%D8%AF/5283646', 30),
('income_company', 'الإقرار الضريبي السنوي للشركة', 'الشركات تقدم إقرار ضريبة الدخل خلال أربعة أشهر من انتهاء سنتها المالية.', 'مصلحة الضرائب', 'annual',
  '{"type":"fy_months","months":4}', '{"entity":"company"}', 'sourced',
  'اليوم السابع: مواقيت الإقرارات وفق قانون الإجراءات الضريبية الموحد', 'https://www.youm7.com/story/2021/7/28/4-%D9%85%D9%88%D8%A7%D9%82%D9%8A%D8%AA-%D9%84%D9%84%D8%A5%D9%82%D8%B1%D8%A7%D8%B1%D8%A7%D8%AA-%D8%A7%D9%84%D8%B6%D8%B1%D9%8A%D8%A8%D9%8A%D8%A9-%D9%88%D9%81%D9%82-%D9%82%D8%A7%D9%86%D9%88%D9%86-%D8%A7%D9%84%D8%A5%D8%AC%D8%B1%D8%A7%D8%A1%D8%A7%D8%AA-%D8%A7%D9%84%D9%85%D9%88%D8%AD%D8%AF-%D8%A7%D9%84%D8%B4%D9%87%D8%B1%D9%8A%D8%A9-%D9%88%D8%AA%D8%B3%D8%AA%D8%AD%D9%82/5405010', 40),
('income_natural', 'الإقرار الضريبي السنوي لصاحب المنشأة', 'صاحب المنشأة الفردية يقدم إقرار ضريبة الدخل عن السنة قبل أول أبريل من السنة التالية.', 'مصلحة الضرائب', 'annual',
  '{"type":"fixed","month":3,"day":31}', '{"entity":"natural"}', 'sourced',
  'فيتو: مواعيد تقديم الإقرار الضريبي وفقًا لقانون الإجراءات الضريبية الموحد', 'https://www.vetogate.com/5451069', 41),
('annual_meeting', 'اجتماع الشركاء السنوي واعتماد الميزانية', 'جماعة الشركاء تجتمع مرة على الأقل كل سنة، خلال ستة أشهر من انتهاء السنة المالية، لاعتماد الميزانية وحساب الأرباح والخسائر وتقرير المدير.', 'الشركة، ثم الهيئة العامة للاستثمار', 'annual',
  '{"type":"fy_months","months":6}', '{"entity":"company"}', 'sourced',
  'اللائحة التنفيذية لقانون الشركات رقم ١٥٩ لسنة ١٩٨١', 'https://www.investinegypt.gov.eg/Documents/Executive%20regulations%20of%20Law%20No.%20159%20of%201981%20for%20the%20Law%20of%20Joint%20Stock%20Companies,%20Partnerships%20Limited%20by%20Shares,%20and%20Limited%20Liability%20Companies.pdf', 50);

-- Periods the owner marked as done.
create table public.obligation_done (
  company_id uuid not null references public.companies (id) on delete cascade,
  rule_id text not null references public.obligation_rules (id),
  period text not null,
  done_at timestamptz not null default now(),
  done_by uuid default auth.uid(),
  primary key (company_id, rule_id, period)
);
alter table public.obligation_done enable row level security;
create policy obligation_done_owner on public.obligation_done for all to authenticated
  using ((select public.owns_company(company_id))) with check ((select public.owns_company(company_id)));
