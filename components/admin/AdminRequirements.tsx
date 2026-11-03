"use client";
// Admin review of requirement items: approve or reject suggestions, fold
// duplicates into one item, and give each authority one spelling.
import { useState } from "react";
import { sb } from "@/lib/supabase";
import { fmtDate, num } from "@/lib/format";
import { services } from "@/lib/data";
import { useLoad, useSession } from "../session";
import { useRequirementStats } from "../Requirements";
import { Head, LoadError, Loading } from "../ui";

export default function AdminRequirements() {
  const { toast } = useSession();
  const [serviceId, setServiceId] = useState("");
  const { data, error, reload } = useLoad(async () => {
    const [svcs, { data: pending }, { data: approved }] = await Promise.all([
      services(),
      sb.from("requirement_items").select("id,service_id,text,created_at").eq("status", "pending").order("created_at"),
      sb.from("requirement_items").select("id,service_id,text").eq("status", "approved").order("text"),
    ]);
    return { svcs, pending: pending || [], approved: approved || [] };
  }, []);
  const svc = serviceId || (data ? Object.keys(data.svcs)[0] : "");
  const { data: stats, reload: reloadStats } = useRequirementStats(svc || "-", null);

  if (error) return <LoadError />;
  if (!data) return <Loading />;
  const { svcs, pending, approved } = data;
  const after = (msg: string) => (r: { error: unknown }) => { if (r.error) toast("تعذّر الحفظ", true); else { toast(msg); reload(); reloadStats(); } };
  const decide = (id: string, status: string) => sb.from("requirement_items").update({ status }).eq("id", id).then(after(status === "approved" ? "تم قبول البند" : "تم رفض البند"));
  const merge = (from: string, into: string) => { if (into) sb.rpc("merge_requirement", { p_from: from, p_into: into }).then(after("تم الدمج")); };

  return (
    <>
      <Head eyebrow="المتطلبات" title="مراجعة المتطلبات">
        <p>اقتراحات مقدمي الخدمة وأصحاب الشركات لا تظهر قبل موافقتك. إذا كان الاقتراح مكررًا بصياغة أخرى، ادمجه مع البند الموجود فتُحسب تأكيداته معه.</p>
      </Head>
      <section className="panel">
        <h2>اقتراحات بانتظار المراجعة</h2>
        {pending.length ? pending.map((p) => (
          <div key={p.id} className="review">
            <div className="grow"><b>{p.text}</b><small className="note">{svcs[p.service_id]?.title} · {fmtDate(p.created_at)}</small></div>
            <div className="row">
              <button className="btn small primary" type="button" onClick={() => decide(p.id, "approved")}>قبول</button>
              <button className="btn small" type="button" onClick={() => decide(p.id, "rejected")}>رفض</button>
              <select aria-label="دمج مع بند موجود" defaultValue="" onChange={(e) => merge(p.id, e.target.value)}>
                <option value="">دمج مع بند موجود</option>
                {approved.filter((a) => a.service_id === p.service_id).map((a) => <option key={a.id} value={a.id}>{a.text}</option>)}
              </select>
            </div>
          </div>
        )) : <p className="empty">لا توجد اقتراحات جديدة.</p>}
      </section>
      <section className="panel">
        <div className="row between"><h2>البنود المعتمدة</h2>
          <select value={svc} onChange={(e) => setServiceId(e.target.value)}>{Object.values(svcs).map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}</select></div>
        {!stats ? <Loading /> : stats.map((s) => (
          <div key={s.item_id} className="review">
            <div className="grow"><b>{s.text}</b><small className="note">{s.total ? `أكده ${num(s.providers)} من مقدمي الخدمة و${num(s.owners)} من أصحاب الشركات` : "لا توجد تأكيدات بعد"}</small></div>
            <select aria-label="دمج مع بند آخر" defaultValue="" onChange={(e) => merge(s.item_id, e.target.value)}>
              <option value="">دمج مع بند آخر</option>
              {stats.filter((o) => o.item_id !== s.item_id).map((o) => <option key={o.item_id} value={o.item_id}>{o.text}</option>)}
            </select>
          </div>
        ))}
      </section>
      <Places />
    </>
  );
}

function Places() {
  const { toast } = useSession();
  const [kind, setKind] = useState<"registry" | "tax_office">("tax_office");
  const { data: names, reload } = useLoad(async () => ((await sb.rpc("place_names", { p_kind: kind })).data || []) as string[], [kind]);
  const rename = async (from: string, to: string) => {
    if (!to.trim() || to.trim() === from) return;
    const { error } = await sb.rpc("rename_place", { p_kind: kind, p_from: from, p_to: to.trim() });
    if (error) return toast("تعذّر توحيد الاسم", true);
    toast("تم توحيد الاسم"); reload();
  };
  return (
    <section className="panel">
      <div className="row between"><h2>أسماء الجهات</h2>
        <select value={kind} onChange={(e) => setKind(e.target.value as any)}>
          <option value="tax_office">المأموريات</option><option value="registry">مكاتب السجل التجاري</option>
        </select></div>
      <p className="note">إذا كُتبت جهة واحدة بأكثر من طريقة، اكتب الاسم الصحيح بجانب الصيغة الخاطئة، فتنتقل إليه كل الشركات والتأكيدات.</p>
      {!names ? <Loading /> : names.length ? names.map((n) => (
        <form key={n} className="row" onSubmit={(e) => { e.preventDefault(); rename(n, String(new FormData(e.currentTarget).get("to"))); }}>
          <span className="grow">{n}</span>
          <input name="to" list="place-all" placeholder="الاسم الصحيح" />
          <button className="btn small" type="submit">توحيد</button>
        </form>
      )) : <p className="empty">لا توجد جهات بعد.</p>}
      <datalist id="place-all">{(names || []).map((n) => <option key={n} value={n} />)}</datalist>
    </section>
  );
}
