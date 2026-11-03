"use client";
// The owner's sections beyond the dashboard: obligations, actions, the
// company file and requests, all for the company being looked at.
import Link from "next/link";
import { sb } from "@/lib/supabase";
import { DAY, days, fmtDate, money, today } from "@/lib/format";
import { STATUS, docStatus, services, sortStages, stageLate } from "@/lib/data";
import { CompanySwitch, useCompanies } from "../companies";
import { useLoad } from "../session";
import { Head, Icon, LoadError, Loading } from "../ui";
import Files from "./Files";

function NoCompany({ what }: { what: string }) {
  return (
    <section className="panel">
      <p>{what} تظهر بعد أن تبدأ تأسيس مشروعك أو تضيف شركة قائمة.</p>
      <div className="row">
        <Link className="btn primary" href="/guide">لدي فكرة مشروع</Link>
        <Link className="btn" href="/companies/new">لدي شركة قائمة</Link>
      </div>
    </section>
  );
}

// ---------- Obligations ----------
// Everything the company owes, by date: renewals now, recurring filings later.
export function Obligations() {
  const { list, current } = useCompanies();
  const { data, error } = useLoad(async () => {
    if (!current) return null;
    const [svcs, { data: docs }, { data: reqs }] = await Promise.all([
      services(),
      sb.from("documents").select("*").eq("company_id", current.id),
      sb.from("requests").select("id,service_id,status,document_id,quoted_days,accepted_at,created_at,offices(name)").eq("company_id", current.id).not("status", "in", "(done,cancelled)"),
    ]);
    return { svcs, docs: docs || [], reqs: reqs || [] };
  }, [current?.id]);

  const head = (
    <Head eyebrow={<>الالتزامات <CompanySwitch /></>} title="ما الذي على شركتك ومتى">
      <p>كل التزامات الشركة في مكان واحد ومرتبة حسب الموعد، ومعها تذكير قبل كل موعد بوقت كافٍ.</p>
    </Head>
  );
  if (!list) return <>{head}<Loading /></>;
  if (!current) return <>{head}<NoCompany what="التزامات الشركة" /></>;
  if (error) return <>{head}<LoadError /></>;
  if (!data) return <>{head}<Loading /></>;

  type Ob = { date: Date; title: string; sub: string; tone: string; href: string | null; cta: string };
  const obs: Ob[] = [];
  data.docs.forEach((d) => {
    if (!d.expires_on) return;
    const svc = data.svcs[d.service_id], st = docStatus(d, svc);
    const busy = data.reqs.find((r) => r.document_id === d.id);
    obs.push({ date: new Date(d.expires_on), title: `تجديد ${d.title}`,
      sub: busy ? "التجديد قيد التنفيذ" : st.left < 0 ? "انتهت صلاحيته" : `ابدأ التجديد من ${fmtDate(st.startOn)}`,
      tone: busy ? "" : st.cls === "bad" ? "bad" : st.cls === "warn" ? "warn" : "",
      href: busy ? `/requests/${busy.id}` : svc?.kind === "renewal" ? `/renew/${d.id}` : null, cta: busy ? "متابعة" : "تجديد" });
  });
  data.reqs.forEach((r) => {
    if (r.document_id) return;
    const due = new Date(new Date(r.accepted_at || r.created_at).getTime() + (r.quoted_days || 0) * DAY);
    obs.push({ date: due, title: data.svcs[r.service_id]?.title || r.service_id, sub: "الموعد المتوقع لانتهاء الطلب",
      tone: due < today() ? "bad" : "", href: `/requests/${r.id}`, cta: "متابعة" });
  });
  obs.sort((a, b) => a.date.getTime() - b.date.getTime());
  const t = today().getTime();
  const groups: [string, Ob[]][] = [
    ["متأخر", obs.filter((o) => o.date.getTime() < t)],
    ["خلال ٣٠ يومًا", obs.filter((o) => o.date.getTime() >= t && o.date.getTime() < t + 30 * DAY)],
    ["خلال ٣ أشهر", obs.filter((o) => o.date.getTime() >= t + 30 * DAY && o.date.getTime() < t + 90 * DAY)],
    ["لاحقًا", obs.filter((o) => o.date.getTime() >= t + 90 * DAY)],
  ];
  return (
    <>
      {head}
      {obs.length ? groups.filter(([, g]) => g.length).map(([label, g]) => (
        <section key={label} className="panel"><h2>{label}</h2>
          <div className="ob-group">{g.map((o, i) => (
            <div key={i} className={`ob-row ${o.tone}`}>
              <span className="ob-date">{o.date.getDate()}<small>{o.date.toLocaleDateString("ar-EG", { month: "short", year: "numeric" })}</small></span>
              <span className="grow"><b>{o.title}</b><small className="note">{o.sub}</small></span>
              {o.href && <Link className="btn small" href={o.href}>{o.cta}</Link>}
            </div>
          ))}</div>
        </section>
      )) : (
        <section className="panel"><p className="empty">لا توجد التزامات مسجلة بعد. أضف مستندات الشركة وتواريخ انتهائها لتظهر هنا.</p>
          <Link className="btn" href={`/companies/${current.id}/documents/new`}>إضافة مستند</Link></section>
      )}
      <section className="panel">
        <span className="tile-ic"><Icon name="clock" /></span>
        <h2>الإقرارات والاشتراكات الدورية</h2>
        <p className="note">قريبًا ستظهر هنا مواعيد الإقرارات الضريبية واشتراكات التأمينات والجمعية العامة السنوية، محسوبة لشركتك حسب نشاطها وتسجيلها وعدد موظفيها.</p>
      </section>
    </>
  );
}

