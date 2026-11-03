"use client";
// A service provider confirms what each service needs at the authorities it
// deals with, and suggests items that are missing.
import { useEffect, useState } from "react";
import { sb } from "@/lib/supabase";
import { num } from "@/lib/format";
import { services } from "@/lib/data";
import { GOVERNORATES, PLACE_LABEL } from "@/lib/places";
import { readSession, writeSession } from "@/lib/storage";
import { useLoad, useSession } from "../session";
import { useRequirementStats } from "../Requirements";
import { Head, LoadError, Loading } from "../ui";

export default function ProviderRequirements() {
  const { uid, officeId, profile, toast } = useSession();
  const { data: svcs, error } = useLoad(services, []);
  const [serviceId, setServiceId] = useState<string>("");
  const [place, setPlace] = useState("");
  const [text, setText] = useState("");
  const svc = svcs && serviceId ? svcs[serviceId] : null;
  const kind = svc?.place_kind || "none";

  useEffect(() => { if (svcs && !serviceId) setServiceId(Object.keys(svcs)[0]); }, [svcs, serviceId]);
  // The last authority used for each kind is remembered for this visit.
  useEffect(() => { if (kind !== "none") setPlace(readSession(`waraqak-place-${kind}`) || ""); }, [kind]);

  const placeReady = kind === "none" || !!place.trim();
  const here = kind === "none" ? "" : place.trim();
  const { data: stats, reload: reloadStats } = useRequirementStats(serviceId || "-", placeReady ? here : null);
  const { data: names } = useLoad(async () => (kind === "registry" || kind === "tax_office") ? ((await sb.rpc("place_names", { p_kind: kind })).data || []) as string[] : [], [kind]);
  const { data: mine, reload: reloadMine } = useLoad(async () => {
    if (!serviceId || !placeReady) return { votes: new Set<string>(), pending: [] as { id: string; text: string; status: string }[] };
    const [{ data: v }, { data: p }] = await Promise.all([
      sb.from("requirement_votes").select("item_id").eq("voter_id", uid).eq("place", here),
      sb.from("requirement_items").select("id,text,status").eq("service_id", serviceId).eq("created_by", uid).neq("status", "approved"),
    ]);
    return { votes: new Set((v || []).map((x) => x.item_id as string)), pending: p || [] };
  }, [serviceId, here, placeReady, uid]);

  if (error) return <LoadError />;
  if (!svcs) return <Loading />;
  if (!officeId) return <section className="panel"><p>{profile.role === "admin" ? "اختر مقدم الخدمة الذي تريد التجربة به من الشريط في الأعلى." : "حسابك غير مرتبط بمقدم خدمة بعد. تواصل مع مدير المنصة."}</p></section>;

  const toggle = async (itemId: string, on: boolean) => {
    const { error } = on
      ? await sb.from("requirement_votes").insert({ item_id: itemId, voter_kind: "provider", office_id: officeId, place: here })
      : await sb.from("requirement_votes").delete().eq("item_id", itemId).eq("voter_id", uid).eq("place", here);
    if (error) return toast("تعذّر حفظ التأكيد", true);
    reloadMine(); reloadStats();
  };
  const suggest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim().length < 2) return;
    const { error } = await sb.from("requirement_items").insert({ service_id: serviceId, text: text.trim() });
    if (error) return toast("تعذّر إرسال الاقتراح", true);
    setText(""); toast("تم إرسال الاقتراح، وسيظهر بعد مراجعة الإدارة"); reloadMine();
  };
  const pickPlace = (v: string) => { setPlace(v); writeSession(`waraqak-place-${kind}`, v); };

  return (
    <>
      <Head eyebrow="المتطلبات" title="ما الذي تطلبه فعلًا في كل خدمة؟">
        <p>حدّد المستندات التي تطلبها من عملائك في كل خدمة، لدى الجهة التي تتعامل معها. يرى أصحاب الشركات عدد من أكدوا كل مستند، دون أسماء.</p>
      </Head>
      <section className="panel">
        <div className="form-row two">
          <div className="field"><label htmlFor="rq-svc">الخدمة</label>
            <select id="rq-svc" value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
              {Object.values(svcs).map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
            </select></div>
          {kind !== "none" && (
            <div className="field"><label htmlFor="rq-place">{PLACE_LABEL[kind]}</label>
              {kind === "governorate" ? (
                <select id="rq-place" value={place} onChange={(e) => pickPlace(e.target.value)}>
                  <option value="">اختر المحافظة</option>{GOVERNORATES.map((g) => <option key={g}>{g}</option>)}
                </select>
              ) : (
                <>
                  <input id="rq-place" list="rq-names" value={place} onChange={(e) => pickPlace(e.target.value)}
                    placeholder={kind === "registry" ? "مثلًا: مدينة نصر" : "مثلًا: مدينة نصر أول"} />
                  <datalist id="rq-names">{(names || []).map((n) => <option key={n} value={n} />)}</datalist>
                </>
              )}
            </div>
          )}
        </div>
        {kind !== "none" && <small className="note">إذا كنت تتعامل مع أكثر من جهة، اختر كل جهة على حدة وحدّد ما تطلبه فيها.</small>}
      </section>
      {!placeReady ? <section className="panel"><p className="empty">اختر {PLACE_LABEL[kind]} أولًا.</p></section> : (
        <section className="panel">
          <h2>المستندات المطلوبة</h2>
          {!stats || !mine ? <Loading /> : (
            <div className="vote-list">
              {stats.map((s) => {
                const on = mine.votes.has(s.item_id);
                return (
                  <label key={s.item_id} className={"vote" + (on ? " on" : "")}>
                    <input type="checkbox" checked={on} onChange={(e) => toggle(s.item_id, e.target.checked)} />
                    <span className="grow">{s.text}</span>
                    {(here ? s.total_here : s.total) > 0 && <span className="chip ok">{num(here ? s.total_here : s.total)}</span>}
                  </label>
                );
              })}
            </div>
          )}
          <form className="row" onSubmit={suggest}>
            <input className="grow" value={text} onChange={(e) => setText(e.target.value)} placeholder="مستند تطلبه وغير موجود في القائمة" maxLength={200} />
            <button className="btn" type="submit" disabled={text.trim().length < 2}>اقتراح</button>
          </form>
          {mine?.pending.length > 0 && (
            <div className="stack">
              <b>اقتراحاتك</b>
              {mine.pending.map((p) => <div key={p.id} className="kv"><span>{p.text}</span><span className={`chip ${p.status === "rejected" ? "bad" : "warn"}`}>{p.status === "rejected" ? "لم تُقبل" : "قيد المراجعة"}</span></div>)}
            </div>
          )}
        </section>
      )}
    </>
  );
}
