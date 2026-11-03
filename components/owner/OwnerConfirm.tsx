"use client";
// After a request is done, the owner confirms which documents were really
// asked for, at the company's own authority for that service.
import Link from "next/link";
import { useState } from "react";
import { sb } from "@/lib/supabase";
import { PLACE_LABEL, placeOf } from "@/lib/places";
import type { Service } from "@/lib/data";
import { useLoad, useSession } from "../session";
import { useRequirementStats } from "../Requirements";
import { Loading } from "../ui";

export default function OwnerConfirm({ companyId, service }: { companyId: string; service: Service }) {
  const { uid, toast } = useSession();
  const [text, setText] = useState("");
  const { data: co } = useLoad(async () => (await sb.from("companies").select("id,governorate,registry_office,tax_office").eq("id", companyId).maybeSingle()).data, [companyId]);
  const kind = service.place_kind;
  const place = kind === "none" ? "" : placeOf(co, kind);
  const { data: stats, reload: reloadStats } = useRequirementStats(service.id, place);
  const { data: votes, reload } = useLoad(async () => {
    const { data } = await sb.from("requirement_votes").select("item_id").eq("voter_id", uid).eq("company_id", companyId);
    return new Set((data || []).map((x) => x.item_id as string));
  }, [uid, companyId]);

  if (!co) return null;
  if (place === null) return (
    <section className="panel">
      <h2>ساعد غيرك يعرف المطلوب</h2>
      <p className="note">لتأكيد المستندات التي طُلبت منك، أضف {PLACE_LABEL[kind]} التابعة لها الشركة أولًا.</p>
      <Link className="btn" href={`/companies/${companyId}/edit`}>إضافة جهات الشركة</Link>
    </section>
  );

  const toggle = async (itemId: string, on: boolean) => {
    const { error } = on
      ? await sb.from("requirement_votes").insert({ item_id: itemId, voter_kind: "owner", company_id: companyId })
      : await sb.from("requirement_votes").delete().eq("item_id", itemId).eq("voter_id", uid).eq("company_id", companyId);
    if (error) return toast("تعذّر حفظ التأكيد", true);
    reload(); reloadStats();
  };
  const suggest = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await sb.from("requirement_items").insert({ service_id: service.id, text: text.trim() });
    if (error) return toast("تعذّر إرسال الاقتراح", true);
    setText(""); toast("شكرًا، سنراجع ما أضفته");
  };

  return (
    <section className="panel">
      <h2>ما المستندات التي طُلبت منك فعلًا؟</h2>
      <p className="note">حدّد ما طُلب منك في هذا الإجراء{kind !== "none" ? ` لدى ${PLACE_LABEL[kind]} ${place}` : ""}. يساعد ذلك أصحاب الشركات الآخرين على معرفة المطلوب قبل أن يبدؤوا.</p>
      {!stats || !votes ? <Loading /> : (
        <div className="vote-list">
          {stats.map((s) => (
            <label key={s.item_id} className={"vote" + (votes.has(s.item_id) ? " on" : "")}>
              <input type="checkbox" checked={votes.has(s.item_id)} onChange={(e) => toggle(s.item_id, e.target.checked)} />
              <span className="grow">{s.text}</span>
            </label>
          ))}
        </div>
      )}
      <form className="row" onSubmit={suggest}>
        <input className="grow" value={text} onChange={(e) => setText(e.target.value)} placeholder="مستند طُلب منك وغير موجود في القائمة" maxLength={200} />
        <button className="btn" type="submit" disabled={text.trim().length < 2}>إضافة</button>
      </form>
    </section>
  );
}
