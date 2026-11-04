"use client";
// The commercial register's activity guide: search a word, see the matching
// classes by field, what each one covers, what is often needed alongside it,
// and the licence it leads to. Anyone can suggest a correction.
import Link from "next/link";
import { useState } from "react";
import { sb } from "@/lib/supabase";
import { num } from "@/lib/format";
import { ENTRIES, KIND_LABEL, SECTIONS, entryByCode, searchEntries, type Entry } from "@/lib/registry";
import { activityById } from "@/lib/activities";
import { useSession } from "../session";
import { Head, Icon } from "../ui";

export default function RegistryGuide() {
  const [q, setQ] = useState("");
  const [all, setAll] = useState(false);
  const term = q.trim();
  const shown = term ? searchEntries(term) : all ? ENTRIES : [];
  return (
    <>
      <Head back={["/actions", "الإجراءات"]} eyebrow="دليل أنشطة السجل التجاري" title="ابحث عن نشاطك كما يُكتب في السجل">
        <p>اكتب ما تعمل فيه، مثل مايوهات أو مطعم أو برمجة، لترى المجال والأنشطة المرتبطة به، وما يُطلب عادة معه.</p>
      </Head>
      <section className="panel">
        <div className="field">
          <label htmlFor="reg-q" className="sr-only">ابحث عن نشاط</label>
          <input id="reg-q" type="search" placeholder="ابحث بكلمة، مثل ملابس أو كافيه أو مقاولات" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {!term && <button className="linkish" type="button" onClick={() => setAll(!all)}>{all ? "إخفاء القائمة" : `استعراض كل الأنشطة (${num(ENTRIES.length)})`}</button>}
        {term && !shown.length && <p className="note">لم نجد نشاطًا بهذه الكلمة. جرّب كلمة أخرى، أو أخبرنا بنشاطك من زر ملاحظاتك لنضيفه.</p>}
        <p className="note">العناوين مأخوذة من التصنيف الدولي للأنشطة الاقتصادية الذي يُكوَّد به النشاط في السجل التجاري. الصياغة المعتمدة في السجل قد تكون أدق، فأكّدها مع مقدم الخدمة أو مكتب السجل.</p>
      </section>
      {SECTIONS.map(([s, title]) => {
        const list = shown.filter((e) => e.section === s);
        return list.length ? (
          <section key={s} className="panel"><h2>{title}</h2>
            <div className="reg-list">{list.map((e) => <EntryCard key={e.code} e={e} onCode={setQ} />)}</div>
          </section>
        ) : null;
      })}
    </>
  );
}

function EntryCard({ e, onCode }: { e: Entry; onCode: (code: string) => void }) {
  const { role, toast } = useSession();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const lic = e.license ? activityById(e.license) : null;
  const send = async () => {
    const body = text.trim();
    if (!body) return;
    const { error } = await sb.from("feedback").insert({ body: `دليل الأنشطة، النشاط ${e.code}: ${body}`, role, page: `/registry#${e.code}` });
    if (error) return toast("تعذّر الإرسال، حاول مرة أخرى", true);
    setText(""); setOpen(false); toast("وصلنا اقتراحك، شكرًا لك");
  };
  return (
    <article className="reg-card" id={e.code}>
      <div className="row between"><b>{e.title}</b><span className="chips"><span className="chip">{KIND_LABEL[e.kind]}</span><span className="chip ltr">{e.code}</span></span></div>
      {e.notes?.length ? <ul className="checklist">{e.notes.map((n) => <li key={n}><Icon name="check" size={16} />{n}</li>)}</ul> : null}
      {e.related?.length ? (
        <div className="reg-rel"><small className="note">قد تحتاج إضافة:</small>
          {e.related.map(([code, why]) => { const r = entryByCode(code); return r ? (
            <button key={code} type="button" className="reg-rel-item" onClick={() => onCode(code)}><b>{r.title}</b><small>{why}</small></button>
          ) : null; })}
        </div>
      ) : null}
      {lic && <Link className="reg-lic" href={`/activities/${lic.id}`}><Icon name="alert" size={16} />يحتاج ترخيصًا من {lic.authority}</Link>}
      {open ? (
        <div className="reg-sug">
          <label htmlFor={`sug-${e.code}`} className="sr-only">اقتراحك</label>
          <textarea id={`sug-${e.code}`} rows={3} value={text} onChange={(x) => setText(x.target.value)} placeholder="مثلًا: طلب منا السجل إضافة نشاط آخر، أو الصياغة المعتمدة كانت كذا" />
          <div className="row"><button className="btn primary" type="button" onClick={send}>إرسال</button><button className="btn" type="button" onClick={() => setOpen(false)}>إلغاء</button></div>
        </div>
      ) : <button className="linkish" type="button" onClick={() => setOpen(true)}>اقترح تصحيحًا أو نشاطًا مرتبطًا</button>}
    </article>
  );
}