// ---------- Actions ----------
// What the owner can do, starting from what they want rather than the procedure's name.
const SOON: [string, string, string][] = [
  ["زيادة رأس المال أو تخفيضه", "التعديل", "يحدد لك نوع الجمعية العامة المطلوبة وخطوات التأشير في السجل"],
  ["دخول شريك أو خروجه", "التعديل", "بيع الحصص أو زيادة رأس المال، والمستندات لكل حالة"],
  ["تغيير المدير أو المفوضين بالتوقيع", "التعديل", "الجهة التي تقرر، وورق التأشير"],
  ["تغيير العنوان أو النشاط", "التعديل", "داخل المحافظة أو خارجها، والتراخيص المتأثرة"],
  ["اعتماد الميزانية وتوزيع الأرباح", "الالتزامات السنوية", "الجمعية العامة العادية ومواعيدها"],
  ["إنهاء الشركة", "الإنهاء", "الحل والتصفية أو الشطب، والخطوات بالترتيب"],
];

export function Actions() {
  const { current } = useCompanies();
  const { data } = useLoad(async () => {
    if (!current) return [];
    const [svcs, { data: docs }] = await Promise.all([services(), sb.from("documents").select("*").eq("company_id", current.id)]);
    return (docs || []).filter((d) => svcs[d.service_id]?.kind === "renewal");
  }, [current?.id]);
  return (
    <>
      <Head eyebrow={<>الإجراءات <CompanySwitch /></>} title="ماذا تريد أن تفعل؟">
        <p>اختر ما تريده بكلماتك، وسنوضح لك الإجراء المناسب وسببه، والمستندات المطلوبة، والتكلفة والمدة.</p>
      </Head>
      <section className="panel"><h2>البداية</h2>
        <div className="section-grid">
          <Link className="path-card" href="/guide"><span className="tile-ic"><Icon name="pulse" /></span><b>لدي فكرة وأريد تأسيس مشروع</b>
            <small className="note">أسئلة قليلة تحدد الكيان المناسب، ثم خريطة خطواتك بالتكلفة والمدة.</small></Link>
          <Link className="path-card" href="/companies/new"><span className="tile-ic ok"><Icon name="building" /></span><b>لدي شركة قائمة وأريد إضافتها</b>
            <small className="note">أضف مستنداتها وتواريخ انتهائها لتصلك التذكيرات.</small></Link>
        </div>
      </section>
      {current && (
        <section className="panel"><h2>التجديد</h2>
          {!data ? <Loading /> : data.length ? (
            <div className="section-grid">{data.map((d) => {
              const st = docStatus(d);
              return (
                <Link key={d.id} className="path-card" href={`/renew/${d.id}`}><b>تجديد {d.title}</b>
                  <small className="note">{d.expires_on ? (st.left < 0 ? `انتهى في ${fmtDate(d.expires_on)}` : `ينتهي في ${fmtDate(d.expires_on)}`) : "بلا تاريخ انتهاء"}</small></Link>
              );
            })}</div>
          ) : <p className="empty">أضف مستندات الشركة لتظهر هنا إجراءات تجديدها.</p>}
        </section>
      )}
      <section className="panel"><h2>التعديل والإنهاء</h2>
        <p className="note">هذه المسارات قيد الإعداد، وسنجهز لكل منها أسئلة بسيطة توصلك إلى الإجراء الصحيح.</p>
        <div className="section-grid">{SOON.map(([title, group, sub]) => (
          <div key={title} className="path-card soon" aria-disabled="true"><span className="chip">{group} · قيد الإعداد</span><b>{title}</b><small className="note">{sub}</small></div>
        ))}</div>
      </section>
    </>
  );
}

