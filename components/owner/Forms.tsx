"use client";
// Adding an existing company with its documents, adding one document, and choosing who renews a document.
import { useRouter } from "next/navigation";
import { useState } from "react";
import { sb } from "@/lib/supabase";
import { days, money, span } from "@/lib/format";
import { docStatus, optionsFor, services } from "@/lib/data";
import { useLoad, useSession } from "../session";
import { Head, Icon, LoadError, Loading, OptionCards } from "../ui";

const docTitle = (t: { title: string }) => t.title.replace("تجديد ", "");
const FORMS = ["شركة ذات مسئولية محدودة", "شركة الشخص الواحد", "منشأة فردية", "شركة مساهمة", "شركة توصية بسيطة"];

const renewals = async () => Object.values(await services()).filter((s) => s.kind === "renewal");

export function CompanyNew() {
  const router = useRouter();
  const { uid, isPreview, toast } = useSession();
  const { data: types, error } = useLoad(renewals, []);
  const [busy, setBusy] = useState(false);
  if (error) return <LoadError />;
  if (!types) return <Loading />;

  const save = async (ev: React.FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    const f = new FormData(ev.currentTarget);
    setBusy(true);
    const { data: co, error } = await sb.from("companies").insert({ owner_id: uid, name: String(f.get("name")).trim(), legal_form: f.get("form"), is_demo: isPreview }).select().single();
    if (error) { setBusy(false); return toast("تعذّر حفظ الشركة، حاول مرة أخرى", true); }
    const docs = types.map((t) => ({ t, v: String(f.get("exp-" + t.id) || "") })).filter((x) => x.v)
      .map(({ t, v }) => ({ company_id: co.id, service_id: t.id, title: docTitle(t), expires_on: v }));
    if (docs.length) { const { error: e2 } = await sb.from("documents").insert(docs); if (e2) toast("تم حفظ الشركة، لكن تعذّر حفظ المستندات", true); }
    toast("تم حفظ الشركة"); router.push("/companies/" + co.id);
  };

  return (
    <>
      <Head eyebrow="شركة قائمة" title="أضف شركتك ومستنداتها"><p>اكتب تاريخ انتهاء كل مستند، وستحسب المنصة موعد بدء تجديده.</p></Head>
      <form className="stack" onSubmit={save}>
        <section className="panel">
          <h2>بيانات الشركة</h2>
          <div className="form-row two">
            <div className="field"><label htmlFor="c-name">اسم الشركة</label><input id="c-name" name="name" required /></div>
            <div className="field"><label htmlFor="c-form">الشكل القانوني</label><select id="c-form" name="form">{FORMS.map((x) => <option key={x}>{x}</option>)}</select></div>
          </div>
        </section>
        <section className="panel">
          <div className="row between"><h2>المستندات</h2><span className="note">اترك التاريخ فارغًا إذا لم يكن لدى الشركة هذا المستند</span></div>
          <div className="doc-inputs">
            {types.map((t) => (
              <div key={t.id} className="doc-input"><span className="tile-ic"><Icon name="doc" size={22} /></span>
                <div className="field"><label htmlFor={`exp-${t.id}`}>{docTitle(t)}</label><small className="note">{t.agency} · تاريخ الانتهاء</small><input type="date" id={`exp-${t.id}`} name={`exp-${t.id}`} /></div>
              </div>
            ))}
          </div>
          <button className="btn primary" type="submit" disabled={busy}>حفظ الشركة</button>
        </section>
      </form>
    </>
  );
}

export function DocNew({ companyId }: { companyId: string }) {
  const router = useRouter();
  const { toast } = useSession();
  const { data: types, error } = useLoad(renewals, []);
  if (error) return <LoadError />;
  if (!types) return <Loading />;
  const save = async (ev: React.FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    const f = new FormData(ev.currentTarget);
    const t = types.find((x) => x.id === f.get("type"));
    const { error } = await sb.from("documents").insert({ company_id: companyId, service_id: t.id, title: docTitle(t), expires_on: f.get("exp") });
    if (error) return toast("تعذّر حفظ المستند", true);
    toast("تم حفظ المستند"); router.push("/companies/" + companyId);
  };
  return (
    <>
      <Head back={[`/companies/${companyId}`, "لوحتي"]} title="إضافة مستند" />
      <form className="panel" onSubmit={save}>
        <div className="form-row two">
          <div className="field"><label htmlFor="d-type">نوع المستند</label><select id="d-type" name="type">{types.map((t) => <option key={t.id} value={t.id}>{docTitle(t)}</option>)}</select></div>
          <div className="field"><label htmlFor="d-exp">تاريخ الانتهاء</label><input type="date" id="d-exp" name="exp" required /></div>
        </div>
        <button className="btn primary" type="submit">حفظ المستند</button>
      </form>
    </>
  );
}

export function Renew({ docId }: { docId: string }) {
  const router = useRouter();
  const { uid, isPreview, toast } = useSession();
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { data, error } = useLoad(async () => {
    const svcs = await services();
    const { data: d } = await sb.from("documents").select("*, companies(id,name,owner_id)").eq("id", docId).maybeSingle();
    if (!d) return { d: null };
    return { d, s: svcs[d.service_id], opts: await optionsFor(d.service_id, isPreview) };
  }, [docId, isPreview]);
  if (error) return <LoadError />;
  if (!data) return <Loading />;
  const { d, s, opts } = data;
  if (!d) return <section className="panel"><p>هذا المستند غير موجود.</p></section>;

  const pick = picked ?? (opts[1]?.key || "self");
  const o = opts.find((x) => x.key === pick);
  const st = docStatus(d, s);
  const when = st.left === null ? "" : st.left < 0 ? `انتهى منذ ${span(-st.left)}` : `ينتهي بعد ${span(st.left)}`;
  const go = async () => {
    setBusy(true);
    const { data: r, error } = await sb.from("requests").insert({ company_id: d.company_id, owner_id: uid, service_id: d.service_id, document_id: d.id,
      office_id: o.officeId, quoted_fee: o.cost, quoted_days: o.days, is_demo: isPreview }).select().single();
    if (error) { setBusy(false); return toast("تعذّر إنشاء الطلب", true); }
    toast(o.officeId ? "تم إرسال الطلب إلى " + o.label : "تم إنشاء الطلب، ويمكنك متابعة خطواته بنفسك");
    router.push("/requests/" + r.id);
  };
  return (
    <>
      <Head back={[`/companies/${d.company_id}`, "لوحتي"]} eyebrow={d.companies.name} title={s.title}>
        <p>{when ? `${d.title}: ${when}. ` : ""}قارن واختر من ينفذ التجديد.</p>
      </Head>
      <div className="split">
        <section className="panel split-main"><h2>اختر من ينفذ</h2>
          <OptionCards opts={opts} name="alt" picked={pick} onPick={setPicked} />
          <div className="confirm"><span>{o.label} · <b>{money(o.cost)}</b> · {days(o.days)}</span>
            <button className="btn primary" type="button" disabled={busy} onClick={go}>تأكيد الطلب</button></div>
        </section>
        <aside className="split-side">
          <section className="panel"><h2>جهّز هذه المستندات</h2><ul className="checklist">{s.docs.map((x) => <li key={x}><Icon name="check" size={16} />{x}</li>)}</ul></section>
          <section className="panel"><h2>كيف رتّبنا الخيارات</h2><p className="note">التقييم من أصحاب الأعمال بعد كل طلب، ونسبة الالتزام بالمواعيد محسوبة من تواريخ الطلبات نفسها.</p></section>
        </aside>
      </div>
    </>
  );
}

