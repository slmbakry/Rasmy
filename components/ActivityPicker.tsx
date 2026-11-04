"use client";
// Choosing licensed activities: search first, with the whole grouped list one
// tap away. In a form it picks several (null: not answered, empty: none of
// them); with onPick it picks one, for a question in a path.
import { useState } from "react";
import { ACTIVITIES, activitiesOf, grouped } from "@/lib/activities";
import { num } from "@/lib/format";
import { Icon } from "./ui";

type Props = { value: string[] | null; onChange?: (v: string[] | null) => void; onPick?: (id: string) => void; name?: string };

export default function ActivityPicker({ value, onChange, onPick, name }: Props) {
  const [q, setQ] = useState("");
  const [all, setAll] = useState(false);
  const term = q.trim();
  const single = !!onPick;
  const on = (id: string) => !!value?.includes(id);
  const toggle = (id: string) => {
    if (onPick) return onPick(id);
    onChange?.(on(id) ? (value || []).filter((x) => x !== id) : [...(value || []), id]);
  };
  const shown = term ? ACTIVITIES.filter((a) => (a.title + " " + a.hint).includes(term)) : all ? ACTIVITIES : [];
  const chosen = activitiesOf(value);

  return (
    <div className="act-pick">
      {name && <input type="hidden" name={name} value={value === null ? "" : JSON.stringify(value)} />}
      <div className="field">
        <label htmlFor="act-q" className="sr-only">ابحث عن نشاط</label>
        <input id="act-q" type="search" placeholder="ابحث عن نشاط، مثل استيراد أو مقاولات أو حضانة" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {!single && chosen.length > 0 && !term && !all && (
        <div className="chips">{chosen.map((a) => (
          <button key={a.id} type="button" className="chip ok act-chip" onClick={() => toggle(a.id)} aria-label={`إزالة ${a.title}`}>{a.title} ×</button>
        ))}</div>
      )}
      {grouped(shown).map(([g, list]) => (
        <div key={g} className="act-group">
          <h4>{g}</h4>
          <div className="opts">
            {list.map((a) => (
              <label key={a.id} className="opt">
                <input type={single ? "radio" : "checkbox"} name={single ? "act-one" : undefined} checked={on(a.id)} onChange={() => toggle(a.id)} />
                <span className="tile-ic"><Icon name={on(a.id) ? "check" : "doc"} size={20} /></span>
                <span><b>{a.title}</b><small>{a.hint}</small></span>
              </label>
            ))}
          </div>
        </div>
      ))}
      {term && !shown.length && <p className="note">لا يوجد نشاط بهذا الاسم في القائمة. جرّب كلمة أخرى، أو استعرض كل الأنشطة.</p>}
      {!term && (
        <button className="linkish" type="button" onClick={() => setAll(!all)}>
          {all ? "إخفاء القائمة" : `استعراض كل الأنشطة (${num(ACTIVITIES.length)})`}
        </button>
      )}
      {!single && (
        <label className="opt act-none">
          <input type="checkbox" checked={value !== null && value.length === 0} onChange={(e) => onChange?.(e.target.checked ? [] : null)} />
          <span className="tile-ic"><Icon name="check" size={20} /></span>
          <span><b>نشاطي ليس من هذه الأنشطة</b><small>لا يحتاج ترخيصًا خاصًا غير السجل التجاري والبطاقة الضريبية</small></span>
        </label>
      )}
    </div>
  );
}

// Reading the picker's hidden field from a submitted form.
export const activitiesFrom = (f: FormData, name = "activities"): string[] | null => {
  const v = String(f.get(name) || "");
  if (!v) return null;
  try { return JSON.parse(v); } catch { return null; }
};