// ---------- Company file ----------
export function CurrentFiles() {
  const { list, current } = useCompanies();
  if (!list) return <Loading />;
  if (!current) return <><Head eyebrow="ملف الشركة" title="مستندات شركتك في مكان واحد" /><NoCompany what="ملفات الشركة" /></>;
  return <Files companyId={current.id} switcher={<CompanySwitch />} />;
}

// ---------- Requests ----------
export function MyRequests() {
  const { list, current } = useCompanies();
  const { data, error } = useLoad(async () => {
    if (!current) return null;
    const [svcs, { data: reqs }] = await Promise.all([
      services(),
      sb.from("requests").select("*, offices(name), request_stages(idx,title,planned_days,started_at,done_at)").eq("company_id", current.id).order("created_at", { ascending: false }),
    ]);
    return { svcs, reqs: reqs || [] };
  }, [current?.id]);
  const head = <Head eyebrow={<>طلباتي <CompanySwitch /></>} title="إجراءات شركتك"><p>كل إجراء بدأته، مع حالته ومرحلته الحالية.</p></Head>;
  if (!list) return <>{head}<Loading /></>;
  if (!current) return <>{head}<NoCompany what="الطلبات" /></>;
  if (error) return <>{head}<LoadError /></>;
  if (!data) return <>{head}<Loading /></>;
  const open = data.reqs.filter((r) => !["done", "cancelled"].includes(r.status)), closed = data.reqs.filter((r) => !open.includes(r));
  const card = (r) => {
    const st = sortStages(r.request_stages), cur = st.find((x) => !x.done_at), late = cur && ["accepted", "in_progress"].includes(r.status) ? stageLate(cur) : 0;
    return (
      <Link key={r.id} className={"req" + (late ? " late" : "")} href={`/requests/${r.id}`}>
        <div className="row between"><b>{data.svcs[r.service_id]?.title || r.service_id}</b>
          {late ? <span className="chip bad">متأخر {days(late)}</span> : <span className={`chip ${STATUS[r.status][0]}`}>{STATUS[r.status][1]}</span>}</div>
        <small>{r.office_id ? r.offices?.name : "تنفذه بنفسك"} · {money(r.quoted_fee)}{cur ? ` · المرحلة الحالية: ${cur.title}` : ""}</small>
      </Link>
    );
  };
  return (
    <>
      {head}
      <section className="panel"><h2>قيد التنفيذ</h2>{open.length ? <div className="reqs">{open.map(card)}</div> : <p className="empty">لا توجد طلبات قيد التنفيذ.</p>}
        <Link className="btn" href="/actions">ابدأ إجراءً جديدًا</Link></section>
      {closed.length > 0 && <section className="panel"><h2>السابقة</h2><div className="reqs">{closed.map(card)}</div></section>}
    </>
  );
}
