"use client";
// Choosing which licensed activities a company works in. null means not
// answered yet; an empty list means none of them.
import { useState } from "react";
import { ACTIVITIES } from "@/lib/activities";
import { Icon } from "./ui";

export default function ActivityPicker({ value, onChange, name }: { value: string[] | null; onChange: (v: string[] | null) => void; name?: string }) {
  const [q, setQ] = useState("");
  const shown = ACTIVITIES.filter((a) => !q.trim() || (a.title + " " + a.hint).includes(q.trim()));
  const on = (id: string) => !!value?.includes(id);
  const toggle = (id: string) => {
    const next = on(id) ? (value || []).filter((x) => x !== id) : [...(value || []), id];
    onChange(next);
  };
  return (
    <div className="act-pick">
      {name && <input type="hidden" name={name} value={value === null ? "" : JSON.stringify(value)} />}
      <div className="field">
        <label htmlFor="act-q" className="sr-only">ابحث عن نشاط</label>
        <input id="act-q" type="search" placeholder="ابحث عن نشاط، مثل استيراد أو مقاولات" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="opts">
        {shown.map((a) => (
          <label key={a.id} className="opt">
            <input type="checkbox" checked={on(a.id)} onChange={() => toggle(a.id)} />
            <span className="tile-ic"><Icon name={on(a.id) ? "check" : "doc"} size={20} /></span>
            <span><b>{a.title}</b><small>{a.hint}</small></span>
          </label>
        ))}
        {!shown.length && <p className="note">لا يوجد نشاط بهذا الاسم في القائمة. إذا لم يكن نشاطك فيها، فاختر أنه لا يحتاج ترخيصًا خاصًا.</p>}
      </div>
      <label className="opt act-none">
        <input type="checkbox" checked={value !== null && value.length === 0} onChange={(e) => onChange(e.target.checked ? [] : null)} />
        <span className="tile-ic"><Icon name="check" size={20} /></span>
        <span><b>نشاطي ليس من هذه الأنشطة</b><small>لا يحتاج ترخيصًا خاصًا غير السجل التجاري والبطاقة الضريبية</small></span>
      </label>
    </div>
  );
}

// Reading the picker's hidden field from a submitted form.
export const activitiesFrom = (f: FormData, name = "activities"): string[] | null => {
  const v = String(f.get(name) || "");
  if (!v) return null;
  try { return JSON.parse(v); } catch { return null; }
};
