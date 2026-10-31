"use client";
// The guide: a few questions, then a plan of steps with cost, time and who does each one.
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { sb } from "@/lib/supabase";
import { days, money, num } from "@/lib/format";
import { optionsFor, services, type Option } from "@/lib/data";
import { useLoad, useSession } from "../session";
import { Head, Icon, Kpi, LoadError, Loading, OptionCards } from "../ui";

const QUESTIONS = [
  { key: "partners", q: "هل ستبدأ وحدك أم مع شركاء؟", opts: [["alone", "وحدي", "المشروع ملكي بالكامل"], ["many", "معي شريك أو أكثر", "اثنان أو أكثر في الملكية"]] },
  { key: "activity", q: "ما طبيعة النشاط؟", opts: [["shop", "تجاري بمحل", "بيع أو خدمة من مكان مفتوح للجمهور"], ["online", "خدمات أو بيع عبر الإنترنت", "دون محل مفتوح للجمهور"], ["factory", "صناعي", "ورشة أو مصنع"]] },
  { key: "turnover", q: "ما حجم المبيعات السنوي المتوقع؟", opts: [["s", "أقل من نصف مليون جنيه", "مشروع صغير في البداية"], ["m", "من نصف مليون إلى عشرين مليون", "مشروع متوسط"], ["l", "أكثر من عشرين مليون", "مشروع كبير"]] },
  { key: "staff", q: "هل ستوظف عاملين؟", opts: [["yes", "نعم", "موظف أو أكثر"], ["no", "لا، وحدي في البداية", "دون موظفين حاليًا"]] },
];
const ANSWER_ICONS: Record<string, string> = { alone: "person", many: "users", shop: "building", online: "pulse", factory: "building", s: "chart", m: "chart", l: "chart", yes: "users", no: "person" };

// Kept while the owner moves between the questions and the plan.
const guide: { answers: Record<string, string>; qi: number; choices: Record<string, string>; open: string | null; name: string } =
  { answers: {}, qi: 0, choices: {}, open: null, name: "" };

function entityFor(a: Record<string, string>) {
  if (a.partners === "many") return { name: "شركة ذات مسئولية محدودة", why: "لأن لديك شركاء، وتكون المسؤولية في حدود رأس المال.", company: true };
  if (a.turnover === "s" && a.activity !== "factory") return { name: "منشأة فردية", why: "الأبسط والأسرع والأقل تكلفة في البداية، لكن مسؤوليتك عن الديون غير محدودة.", company: false };
  return { name: "شركة الشخص الواحد", why: "تفصل ذمتك المالية عن ذمة الشركة، وتناسب حجم نشاطك.", company: true };
}
function planSteps(a: Record<string, string>) {
  const list: string[] = [];
  if (entityFor(a).company) list.push("name_reservation", "incorporation");
  list.push("commercial_register", "tax_card");
  if (a.turnover !== "s") list.push("vat_registration");
  if (a.activity === "shop") list.push("shop_license");
  if (a.staff === "yes") list.push("social_insurance");
  list.push("bank_account");
  return list;
}

export function Guide() {
  const router = useRouter();
  const [, redraw] = useState(0);
  const Q = QUESTIONS[guide.qi], val = guide.answers[Q.key];
  const set = (fn: () => void) => { fn(); redraw((x) => x + 1); };
  return (
    <>
      <Head eyebrow="الدليل" title="أسئلة قليلة، ثم تصبح خريطتك جاهزة"><p>سنقترح عليك الكيان المناسب، والخطوات بالترتيب، وتكلفة كل خطوة ومدتها.</p></Head>
      <section className="panel quiz">
        <div className="row between">
          <span className="eyebrow">سؤال {num(guide.qi + 1)} من {num(QUESTIONS.length)}</span>
          <div className="progress" aria-hidden="true">{QUESTIONS.map((_, i) => <span key={i} className={i <= guide.qi ? "on" : ""} />)}</div>
        </div>
        <h2 id="q-title">{Q.q}</h2>
        <div className="opts" role="radiogroup" aria-labelledby="q-title">
          {Q.opts.map(([v, b, s]) => (
            <label key={v} className="opt">
              <input type="radio" name="q" id={`q-${v}`} value={v} checked={val === v} onChange={() => set(() => { guide.answers[Q.key] = v; })} />
              <span className="tile-ic"><Icon name={ANSWER_ICONS[v] || "check"} size={22} /></span><span><b>{b}</b><small>{s}</small></span>
            </label>
          ))}
        </div>
        <div className="row">
          <button className="btn primary" type="button" disabled={!val} onClick={() => guide.qi < QUESTIONS.length - 1 ? set(() => { guide.qi++; }) : router.push("/plan")}>
            {guide.qi === QUESTIONS.length - 1 ? "اعرض خريطتي" : "التالي"}
          </button>
          {guide.qi > 0 && <button className="btn" type="button" onClick={() => set(() => { guide.qi--; })}>رجوع</button>}
        </div>
      </section>
    </>
  );
}

