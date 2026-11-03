-- Findings from the second round of research on the points left open.

update public.obligation_rules set
  why = 'صاحب العمل يسدد اشتراكات موظفيه المؤمن عليهم عن كل شهر في أول الشهر التالي. إذا سدد خلال خمسة عشر يومًا من هذا الموعد لا يُحتسب عليه مبلغ إضافي، وبعدها يُحتسب مبلغ إضافي عن كل شهر تأخير.',
  certainty = 'sourced',
  source_title = 'الوطن: مهلة الخمسة عشر يومًا لسداد التأمينات وفق القانون رقم ١٤٨ لسنة ٢٠١٩',
  source_url = 'https://www.elwatannews.com/news/details/8339041',
  checked_on = '2026-11-03'
where id = 'insurance_monthly';

-- Quarterly filing is confirmed by the Tax Authority; the exact day within
-- the following month is not, so the due date stays an estimate.
update public.obligation_rules set
  why = 'المنضمون للنظام الضريبي المبسط وفق القانون رقم ٦ لسنة ٢٠٢٥ يقدمون إقرار القيمة المضافة كل ثلاثة أشهر بدلًا من كل شهر. حددنا الموعد بنهاية الشهر التالي للربع تقديرًا، لأننا لم نجد نصًا يحدد اليوم.',
  certainty = 'estimated',
  source_title = 'مصلحة الضرائب المصرية: النظام الضريبي المبسط وفقًا للقانون رقم ٦ لسنة ٢٠٢٥',
  source_url = 'https://eta.gov.eg/ar/news/alnzam-aldryby-almbst-wfqa-llqanwn-rqm-6-lsnt-2025-frst-daymt-ldm-almnshat-alsghyrt-wthqyq',
  checked_on = '2026-11-03'
where id = 'vat_quarterly';