export function Plan() {
  const router = useRouter();
  const { uid, isPreview, toast } = useSession();
  const missing = QUESTIONS.some((q) => !guide.answers[q.key]);
  const [, redraw] = useState(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (missing) router.replace("/guide"); }, [missing, router]);

  const a = guide.answers, e = entityFor(a), list = planSteps(a);
  const { data, error } = useLoad(async () => {
    if (missing) return null;
    const svcs = await services();
    const opts: Record<string, Option[]> = Object.fromEntries(await Promise.all(list.map(async (id) => [id, await optionsFor(id, isPreview)])));
    return { svcs, opts };
  }, [list.join(","), isPreview]);

  if (missing || (!data && !error)) return <Loading />;
  if (error) return <LoadError />;
  const { svcs, opts } = data;
  guide.open ??= list[0];
  const pick = (id: string) => opts[id].find((o) => o.key === guide.choices[id]) || opts[id][1] || opts[id][0];
  let cost = 0, time = 0, gov = 0;
  list.forEach((id) => { const o = pick(id); cost += o.cost; time += o.days; gov += Number(svcs[id].gov_fee); });

  const launch = async () => {
    const name = guide.name.trim();
    if (!name) return toast("اكتب اسم مشروعك أولًا", true);
    setBusy(true);
    const { data: co, error } = await sb.from("companies").insert({ owner_id: uid, name, legal_form: e.name, status: "founding", is_demo: isPreview }).select().single();
    if (error) { setBusy(false); return toast("تعذّر تسجيل المشروع", true); }
    const rows = list.map((id) => { const o = pick(id); return { company_id: co.id, owner_id: uid, service_id: id, office_id: o.officeId, quoted_fee: o.cost, quoted_days: o.days, is_demo: isPreview }; });
    const { error: e2 } = await sb.from("requests").insert(rows);
    if (e2) { setBusy(false); return toast("تم تسجيل المشروع، لكن تعذّر إنشاء الطلبات. حاول مرة أخرى من الخريطة", true); }
    Object.assign(guide, { answers: {}, qi: 0, choices: {}, name: "", open: null });
    toast("تم إنشاء طلبات التأسيس، ويمكنك متابعتها من لوحتك");
    router.push("/companies/" + co.id);
  };

  return (
    <>
      <Head eyebrow="خريطتك" title={`${num(list.length)} خطوات توصلك لكيان رسمي`}>
        <p>الكيان المناسب لك: <b className="on-navy">{e.name}</b>. {e.why}</p>
        <div className="chips">
          {a.turnover !== "l" && <span className="chip on-navy">مؤهل للنظام الضريبي المبسط</span>}
          {a.turnover !== "s" && <span className="chip on-navy">مطلوب تسجيل القيمة المضافة</span>}
        </div>
      </Head>
      <div className="kpis">
        <Kpi ic="list" value={list.length} label="خطوات" />
        <Kpi ic="chart" tone="ok" value={money(cost)} label="التكلفة التقريبية" />
        <Kpi ic="clock" tone="warn" value={days(time)} label="المدة إذا نُفذت متتالية" />
      </div>
      <div className="split">
        <div className="split-main steps">
          {list.map((id, i) => {
            const s = svcs[id], open = guide.open === id, cur = pick(id);
            return (
              <div key={id} className={"step" + (open ? " open" : "")}>
                <button type="button" className="step-h" aria-expanded={open} onClick={() => { guide.open = open ? null : id; redraw((x) => x + 1); }}>
                  <span className="num">{num(i + 1)}</span>
                  <span className="t"><b>{s.title}</b><small>{s.agency}</small></span>
                  <span className="step-pick"><b>{money(cur.cost)}</b><small>{cur.label} · {days(cur.days)}</small></span>
                  <span className="chev" aria-hidden="true"><Icon name="arrow" size={18} /></span>
                </button>
                {open && (
                  <div className="step-b">
                    <div className="docs"><b>المستندات المطلوبة</b><ul>{s.docs.map((d) => <li key={d}>{d}</li>)}</ul></div>
                    <b>من ينفذها؟</b>
                    <OptionCards opts={opts[id]} name={"alt-" + id} picked={cur.key} onPick={(k) => { guide.choices[id] = k; redraw((x) => x + 1); }} />
                    {opts[id].length === 1 && <p className="note">لم يحدد أي مكتب سعرًا لهذه الخدمة بعد.</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <aside className="split-side">
          <section className="panel sum">
            <h2>ابدأ التنفيذ</h2>
            <div>
              <div className="kv"><span>التكلفة التقريبية</span><b>{money(cost)}</b></div>
              <div className="kv"><span>منها رسوم حكومية</span><b>{money(gov)}</b></div>
              <div className="kv"><span>المدة إذا نُفذت الخطوات متتالية</span><b>{days(time)}</b></div>
            </div>
            <div className="field"><label htmlFor="co-name">اسم مشروعك</label>
              <input id="co-name" placeholder="مثلاً: مخبز النور" defaultValue={guide.name} onChange={(ev) => { guide.name = ev.target.value; }} /></div>
            <button className="btn primary" type="button" disabled={busy} onClick={launch}>ابدأ التنفيذ</button>
            <p className="note">الأسعار من المكاتب المعتمدة، والرسوم الحكومية تقديرية ويتم تأكيدها قبل الدفع.</p>
          </section>
        </aside>
      </div>
    </>
  );
}
